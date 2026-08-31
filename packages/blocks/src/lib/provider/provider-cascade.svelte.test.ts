// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { resolveClassChain } from '$lib/utils/variants';
import CascadeCompoundHost from './__fixtures__/CascadeCompoundHost.svelte';
import CascadeHost from './__fixtures__/CascadeHost.svelte';
import { MOUNT_FIXTURES, type MountFixture } from './__fixtures__/cascade-mount-props';
import { type CascadeComponent, exportedComponents } from './__fixtures__/cascade-registry';

/**
 * The oracle for the override cascade: every public component that declares an
 * `unstyled` prop — the component's own claim to the styling contract — is
 * mounted under a `<BlocksProvider>` and asked whether the provider's three
 * routes reach its markup: unconditional `slotClasses` on the root element (A),
 * a conditional `overrides` rule anywhere in the markup (B), and `unstyled` on
 * the root element (C).
 *
 * Why this has to be a mount, and what no grep over the sources can answer:
 *
 * - a component can call `resolveSlotClasses` and never read the record it
 *   returns, so the presence of the call proves nothing about the markup;
 * - an `overrides` rule is matched against the condition object the component
 *   builds at runtime. Its keys are the internal axis names, its values are
 *   expressions, and the object literal carries prose — the only exact reading
 *   of it is the call itself, which is why the condition here is captured from
 *   the running component (see the mock below) instead of parsed;
 * - `unstyled` is honoured per element, in a hand-written branch per slot, so
 *   "did the library classes go" has one answer per element and none per file.
 *
 * None of the three failures announces itself at runtime: a rule that matches
 * nothing is silent, and the index signature of `ConditionalOverride` accepts
 * any string, so the compiler is silent too.
 *
 * What this sweep does **not** see, so the next reader does not mistake a green
 * run for more than it is:
 *
 * - **B only proves that *one* rule arrives.** Its condition is the whole
 *   object the component carries, and `matchesCompound` is satisfied by any
 *   non-empty subset of it. Measured: Toggle's rule narrowed from the eight
 *   axes it carries to `{ size }` alone still arrives, and the 67 passing B
 *   rows have 1 572 non-empty proper subsets between them that no assertion
 *   here separates. An axis that is individually unmatchable stays invisible.
 * - **A and C speak for one element only** — the root, or for the seven
 *   `ROOT_IS_A_WRAPPER` components the outermost element the probes reach. A
 *   slot deeper in the tree that stops reading its `slotClasses`, or keeps its
 *   library classes under `unstyled`, passes both routes.
 * - **Only jsdom's answer.** Which of two surviving classes actually paints is
 *   a browser question; this file asserts on class attributes.
 */

/** Probe token for route A, one per slot so the landing slot stays identifiable. */
const PROBE_A_PREFIX = 'pa-';
const probeA = (slot: string) => `${PROBE_A_PREFIX}${slot}`;
/** Probe token for route B. */
const PROBE_B = 'pb-override';
/** Probe token for route E — marks the element the `class` prop lands on. */
const PROBE_E = 'pe-class';

/**
 * Route D's candidate classes. One per Tailwind conflict bucket a component
 * root plausibly occupies — the sweep does not pick which of them applies;
 * `resolveClassChain`, the same function the fold runs on, is asked whether a
 * candidate removes a given library class, and a library class no candidate
 * collides with is skipped rather than forced.
 *
 * Modifiers are not filtered out either: a `hover:`-prefixed library class is
 * probed with the same prefix on the candidate, because `stripConflicts` keeps
 * the prefix in the bucket key.
 */
const COLLISION_CANDIDATES = [
  'p-0',
  'px-0',
  'py-0',
  'pt-0',
  'm-0',
  'mx-0',
  'w-px',
  'h-px',
  'min-w-0',
  'max-w-none',
  'gap-0',
  'block',
  'rounded-none',
  'border-0',
  'border-transparent',
  'text-xs',
  'text-left',
  'font-normal',
  'not-italic',
  'no-underline',
  'text-transparent',
  'bg-transparent',
  'fill-none',
  'stroke-none',
  'grid-cols-1',
  'rotate-0',
  'flex-col',
  'items-start',
  'justify-start',
  'opacity-0',
  'shadow-none',
  'ring-0',
  'overflow-visible',
  'relative',
  'z-0',
  'cursor-auto',
  'transition-none',
  // Second entry for the buckets a library class most often occupies itself:
  // a candidate identical to the class under test proves nothing and is
  // skipped. Not every bucket above carries one — these are the buckets this
  // corpus actually collided with.
  'inline',
  'static',
  'text-sm',
  'p-px',
  'm-px',
  'w-auto',
  'h-auto',
  'gap-px',
  'rounded-sm',
  'border',
  'italic',
  'underline',
  'grid-cols-2',
  'rotate-45',
  'flex-row',
  'items-end',
  'justify-end',
  'opacity-100',
  'z-10'
];

