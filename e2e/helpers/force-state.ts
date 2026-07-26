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

/** Apply (or, with an empty list, clear) the forced classes on every node. */
export async function force(
  cdp: CDPSession,
  nodeIds: number[],
  forcedPseudoClasses: readonly ForcedPseudoClass[]
): Promise<void> {
  for (const nodeId of nodeIds) {
    await cdp.send('CSS.forcePseudoState', {
      nodeId,
      forcedPseudoClasses: [...forcedPseudoClasses]
    });
  }
}
