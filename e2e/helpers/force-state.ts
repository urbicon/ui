import type { CDPSession, Page } from '@playwright/test';

/**
 * Force CSS pseudo-classes on a whole subtree via CDP, so interaction states
 * can be inspected without moving a real pointer.
 *
 * Shared by the two interaction suites: `visual-regression-interaction.spec.ts`
 * (what the state looks like) and `interaction-tokens.spec.ts` (whether the
 * state resolves to a different colour at all).
 *
 * Why forced rather than real:
 *  - A real pointer hovers exactly one element, so N fills would need N moves,
 *    and `:hover` would also match every ancestor.
 *  - Tailwind's `group-hover:` compiles to `.group:hover .child`, so the state
 *    must be forced on the ANCESTOR to reach the child. Forcing the subtree
 *    covers both idioms without the caller knowing which is in play.
 *  - `:focus-visible` depends on input-modality heuristics that are awkward to
 *    drive; forcing it is exact.
 */

/** Chromium accepts these on `CSS.forcePseudoState`. */
export type ForcedPseudoClass = 'hover' | 'active' | 'focus' | 'focus-visible' | 'focus-within';

/**
 * `focus` and `focus-visible` go only on elements a browser can actually focus;
 * everything else goes on the whole subtree.
 *
 * The subtree is right for hover — `group-hover:` compiles to `.group:hover
 * .child`, so the ancestor has to carry it, and 89 slots in blocks use that
 * idiom. It is wrong for focus, and visibly so: the UA stylesheet is
 * `:focus-visible { outline: auto }`, which applies to whatever matches, so
 * forcing the class on plain layout `div`s and on the text spans inside buttons
 * made the browser draw its own ring around all of them. Those rings dominated
 * every `*-focus-*` shot — 16 of the 48 — and they are not the library's: they
 * even change colour by platform (blue under darwin, white under linux), so the
 * baselines carried a platform difference that guarded nothing. Worse, they
 * would have masked the regression the shot exists for: with the library's ring
 * gone, the picture is still full of rectangles.
 *
 * Nothing is lost by narrowing. Every group/peer focus idiom in the library
 * hangs off an element that is itself focusable — the 21 `peer-focus-visible:`
 * peers are real `<input>`s, `group-focus-visible/step` sits on a `div` with
 * `tabindex="0"` — and `focus-within`, the one idiom that genuinely needs a
 * container, stays in the subtree set below.
 */
const FOCUS_ONLY: readonly ForcedPseudoClass[] = ['focus', 'focus-visible'];

/**
 * Matches what Chromium will focus. `[tabindex]:not([tabindex="-1"])` is what
 * catches the library's `role="button"` divs (Stepper's step, among others);
 * `-1` is excluded because it means "programmatically focusable only", which no
 * keyboard ring follows.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

export async function openCdp(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  return cdp;
}

/**
 * Every element inside `testId`, including the host itself. The fixtures are
 * static, so the ids stay valid for the whole test — no DOM mutation can stale
 * them.
 */
export async function nodeIdsWithin(cdp: CDPSession, testId: string): Promise<number[]> {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: `[data-testid="${testId}"], [data-testid="${testId}"] *`
  });
  return [...nodeIds];
}

/*
 * A `force(cdp, nodeIds, classes)` used to sit here, paired by each caller with
 * its own `nodeIdsWithin` call. That pairing was the defect — every caller
 * decided which elements a pseudo-class landed on, and both decided "all of
 * them", which is right for hover and wrong for focus. It is gone rather than
 * deprecated: an exported helper that can still be paired wrongly is an
 * invitation, and there is no use for it that `forceWithin` does not cover.
 */

/**
 * Force a state on a fixture group, with each pseudo-class landing on the
 * elements it belongs on.
 *
 * This is the entry point callers should use, rather than pairing
 * `nodeIdsWithin` with `force` themselves: the pairing is the part that was
 * wrong, and a helper that takes both separately lets the next caller get it
 * wrong the same way. Pass an empty list to clear — that always clears the full
 * subtree, so it cannot leave a narrower earlier application behind.
 *
 * ONE `DOM.getDocument` for both queries, and that is load-bearing rather than
 * an optimisation: each call returns a fresh node-id space and invalidates the
 * ids handed out before it. Resolving the two sets through two `getDocument`
 * calls made every id from the first one stale, and CDP reports that as
 * `CSS.forcePseudoState: Could not find node with given id` — which names
 * neither the cause nor the call that caused it.
 *
 * The `:is()` wrapping is load-bearing too: concatenating the scope onto each
 * focusable selector yields compounds like `[data-testid="x"]a[href]`, invalid
 * CSS because a type selector has to come first, answered with an equally bare
 * "DOM Error while querying".
 */
export async function forceWithin(
  cdp: CDPSession,
  testId: string,
  forcedPseudoClasses: readonly ForcedPseudoClass[]
): Promise<void> {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const scope = `:is([data-testid="${testId}"], [data-testid="${testId}"] *)`;

  const { nodeIds: subtree } = await cdp.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: scope
  });

  const focusClasses = forcedPseudoClasses.filter((c) => FOCUS_ONLY.includes(c));
  const broadClasses = forcedPseudoClasses.filter((c) => !FOCUS_ONLY.includes(c));

  // Only pay for the second query when a focus class is actually requested.
  let focusable = new Set<number>();
  if (focusClasses.length > 0) {
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: `${scope}:is(${FOCUSABLE_SELECTOR})`
    });
    focusable = new Set(nodeIds);
  }

  // One call per node with its FULL set: `CSS.forcePseudoState` replaces rather
  // than merges, so two passes over overlapping sets would leave each node with
  // whichever ran last.
  for (const nodeId of subtree) {
    const classes = focusable.has(nodeId) ? [...broadClasses, ...focusClasses] : broadClasses;
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: classes });
  }
}