/**
 * The candidate that makes the fold drop `libraryClass`, or `undefined` when
 * none does — which is the honest answer for a class whose bucket the engine
 * does not know (`fill-*`, `stroke-*`) and for a marker class that has no
 * bucket at all (`blocks-button`). Such a class is unreachable for *any*
 * consumer class, which is a defect of the bucket table rather than of the
 * call site this route measures.
 *
 * How much that costs, measured over one sweep: **749 of 2 412 class tokens
 * (31 %) get no candidate and are never asked**, and 10 of 292 slot elements
 * are skipped whole. A green route D means "every class it could challenge
 * lost", not "every class was challenged".
 */
function collisionProbe(libraryClass: string): string | undefined {
  const boundary = libraryClass.lastIndexOf(':') + 1;
  const modifiers = libraryClass.slice(0, boundary);
  for (const candidate of COLLISION_CANDIDATES) {
    const probe = modifiers + candidate;
    if (probe === libraryClass) continue;
    if (!resolveClassChain(libraryClass, probe).split(' ').includes(libraryClass)) return probe;
  }
  return undefined;
}

type Route = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * Routes that are known-broken today, each with the issue that repairs it.
 * An entry asserts its route **fails**, so the fix cannot land without deleting
 * the entry — the contract `imports-lint` and `examples-lint` already use:
 * a stale entry is an error, not a leftover.
 */
const KNOWN_GAPS: Record<string, Partial<Record<Route, string>>> = {
  // #341 — an empty condition object: every `overrides` rule is dead on arrival.
  A2UIView: { B: '#341 passes `{}` as its condition object' },
  AreaChart: { B: '#341 passes `{}` as its condition object' },
  BarChart: { B: '#341 passes `{}` as its condition object' },
  // `chartVariants` carries one axis, `layout`, and ChartFrame renders only at
  // `cartesian` — so it hands the resolver `{}` like the four charts around it.
  ChartFrame: { B: '#341 passes `{}` as its condition object' },
  Chat: { B: '#341 passes `{}` as its condition object' },
  ChatMessageList: { B: '#341 passes `{}` though it declares `layout` and `density`' },
  DonutChart: { B: '#341 passes `{}` as its condition object' },
  Guide: { B: '#341 passes `{}` as its condition object' },
  GuideArticle: { B: '#341 passes `{}` as its condition object' },
  GuideHint: { B: '#341 passes `{}` as its condition object' },
  GuideMention: { B: '#341 passes `{}` as its condition object' },
  GuideRef: { B: '#341 passes `{}` as its condition object' },
  LineChart: { B: '#341 passes `{}` as its condition object' },
  ReasoningDisclosure: { B: '#341 passes `{}` as its condition object' },

  // The internal core layer's structural plumbing (`inline-flex items-center
  // justify-center` on `CoreIconButton`) is joined raw with the call-site's
  // slot class and deliberately not merged against it —
  // COMPONENT-API-CONVENTIONS.md ("the plumbing is not an override surface").
  // The slot class that *is* the override surface merges correctly; these
  // entries record the plumbing buckets that stay out of it.
  // Reached the sweep with the open-listbox fixture, which is what made the
  // `selected` state measurable at all. Two defects, both of the ladder family
  // and neither of the co-location shape: `optionCheck` appends the library's
  // own `opacity-100` *after* the consumer's entry inside one `class` array,
  // and `option` nests the `optionActive` / `optionSelected` folds inside its
  // own, where same-bucket pairs fall through to the stylesheet.
  Combobox: { D: 'the option row appends library state classes past the consumer rung' },
  ChatMessage: { D: 'CoreIconButton plumbing on `actionButton`, out of the ladder by design' },
  // Reached the sweep with #355, which gave it a provider name of its own; the
  // close button it inherits from Dialog is the same core as Drawer's below.
  ConfirmDialog: { D: 'CoreIconButton plumbing on `closeButton`, out of the ladder by design' },
  Drawer: { D: 'CoreIconButton plumbing on `closeButton`, out of the ladder by design' },
  Planner: { D: 'CoreIconButton plumbing on `navButton`, out of the ladder by design' },
  PromptInput: { D: 'CoreIconButton plumbing on `sendButton`, out of the ladder by design' },
  ResourceTimeline: { D: 'CoreIconButton plumbing on `navButton`, out of the ladder by design' },

  // #339 — addressable, but under its parent's name (measured): a rule written
  // under `Calendar` does arrive at the header, and it renders its own markup
  // only inside that parent. Giving it a provider name of its own is therefore
  // NOT the repair — whether a compound part should be addressable alone is the
  // open question #343 asks about condition keys, and it wants one answer for
  // both.
  CalendarHeader: {
    A: '#339 addressable only under `Calendar` — measured: `defaults.Calendar.slotClasses` reaches its header, nav and title elements',
    B: '#339 addressable only under `Calendar`, whose condition object it does not contribute to'
  }
};

/**
 * Components whose outermost element is a hand-written wrapper that carries no
 * slot, so the root slot sits one level in. For these — and only these — the
 * element under measurement is the outermost one the slot probes reach, which
 * costs the position-based identity and buys it back through the probe token
 * that has to be on the same element again in the `unstyled` mount.
 * Each entry names the wrapper. Stale entries are errors.
 */
const ROOT_IS_A_WRAPPER: Record<string, string> = {
  // Hand-written wrappers in the component's own markup that no slot addresses:
  // measured on CopyButton, neither `defaults.CopyButton.*` nor
  // `defaults.Button.base` lands on the `<span>` — the class goes to the inner
  // Button. That is a #339-shaped gap, not composition; these three keep their
  // pass only until a slot reaches the wrapper, which the stale test below
  // turns into an error the moment it does.
  CopyButton: 'wraps button + live region in a `<span class="contents">`',
  Guide: 'announces the tour step through an `<span class="sr-only" aria-live>` first',
  Tooltip: 'wraps the trigger in a `<span class="inline-flex">`',
  // Outermost element belongs to a component this one composes, so the slot
  // that owns it is that component's, addressable under *its* provider name.
  CitationChip: 'renders through `<Popover>`, whose wrapper is the outer element',
  CommandPalette: 'renders through `<Dialog>`, whose `<dialog>` is the outer element',
  ReasoningDisclosure: 'renders through `<Collapsible>`, whose root is the outer element',
  ToolCallCard: 'renders through `<Collapsible>`, whose root is the outer element'
};

/**
 * Components the sweep cannot mount at all, with the reason. Every entry is a
 * component whose cascade nobody measures, so the list has to stay short and
 * each line has to name something the harness genuinely cannot supply.
 * Stale entries are errors.
 */
const NOT_MEASURABLE: Record<string, string> = {};

const recorder = vi.hoisted(() => ({
  calls: [] as { component: string; activeProps: Record<string, unknown> }[]
}));

// The condition object never leaves the component otherwise: it is built in a
// `$derived` and handed straight to the resolver. Wrapping the resolver is the
// only way to read its keys *and* the values a given mount carries.
vi.mock('$lib/provider', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/provider')>();
  return {
    ...original,
    resolveSlotClasses: (
      config: Parameters<typeof original.resolveSlotClasses>[0],
      component: string,
      preset: string | undefined,
      activeProps: Record<string, unknown>,
      instanceSlotClasses: Parameters<typeof original.resolveSlotClasses>[4]
    ) => {
      recorder.calls.push({ component, activeProps: { ...activeProps } });
      return original.resolveSlotClasses(
        config,
        component,
        preset,
        activeProps,
        instanceSlotClasses
      );
    }
  };
});

interface Outcome {
  ok: boolean;
  detail: string;
  /**
   * Whether the route found anything to judge at all. Route D needs a library
   * class *and* a candidate that collides with it; without both there is no
   * question to answer, and reporting that as a pass would be the same silent
   * green as reading "class not found" as "class stripped".
   */
  measured?: boolean;
}

interface Measurement {
  entry: CascadeComponent;
  mountError?: string;
  routes: Record<Route, Outcome>;
}

/**
 * How the element under measurement is found. `outermost` is the honest
 * default — the component's own root element, at a position the test knows
 * without asking the component anything. `probe` is the ROOT_IS_A_WRAPPER
 * escape hatch, and it buys its freedom by being pinned down again in every
 * later mount through the probe token it landed on.
 */
type RootRule = 'outermost' | 'probe';

interface MountResult {
  /** Every class token in the rendered markup, element by element. */
  tokens: Set<string>;
  /** Whether anything rendered at all. */
  rendered: boolean;
  /** Whether the root element itself was found. */
  rootFound: boolean;
  /** Class tokens of the root element, probe tokens excluded. */
  rootTokens: Set<string>;
  /** Slot names whose probe class sits on the root element. */
  rootProbes: Set<string>;
  /**
   * Per slot probe that landed anywhere: the class tokens of the first element
   * carrying it, probe tokens excluded. First rather than all, because a slot
   * that repeats (a chart segment, a legend row) repeats the same class string
   * — a set union over the repeats would say the same thing at more cost.
   */
  slotElements: Map<string, Set<string>>;
  /**
   * Slot names that share one element, one group per distinct element. Empty
   * for every component whose call sites paint one slot per element *in the
   * state this mount reached* — a pairing that only a closed listbox or an
   * unstarted tour renders is invisible here, so the answer is about the
   * mounted states and never about the library. Both gaps were real: opening
   * Combobox and starting Guide's tour in `MOUNT_FIXTURES` each turned an
   * empty list into a pair.
   */
  coLocated: string[][];
  /**
   * Class tokens of the element route E's `class`-prop marker landed on,
   * marker excluded — `undefined` when the prop reached no element.
   */
  classCarrier: Set<string> | undefined;
  /** The condition object the component handed to `resolveSlotClasses`. */
  condition: Record<string, unknown> | undefined;
}

/**
 * `true` — the entry's own fixture; `false` — none; an object — that fixture
 * instead, which is how the necessity assertions drop one part and keep the
 * rest.
 */
type FixtureChoice = boolean | MountFixture;

function resolveFixture(entry: CascadeComponent, choice: FixtureChoice): MountFixture {
  if (choice === true) return MOUNT_FIXTURES[entry.exportName] ?? {};
  if (choice === false) return {};
  return choice;
}

function mountOnce(
  entry: CascadeComponent,
  providerProps: Record<string, unknown>,
  withFixture: FixtureChoice = true,
  rootRule: RootRule = 'outermost',
  extraProps: Record<string, unknown> = {}
): MountResult {
  const fixture = resolveFixture(entry, withFixture);
  const props: Record<string, unknown> = { ...fixture.props, ...extraProps };
  if (entry.declaredProps.includes('children') && !('children' in props)) {
    props.children = createRawSnippet(() => ({ render: () => '<span>content</span>' }));
  }
  document.body.innerHTML = '';
  const target = document.createElement('div');
  document.body.appendChild(target);
  recorder.calls.length = 0;

  const app = fixture.family
    ? mount(CascadeCompoundHost, {
        target,
        props: {
          family: fixture.family,
          tour: fixture.tour ?? false,
          component: entry.component,
          props,
          ...providerProps
        }
      })
    : mount(CascadeHost, {
        target,
        props: { component: entry.component, props, ...providerProps }
      });
  // Dialog, Drawer and CommandPalette gate their markup on an `$effect` that
  // runs after `mount` returns; without this they measure as "renders nothing".
  flushSync();

  // Descendants only: the target is this file's own <div>, and counting it
  // would make `rendered` unfalsifiable. Measured on this corpus, nothing
  // escapes the target — jsdom has no top layer, so the native <dialog> and
  // the popovers stay where they are declared.
  const painted = [...target.querySelectorAll('*')];
  const tokens = new Set<string>();
  for (const element of painted) {
    for (const token of element.classList) tokens.add(token);
  }
  const rendered = painted.length > 0;

  // Inside a parent the first element belongs to the parent, so the compound
  // host marks the child's own subtree with `data-cascade-scope`.
  const outermost = fixture.family
    ? (target.querySelector('[data-cascade-scope]')?.firstElementChild ?? null)
    : target.firstElementChild;
  const root =
    rootRule === 'probe'
      ? (painted.find((element) =>
          [...element.classList].some((token) => token.startsWith(PROBE_A_PREFIX))
        ) ?? null)
      : outermost;
  const rootClasses = root ? [...root.classList] : [];
  const rootTokens = new Set(rootClasses.filter((token) => !token.startsWith(PROBE_A_PREFIX)));
  const rootProbes = new Set(
    rootClasses
      .filter((token) => token.startsWith(PROBE_A_PREFIX))
      .map((token) => token.slice(PROBE_A_PREFIX.length))
  );

  const classCarrierElement = painted.find((element) => element.classList.contains(PROBE_E));
  const classCarrier = classCarrierElement
    ? new Set([...classCarrierElement.classList].filter((token) => token !== PROBE_E))
    : undefined;

  const slotElements = new Map<string, Set<string>>();
  const coLocated: string[][] = [];
  for (const element of painted) {
    const classes = [...element.classList];
    const landed = classes.filter((token) => token.startsWith(PROBE_A_PREFIX));
    if (landed.length === 0) continue;
    const own = new Set(classes.filter((token) => !token.startsWith(PROBE_A_PREFIX)));
    const slots = landed.map((token) => token.slice(PROBE_A_PREFIX.length));
    // More than one slot's probe on one element: the call site joined two
    // finished folds. Measured here rather than read out of the markup —
    // the probes are already unique per slot and this render already happened.
    if (slots.length > 1 && !coLocated.some((group) => group.join() === slots.join())) {
      coLocated.push(slots);
    }
    for (const slot of slots) {
      if (!slotElements.has(slot)) slotElements.set(slot, own);
    }
  }

  // Measured across a full sweep: a component resolves its provider name at
  // most once per mount — most mounts once, the rest not at all, none twice.
  // `.at(-1)` is the settled value should that ever change; it is not covering
  // for a repeat this corpus has.
  const condition = recorder.calls
    .filter((call) => call.component === entry.providerName)
    .at(-1)?.activeProps;

  unmount(app);
  document.body.innerHTML = '';
  return {
    tokens,
    rendered,
    rootFound: root !== null,
    rootTokens,
    rootProbes,
    slotElements,
    coLocated,
    classCarrier,
    condition
  };
}

function measure(entry: CascadeComponent, withFixture: FixtureChoice = true): Measurement {
  const routes: Record<Route, Outcome> = {
    A: { ok: false, detail: 'not run' },
    B: { ok: false, detail: 'not run' },
    C: { ok: false, detail: 'not run' },
    D: { ok: false, detail: 'not run' },
    E: { ok: false, detail: 'not run' }
  };

  let plain: MountResult;
  try {
    plain = mountOnce(entry, {}, withFixture);
  } catch (error) {
    return { entry, mountError: String((error as Error).message).split('\n')[0], routes };
  }
  if (!plain.rendered) return { entry, mountError: 'renders no element', routes };

  const name = entry.providerName;
  const slotProbes = name
    ? {
        defaults: {
          [name]: { slotClasses: Object.fromEntries(entry.slots.map((s) => [s, probeA(s)])) }
        }
      }
    : undefined;
  const rootRule: RootRule = ROOT_IS_A_WRAPPER[entry.exportName] ? 'probe' : 'outermost';

  // ── A: an unconditional `slotClasses` entry reaches the root element ──
  let probed: MountResult | undefined;
  let rootSlots: string[] = [];
  if (!slotProbes) {
    routes.A = { ok: false, detail: 'no provider name — `defaults` cannot address this component' };
  } else {
    probed = mountOnce(entry, slotProbes, withFixture, rootRule);
    rootSlots = [...probed.rootProbes];
    const elsewhere = [...probed.tokens].filter((t) => t.startsWith(PROBE_A_PREFIX)).length;
    routes.A = rootSlots.length
      ? {
          ok: true,
          detail: `root slot ${rootSlots.join('+')}, ${elsewhere}/${entry.slots.length} slots landed`
        }
      : {
          ok: false,
          detail: probed.rootFound
            ? `${elsewhere}/${entry.slots.length} slots landed, none of them on the root element (${[...probed.rootTokens].join(' ') || '<no classes>'})`
            : `no root element found for slots {${entry.slots.join(', ')}}`
        };
  }

  // ── B: a conditional rule on the carried condition reaches the markup ──
  const condition = Object.entries(plain.condition ?? {}).filter(
    ([, value]) => value !== undefined && ['string', 'number', 'boolean'].includes(typeof value)
  );
  const shown = condition.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ');
  if (!name) {
    routes.B = {
      ok: false,
      detail: 'no provider name — `overrides` cannot address this component'
    };
  } else if (plain.condition === undefined) {
    routes.B = { ok: false, detail: 'resolveSlotClasses never ran for this provider name' };
  } else if (condition.length === 0) {
    routes.B = {
      ok: false,
      detail:
        Object.keys(plain.condition).length === 0
          ? 'empty condition object — no `overrides` rule can ever match'
          : `every axis carries undefined (${Object.keys(plain.condition).join(', ')}) — no rule can match`
    };
  } else {
    const rule = {
      ...Object.fromEntries(condition),
      class: Object.fromEntries(entry.slots.map((slot) => [slot, PROBE_B]))
    };
    const run = mountOnce(entry, { defaults: { [name]: { overrides: [rule] } } }, withFixture);
    routes.B = run.tokens.has(PROBE_B)
      ? { ok: true, detail: `matched on {${shown}}` }
      : { ok: false, detail: `rule on {${shown}} reached no element` };
  }

  // ── C: provider `unstyled` drops the root element's library classes ──
  // One element, not the subtree: token strings repeat across the library
  // (`inline-flex`, `items-center`), so a subtree-wide comparison reports a
  // *neighbour's* surviving class as this component's failure.
  if (routes.A.ok && slotProbes && probed) {
    const styled = [...probed.rootTokens].filter((t) => entry.libraryTokens.has(t));
    const stripped = mountOnce(entry, { ...slotProbes, unstyled: true }, withFixture, rootRule);
    const lostProbes = rootSlots.filter((slot) => !stripped.rootProbes.has(slot));
    if (!stripped.rootFound) {
      // Not "nothing survived": an element the sweep cannot find carries no
      // answer at all, and reading it as success is how three real defects
      // measured green before this branch existed.
      routes.C = {
        ok: false,
        detail:
          rootRule === 'probe'
            ? `under \`unstyled\` no element carries the provider's slotClasses — the root slot cannot be identified`
            : 'renders no root element under provider `unstyled`'
      };
    } else if (lostProbes.length) {
      // The probe is the identity of the element across the two mounts *and*
      // a contract in its own right: `unstyled` drops the library's classes,
      // never the consumer's.
      routes.C = {
        ok: false,
        detail: `the root element under \`unstyled\` lost the provider's own slotClasses (${lostProbes.join(', ')}) — either \`unstyled\` drops them with the library's, or this is a different element`
      };
    } else if (styled.length === 0) {
      routes.C = { ok: false, detail: 'root element carries no library class — nothing to strip' };
    } else {
      const survivors = styled.filter((t) => stripped.rootTokens.has(t));
      routes.C = survivors.length
        ? {
            ok: false,
            detail: `${survivors.length}/${styled.length} library classes survive \`unstyled\`: ${survivors.slice(0, 6).join(' ')}`
          }
        : { ok: true, detail: `${styled.length} library classes dropped` };
    }
  } else {
    // Route A produced no probe to pin the root slot down with — no provider
    // name, or the probes never reached the root. The outermost element stands
    // in, and every class that survives counts: this is the branch for a
    // component the provider demonstrably cannot address.
    const stripped = mountOnce(entry, { unstyled: true }, withFixture);
    const survivors = [...plain.rootTokens].filter((t) => stripped.rootTokens.has(t));
    routes.C = survivors.length
      ? {
          ok: false,
          detail: `${survivors.length}/${plain.rootTokens.size} root classes survive \`unstyled\`: ${survivors.slice(0, 6).join(' ')}`
        }
      : { ok: true, detail: `${plain.rootTokens.size} root classes dropped` };
  }

  // ── D: a colliding `slotClasses` entry strips the library class ──
  //
  // Route A proves an entry *arrives*; that it *wins* is a different question,
  // and the two have separate answers wherever a component builds its class
  // string with a raw join: the consumer's token never passes the slot
  // function, which is the only place `stripConflicts` runs. This route asks
  // it of every slot that landed, not only of the root, because the raw joins
  // sit as often on an inner element as on the outer one.
  //
  // The probe is not chosen by opinion. For each class on a slot's element the
  // sweep asks `resolveClassChain` — the very function the fold calls — for a
  // candidate that removes it, and measures only the classes that produced
  // one. Measured in the component's default variant state; a class only a
  // non-default variant emits is outside this route.
  if (routes.A.ok && slotProbes && probed && name) {
    // Everything on the element the sweep did not put there is the library's,
    // hand-written markup classes included: the question is which token wins
    // the attribute, not which config it came from. (Route C reads the
    // narrower tv()-only set, because `unstyled` promises only those.)
    const perSlot = new Map<string, Map<string, string>>();
    for (const [slot, tokens] of probed.slotElements) {
      const collisions = new Map<string, string>();
      for (const token of tokens) {
        const probe = collisionProbe(token);
        if (probe) collisions.set(token, probe);
      }
      if (collisions.size > 0) perSlot.set(slot, collisions);
    }

    if (perSlot.size === 0) {
      routes.D = {
        ok: false,
        measured: false,
        detail: `no candidate collides with any class on the ${probed.slotElements.size} slot elements that landed`
      };
    } else {
      const run = mountOnce(
        entry,
        {
          defaults: {
            [name]: {
              slotClasses: Object.fromEntries(
                entry.slots.map((slot) => {
                  const collisions = perSlot.get(slot);
                  const candidates = collisions ? [...new Set(collisions.values())] : [];
                  return [slot, [probeA(slot), ...candidates].join(' ')];
                })
              )
            }
          }
        },
        withFixture,
        rootRule
      );

      const failures: string[] = [];
      let stripped = 0;
      for (const [slot, collisions] of perSlot) {
        const element = run.slotElements.get(slot);
        if (!element) {
          failures.push(`${slot}: the colliding entry reached no element`);
          continue;
        }
        // A probe that never arrived carries no answer about the library class
        // it was meant to beat — reading its absence as a win is the "not
        // found equals stripped" confusion route C already paid for.
        const missing = [...new Set(collisions.values())].filter(
          (candidate) => !element.has(candidate)
        );
        if (missing.length) {
          failures.push(`${slot}: the colliding entry did not arrive (${missing.join(' ')})`);
          continue;
        }
        const survivors = [...collisions.keys()].filter((token) => element.has(token));
        stripped += collisions.size - survivors.length;
        if (survivors.length) {
          failures.push(
            `${slot}: ` +
              survivors
                .slice(0, 3)
                .map((token) => `${token} vs ${collisions.get(token)}`)
                .join(', ')
          );
        }
      }

      // The run above writes the candidate into *every* slot at once, and where
      // two slots share an element that hides a raw join: the neighbour's own
      // fold strips the library class, so the element comes out clean whatever
      // the call site did with the two finished results. Each slot sharing an
      // element is therefore asked once on its own — the shape a consumer
      // actually writes, and the only one under which the neighbour's classes
      // are still standing to be beaten.
      for (const slot of new Set(probed.coLocated.flat())) {
        const collisions = perSlot.get(slot);
        if (!collisions) continue;
        const candidates = [...new Set(collisions.values())];
        const alone = mountOnce(
          entry,
          {
            defaults: {
              [name]: { slotClasses: { [slot]: [probeA(slot), ...candidates].join(' ') } }
            }
          },
          withFixture,
          rootRule
        );
        const element = alone.slotElements.get(slot);
        if (!element || candidates.some((candidate) => !element.has(candidate))) continue;
        const survivors = [...collisions.keys()].filter((token) => element.has(token));
        if (survivors.length) {
          failures.push(
            `${slot} (written alone): ` +
              survivors
                .slice(0, 3)
                .map((token) => `${token} vs ${collisions.get(token)}`)
                .join(', ')
          );
        }
      }

      routes.D = failures.length
        ? {
            ok: false,
            detail:
              `${failures.length}/${perSlot.size} slots keep a library class the consumer ` +
              `collides with — ${failures.slice(0, 4).join(' · ')}`
          }
        : {
            ok: true,
            detail: `${stripped} colliding library classes stripped across ${perSlot.size} slots`
          };
    }
  } else {
    routes.D = {
      ok: false,
      measured: false,
      detail: 'route A does not reach the root element — there is no rung to measure'
    };
  }

  // ── E: a colliding `class` prop strips the library class ──
  //
  // The same question as D for the *strongest* rung of the ladder. It is a
  // separate route because `class` reaches one element only and takes a path
  // of its own through the component: a call site can fold `slotClasses`
  // correctly and still append `class` beside the result.
  if (entry.declaredProps.includes('class')) {
    // The element is found by the marker rather than by position: `class` does
    // not always land on the outermost element (Tooltip, CopyButton).
    const landed = mountOnce(entry, {}, withFixture, 'outermost', { class: PROBE_E }).classCarrier;
    if (!landed) {
      routes.E = { ok: false, detail: 'the `class` prop reached no element' };
    } else {
      const collisions = new Map<string, string>();
      for (const token of landed) {
        const probe = collisionProbe(token);
        if (probe) collisions.set(token, probe);
      }
      if (collisions.size === 0) {
        routes.E = {
          ok: false,
          measured: false,
          detail: `no candidate collides with any of the ${landed.size} classes the \`class\` prop joins`
        };
      } else {
        const candidates = [...new Set(collisions.values())];
        const element = mountOnce(entry, {}, withFixture, 'outermost', {
          class: [PROBE_E, ...candidates].join(' ')
        }).classCarrier;
        if (!element) {
          routes.E = { ok: false, detail: 'the colliding `class` prop reached no element' };
        } else {
          const missing = candidates.filter((candidate) => !element.has(candidate));
          if (missing.length) {
            routes.E = {
              ok: false,
              detail: `the colliding \`class\` prop did not arrive (${missing.join(' ')})`
            };
          } else {
            const survivors = [...collisions.keys()].filter((token) => element.has(token));
            routes.E = survivors.length
              ? {
                  ok: false,
                  detail:
                    `${survivors.length}/${collisions.size} library classes survive a colliding ` +
                    `\`class\` prop: ` +
                    survivors
                      .slice(0, 4)
                      .map((token) => `${token} vs ${collisions.get(token)}`)
                      .join(', ')
                }
              : { ok: true, detail: `${collisions.size} colliding library classes stripped` };
          }
        }
      }
    }
  } else {
    routes.E = { ok: false, measured: false, detail: 'declares no `class` prop' };
  }

  return { entry, routes };
}

// Two claims to the styling contract, either of which admits a component —
// neither is a hand-written roster, both are read off the source:
//
// - it declares `unstyled`, so it owns markup that has to obey the flag;
// - it calls `resolveSlotClasses(config, 'Name', …)`, so a `defaults` entry
//   under that name reaches something, even where the markup it reaches
//   belongs to a component it wraps (`CurrencyInput`, `ConfirmDialog`).
//
// The union, rather than the first alone, is what makes losing membership
// unrepresentable instead of merely reportable. Measured on the first: dropping
// `unstyled` from the two pickers' `$props()` took this file from 6416 to 6404
// tests — six route assertions each, gone, with nothing red. A component cannot
// leave that way now; it has to give up its provider name too, which is the
// feature being deleted rather than a slip.
const exported = await exportedComponents();
const components = exported.filter(
  (entry) => entry.declaredProps.includes('unstyled') || entry.providerName !== null
);
const measurements = components.map((entry) => measure(entry));

describe('BlocksProvider cascade reaches the markup', () => {
  it('leaves nothing route A reaches unprobed by route D', () => {
    // A component leaves route D by one of two doors: route A did not reach
    // its root (which fails loudly on its own, or is a recorded #339 gap), or
    // no candidate collided with anything its slots paint. Only the second is
    // this route going blind, and `routes.A.ok` is what separates them.
    //
    // Deliberately a condition, not a floor under a count: a count cannot tell
    // the two doors apart, so recording one more #339 gap — a normal, wanted
    // act in this repo — would read as the candidate list rotting. "The sweep found
    // nothing at all" is the stale-entry test's job, not this one's.
    const blind = measurements
      .filter((m) => m.routes.A.ok && m.routes.D.measured === false)
      .map((m) => `${m.entry.exportName}: ${m.routes.D.detail}`);
    expect(
      blind,
      'route A reaches these components but route D can no longer probe them — nothing ' +
        `in COLLISION_CANDIDATES collides with anything they paint:\n  ${blind.join('\n  ')}`
    ).toEqual([]);
  });

  it('lists no component that the sweep can measure after all', () => {
    const stale = Object.keys(NOT_MEASURABLE).filter(
      (name) => !measurements.find((m) => m.entry.exportName === name)?.mountError
    );
    expect(
      stale,
      `NOT_MEASURABLE entries that now mount — delete them:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });

  it('lists no KNOWN_GAPS route that has stopped being measured', () => {
    // The per-route `it.skipIf(measured === false)` below skips the "listed in
    // KNOWN_GAPS but passes now — delete the entry" assertion along with the
    // route, so an entry whose route became unmeasurable would quietly stop
    // claiming anything: neither the gap nor its repair gets reported. The
    // sibling stale test checks component names only, never routes.
    const stale: string[] = [];
    for (const [name, routes] of Object.entries(KNOWN_GAPS)) {
      const measurement = measurements.find((m) => m.entry.exportName === name);
      if (!measurement) continue; // an unknown name is the sibling test's case
      for (const route of Object.keys(routes) as Route[]) {
        if (measurement.mountError) {
          stale.push(`${name} ${route} — the component no longer mounts`);
        } else if (measurement.routes[route].measured === false) {
          stale.push(`${name} ${route} — ${measurement.routes[route].detail}`);
        }
      }
    }
    expect(
      stale,
      'KNOWN_GAPS entries whose route is no longer measured, so the entry asserts ' +
        `nothing:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });

  it('lists no entry for a component the sweep does not know', () => {
    const known = new Set(components.map((entry) => entry.exportName));
    const stale = [
      ...Object.keys(KNOWN_GAPS),
      ...Object.keys(NOT_MEASURABLE),
      ...Object.keys(MOUNT_FIXTURES),
      ...Object.keys(ROOT_IS_A_WRAPPER)
    ].filter((name) => !known.has(name));
    expect(
      stale,
      `entries for components the sweep no longer sees — delete them:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });

  it('lists no component whose root element carries a slot after all', () => {
    // The exception costs the position-based identity of the measured element,
    // so it has to keep being necessary: with the plain rule the root must
    // still carry none of the component's slot classes.
    const stale: string[] = [];
    for (const [name, reason] of Object.entries(ROOT_IS_A_WRAPPER)) {
      const entry = components.find((component) => component.exportName === name);
      if (!entry?.providerName) continue;
      const probes = {
        defaults: {
          [entry.providerName]: {
            slotClasses: Object.fromEntries(entry.slots.map((slot) => [slot, probeA(slot)]))
          }
        }
      };
      const run = mountOnce(entry, probes, true, 'outermost');
      if (run.rootProbes.size > 0) stale.push(`${name} (${reason})`);
    }
    expect(
      stale,
      `ROOT_IS_A_WRAPPER entries whose root element does carry a slot — delete them:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });

  it('needs every mount fixture it carries', () => {
    // A fixture earns its place by changing an answer: without it the
    // component must fail to mount, or measure differently. Anything else is
    // dead weight — the contract `imports-lint` puts on its own allowlist.
    //
    // Asked of the entry whole, and of `tour` on its own. Not of the
    // individual `props`: those are the minimum that makes a component render,
    // and measured, 15 of them across 11 components move no route — the
    // `value` a `TabItem` needs to be coherent is not dead weight because no
    // route happens to read it. `tour` is the other kind, a state the sweep
    // has to enter before there is anything to measure, and while it lived in
    // the host rather than here it changed twelve of Guide's slots and flipped
    // route E with nothing asserting it.
    const unnecessary: string[] = [];
    for (const [name, fixture] of Object.entries(MOUNT_FIXTURES)) {
      const fixtured = measurements.find((m) => m.entry.exportName === name);
      if (!fixtured) continue;
      const without: [string, FixtureChoice][] = [[name, false]];
      if (fixture.tour !== undefined) {
        without.push([`${name}.tour`, { ...fixture, tour: undefined }]);
      }
      for (const [label, choice] of without) {
        let bare: Measurement;
        try {
          bare = measure(fixtured.entry, choice);
        } catch {
          continue; // throwing without the fixture is what makes it necessary
        }
        if (bare.mountError) continue;
        const changed = (['A', 'B', 'C', 'D', 'E'] as Route[]).some(
          (route) =>
            fixtured.routes[route].ok !== bare.routes[route].ok ||
            fixtured.routes[route].detail !== bare.routes[route].detail
        );
        if (!changed) unnecessary.push(label);
      }
    }
    expect(
      unnecessary,
      'MOUNT_FIXTURES entries — or the one part named after the dot — that change no answer. ' +
        `Delete them, or make the host honour what the fixture asks for:\n  ${unnecessary.join('\n  ')}`
    ).toEqual([]);
  });
});

const ROUTE_TITLE: Record<Route, string> = {
  A: 'A — `defaults.slotClasses` reaches the root element',
  B: 'B — a conditional `overrides` rule reaches the markup',
  C: 'C — provider `unstyled` drops the root element’s library classes',
  D: 'D — a colliding `slotClasses` entry strips the library class it collides with',
  E: 'E — a colliding `class` prop strips the library class it collides with'
};

describe.each(measurements.map((m) => [m.entry.exportName, m] as const))(
  '%s',
  (name, measurement) => {
    const notMeasurable = NOT_MEASURABLE[name];

    it('mounts under a BlocksProvider', () => {
      if (notMeasurable) {
        expect(
          measurement.mountError,
          `${name} is listed as not measurable but mounts`
        ).toBeTruthy();
        return;
      }
      expect(
        measurement.mountError,
        `${name} did not render: ${measurement.mountError}. Give it a MOUNT_FIXTURES entry, ` +
          'or a NOT_MEASURABLE entry saying what the harness cannot supply.'
      ).toBeUndefined();
    });

    for (const route of ['A', 'B', 'C', 'D', 'E'] as Route[]) {
      const gap = KNOWN_GAPS[name]?.[route];
      it.skipIf(
        notMeasurable || measurement.mountError || measurement.routes[route].measured === false
      )(ROUTE_TITLE[route], () => {
        const outcome = measurement.routes[route];
        if (gap) {
          expect(
            outcome.ok,
            `${name} route ${route} is listed in KNOWN_GAPS (${gap}) but passes now — ` +
              'delete the entry, that is how the fix gets recorded'
          ).toBe(false);
          return;
        }
        expect(outcome.ok, `${name} route ${route}: ${outcome.detail}`).toBe(true);
      });
    }
  }
);
