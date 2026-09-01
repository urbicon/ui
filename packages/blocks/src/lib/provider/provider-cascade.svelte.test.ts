// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { effectiveVariants, resolveClassChain } from '$lib/utils/variants';
import CascadeCompoundHost from './__fixtures__/CascadeCompoundHost.svelte';
import CascadeHost from './__fixtures__/CascadeHost.svelte';
import { MOUNT_FIXTURES, type MountFixture } from './__fixtures__/cascade-mount-props';
import { type CascadeComponent, exportedComponents } from './__fixtures__/cascade-registry';
import LadderFoldProbe from './__fixtures__/LadderFoldProbe.svelte';

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
 * - an `overrides` rule is matched against the component's effective variants —
 *   the condition object it builds at runtime, folded over its `tv()` config's
 *   `defaultVariants`. Its keys are variant axis names, its values are
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
 * Route F/G's pair: two classes in one conflict bucket that no library config
 * emits, so each one's presence names the rung it came from. `LADDER_LOSER`
 * rides `slotClasses`, `LADDER_WINNER` rides `class`; the fold has to keep the
 * winner and drop the loser. That they collide at all is asserted below rather
 * than assumed — a pair the bucket table stopped joining would make both routes
 * pass by measuring nothing.
 */
const LADDER_LOSER = 'p-[3px]';
const LADDER_WINNER = 'p-[5px]';

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

type Route = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
/** Every route, once — the per-route loops read this rather than restating it. */
const ROUTES: Route[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface Gap {
  /**
   * Exactly what the route reports as failing — a slot, a variant axis or a
   * class token, whichever unit the route names. Compared whole and sorted, so
   * the entry is stale when the set GROWS as much as when it shrinks.
   */
  leaks: string[];
  /** Why the gap stands. Never *what* leaks: that is `leaks`, and checked. */
  why: string;
}

/**
 * Routes that are known-broken today. An entry asserts its route **fails**, so
 * the fix cannot land without deleting the entry — the contract `imports-lint`
 * and `examples-lint` already use: a stale entry is an error, not a leftover.
 *
 * `leaks` is the half of that contract a reason cannot carry. Measured on route
 * D of `Planner` (#376): reverting its fold in stages widened the gap from 1
 * leaking slot of 13 to 5, and an entry asserting only `ok === false` stayed
 * green at every stage — with its reason, which named the one slot, still
 * literally true. So the prose says why and the set says how much, and only one
 * of the two can be checked against the running component.
 */
const KNOWN_GAPS: Record<string, Partial<Record<Route, Gap>>> = {
  // An empty condition object, and here it is the honest one: these components'
  // `tv()` configs declare `variants: {}`, so there is no axis for a rule to
  // select and `effectiveVariants` has nothing to fold in either. `tv()` sees
  // exactly the same emptiness. Unconditional `slotClasses` and presets reach
  // them (routes A and F–H pass); only a *conditional* rule cannot, and giving
  // them an axis to be addressable would add a branch no stylesheet needs.
  //
  // ChatMessageList is the one that looks like a defect and is not: it declares
  // `layout` and `density`, but forwards both to the `ChatMessage`s it renders
  // rather than styling itself with them — a rule keyed on either belongs under
  // `ChatMessage`, whose condition object does carry them.
  //
  // Their `leaks: []` is that claim, measured: the condition object carries no
  // axis at all. An axis that appeared without becoming addressable would be
  // listed there and redden the row.
  A2UIView: { B: { leaks: [], why: '`a2uiViewVariants` declares no axes' } },
  Chat: { B: { leaks: [], why: '`chatVariants` declares no axes' } },
  ChatMessageList: {
    B: {
      leaks: [],
      why: '`chatMessageListVariants` declares no axes — `layout`/`density` go to ChatMessage'
    }
  },
  Guide: { B: { leaks: [], why: '`guideTourVariants` declares no axes' } },
  GuideArticle: { B: { leaks: [], why: '`guideArticleVariants` declares no axes' } },
  GuideHint: { B: { leaks: [], why: '`guideHintVariants` declares no axes' } },
  GuideMention: { B: { leaks: [], why: '`guideMentionVariants` declares no axes' } },
  GuideRef: { B: { leaks: [], why: '`guideRefVariants` declares no axes' } },
  ReasoningDisclosure: {
    B: { leaks: [], why: '`reasoningDisclosureVariants` declares no axes' }
  },

  // The internal core layer's structural plumbing (`inline-flex items-center
  // justify-center` on `CoreIconButton`) is joined raw with the call-site's
  // slot class and deliberately not merged against it —
  // COMPONENT-API-CONVENTIONS.md ("the plumbing is not an override surface").
  // The slot class that *is* the override surface merges correctly, so exactly
  // one slot per component leaks and `leaks` names which: a second one is a
  // call site that stopped folding, not this exception widening.
  ChatMessage: {
    D: { leaks: ['actionButton'], why: 'CoreIconButton plumbing, out of the ladder by design' }
  },
  // Reached the sweep with #355, which gave it a provider name of its own; the
  // close button it inherits from Dialog is the same core as Drawer's below.
  ConfirmDialog: {
    D: { leaks: ['closeButton'], why: 'CoreIconButton plumbing, out of the ladder by design' }
  },
  Drawer: {
    D: { leaks: ['closeButton'], why: 'CoreIconButton plumbing, out of the ladder by design' }
  },
  Planner: {
    D: { leaks: ['navButton'], why: 'CoreIconButton plumbing, out of the ladder by design' }
  },
  PromptInput: {
    D: { leaks: ['sendButton'], why: 'CoreIconButton plumbing, out of the ladder by design' }
  },
  ResourceTimeline: {
    D: { leaks: ['navButton'], why: 'CoreIconButton plumbing, out of the ladder by design' }
  },
  // Styled entirely through the `Button` it wraps: its own tv() config
  // (`paginationLinkVariants`) declares no slots, so there is no slot for a
  // `defaults` entry to land on and no provider name that would help — the
  // rule a consumer writes goes under `Button`. Measured on the C row: the
  // three classes that survive are Button's semantic hooks plus its press-cue
  // token (`blocks-button`, `blocks-intent-primary`,
  // `[--blocks-press-scale:1]`), which Button keeps under `unstyled` on
  // purpose; without a provider name route C falls back to comparing every
  // root class, and those three are in it. Reached the sweep with the
  // `unstyled` prop that lets `<Pagination unstyled>` reach its page buttons.
  PaginationItem: {
    A: {
      // The four are `paginationVariants`' slots rather than this component's:
      // the tv() index is per module, so a sibling config's slot names come
      // with the import. Without a provider name none of them is addressable.
      leaks: ['base', 'controls', 'ellipsis', 'info'],
      // The coupling is in the reason because the reason is what the failure
      // message prints: adding a slot to `paginationVariants` — a config this
      // component never calls — moves this set, and the generic wording would
      // otherwise report that as a regression inside PaginationItem.
      why: "no provider name, and `paginationLinkVariants` declares no slots to address — the four pinned slots are `paginationVariants`', so a slot added to `Pagination` changes this set"
    },
    B: { leaks: [], why: 'no provider name — a rule for these buttons goes under `Button`' },
    C: {
      leaks: ['[--blocks-press-scale:1]', 'blocks-button', 'blocks-intent-primary'],
      why: "the no-provider-name fallback counts Button's semantic hooks as root classes"
    }
  },

  // #339 — addressable, but under its parent's name (measured): a rule written
  // under `Calendar` does arrive at the header, and it renders its own markup
  // only inside that parent. Giving it a provider name of its own is therefore
  // NOT the repair — whether a compound part should be addressable alone is the
  // open question #343 asks about condition keys, and it wants one answer for
  // both.
  CalendarHeader: {
    A: {
      // `base` is the registry's fallback slot, not one this component reads:
      // it composes no tv() config of its own and takes its classes from the
      // `Calendar` context.
      leaks: ['base'],
      why: '#339 addressable only under `Calendar` — measured: `defaults.Calendar.slotClasses` reaches its header, nav and title elements'
    },
    B: {
      leaks: [],
      why: '#339 addressable only under `Calendar`, whose condition object it does not contribute to'
    }
  }
};

/**
 * Wrappers whose `unstyled` forwarding route H cannot see, with the child it
 * misses. Their route H *passes*, on the markup a plain mount does render — so
 * this is a note, not a KNOWN_GAPS entry, and it buys nothing at runtime.
 *
 * It is written down because the alternative is worse: the forwarding in these
 * four rests on the roster derivation (every component that declares `unstyled`
 * and renders a public component must hand it down), and a reader who trusts
 * the sweep alone would delete it as untested.
 *
 * How the set was measured, and the only way it can be: by REMOVING every
 * forwarding this PR added and running the sweep — the components that stay
 * green are the blind ones. Asking the gate instead — a KNOWN_GAPS probe
 * entry, reading "listed but passes now" — cannot tell "measured and correct"
 * from "measured and blind", because both are green.
 *
 * `Guide` was on this list until #370 gave the sweep a fixture that runs a
 * tour: with the bubble rendered, route H sees its three `<Button>`s after all
 * (measured — removing their forwarding now reddens H with 43/79 classes
 * surviving). The stale test below is what reported that, which is the whole
 * reason this list is a checked constant rather than a comment.
 */
const ROUTE_H_BLIND: Record<string, string> = {
  AvatarGroup: 'its `<Avatar>`s need `items`, which the plain mount does not supply',
  CalendarHeader: 'its Popover / SegmentGroup / Tooltip render only while open',
  FileUpload: 'its `<Progress>` renders only for a file that is uploading'
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
      ...args: Parameters<typeof original.resolveSlotClasses>
    ): ReturnType<typeof original.resolveSlotClasses> => {
      // The props the resolver *matches on*, not the raw bag the component
      // hands over: a rule is tested against the config's `defaultVariants`
      // under that bag, so a component that leaves an axis out is still
      // addressable on it. Recording the raw bag instead made route B build
      // rules out of keys the match never sees — measured on the four input
      // wrappers, whose written props are all `undefined` at a plain mount.
      recorder.calls.push({
        component: args[1],
        activeProps: effectiveVariants(args[5], args[3])
      });
      return original.resolveSlotClasses(...args);
    }
  };
});

/**
 * A route's answer, in three shapes rather than one, so that the compiler
 * holds the rule a lint would otherwise have to: a failure that a KNOWN_GAPS
 * entry can be written against has to name what it is made of. `leaks` is
 * required on that shape and absent from the other two, so a failure branch
 * cannot be added without one.
 *
 * `leaks: []` therefore has exactly one meaning — **the failure has no parts**,
 * because nothing of the component's arrived to be named (a `class` prop that
 * reaches no element at all). "The route found nothing to judge" is the other
 * shape, `measured: false`, and choosing between them is not a matter of taste:
 * an entry can pin an empty set and freeze it, so a route with no subject
 * encoded here goes unwatched for good — see route C's `styled.length === 0`
 * branch, which was on the wrong side of this line and what it cost.
 *
 * The unit of a leak belongs to the route and is named at each one below, but
 * one rule spans all of them: **`leaks` names what the COMPONENT contributes to
 * the failure, never the sweep's own probes.** A missing `p-[5px]` or a
 * `COLLISION_CANDIDATES` entry says which challenger the sweep sent, not which
 * of the component's classes stood — those failures have no parts.
 */
type Outcome =
  | { ok: true; detail: string; measured?: undefined; leaks?: undefined }
  /**
   * The route found nothing to judge at all. Route D needs a library class
   * *and* a candidate that collides with it; without both there is no question
   * to answer, and reporting that as a pass would be the same silent green as
   * reading "class not found" as "class stripped". These rows are skipped, so
   * no entry can rest on one — the stale test below reports any that tries.
   */
  | { ok: false; measured: false; detail: string; leaks?: undefined }
  /**
   * A failure, with the things it is made of. What a thing *is* belongs to the
   * route — a slot, a variant axis, a class token, listed under each route
   * below; what is common is that the set is exact, because a KNOWN_GAPS entry
   * pins it and goes stale when it grows or shrinks.
   */
  | { ok: false; measured?: undefined; detail: string; leaks: string[] };

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
  /**
   * The same, narrowed to the component's own subtree. For a compound child
   * that is what sits inside `data-cascade-scope`; everything else renders
   * alone and the two sets are equal. Route H compares two mounts in which the
   * *parent* is styled differently, so the parent's classes have to be out.
   */
  ownTokens: Set<string>;
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
  const scope = target.querySelector('[data-cascade-scope]');
  const ownTokens = new Set<string>();
  for (const element of scope ? [...scope.querySelectorAll('*')] : painted) {
    for (const token of element.classList) ownTokens.add(token);
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
    // First element wins, and that bounds route D's per-slot pass: a state
    // slot holding on a *later* element than its neighbour's first is folded
    // against a token set nothing here reads. Both sides are pinned by the
    // `LadderFoldProbe` pair below.
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
    ownTokens,
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
  // `measured: false` rather than a failure with an empty leak set: a route
  // that never ran carries no answer, and the placeholder must not be the one
  // shape an entry could be written against.
  const notRun = { ok: false, measured: false, detail: 'not run' } as const;
  const routes: Record<Route, Outcome> = {
    A: notRun,
    B: notRun,
    C: notRun,
    D: notRun,
    E: notRun,
    F: notRun,
    G: notRun,
    H: notRun
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
  //
  // Leaks: the slots whose probe reached no element at all. The route's own
  // claim is about the root and is binary, but the extent of a failure is how
  // much of the component the provider cannot address — a component where one
  // slot short of the root lands and one where none does are two different
  // gaps, and an entry that pins the set says which one it was written for.
  let probed: MountResult | undefined;
  let rootSlots: string[] = [];
  if (!slotProbes) {
    routes.A = {
      ok: false,
      detail: 'no provider name — `defaults` cannot address this component',
      leaks: entry.slots
    };
  } else {
    probed = mountOnce(entry, slotProbes, withFixture, rootRule);
    rootSlots = [...probed.rootProbes];
    const landed = new Set(
      [...probed.tokens]
        .filter((t) => t.startsWith(PROBE_A_PREFIX))
        .map((t) => t.slice(PROBE_A_PREFIX.length))
    );
    routes.A = rootSlots.length
      ? {
          ok: true,
          detail: `root slot ${rootSlots.join('+')}, ${landed.size}/${entry.slots.length} slots landed`
        }
      : {
          ok: false,
          detail: probed.rootFound
            ? `${landed.size}/${entry.slots.length} slots landed, none of them on the root element (${[...probed.rootTokens].join(' ') || '<no classes>'})`
            : `no root element found for slots {${entry.slots.join(', ')}}`,
          leaks: entry.slots.filter((slot) => !landed.has(slot))
        };
  }

  // ── B: a conditional rule on the carried condition reaches the markup ──
  //
  // Leaks: the axis names the component's condition object carries, none of
  // which got a rule through. An entry reading "declares no axes" therefore
  // pins the empty set and goes stale the moment an axis appears — the same
  // check `boolean-conditions.svelte.test.ts` makes when its `no-axis` kind is
  // held against the running `tv()` config, rather than against the prose.
  const axes = Object.keys(plain.condition ?? {});
  const condition = Object.entries(plain.condition ?? {}).filter(
    ([, value]) => value !== undefined && ['string', 'number', 'boolean'].includes(typeof value)
  );
  const shown = condition.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ');
  if (!name) {
    routes.B = {
      ok: false,
      detail: 'no provider name — `overrides` cannot address this component',
      leaks: axes
    };
  } else if (plain.condition === undefined) {
    routes.B = {
      ok: false,
      detail: 'resolveSlotClasses never ran for this provider name',
      leaks: axes
    };
  } else if (condition.length === 0) {
    routes.B = {
      ok: false,
      detail:
        Object.keys(plain.condition).length === 0
          ? 'empty condition object — no `overrides` rule can ever match'
          : `every axis carries undefined (${Object.keys(plain.condition).join(', ')}) — no rule can match`,
      leaks: axes
    };
  } else {
    const rule = {
      ...Object.fromEntries(condition),
      class: Object.fromEntries(entry.slots.map((slot) => [slot, PROBE_B]))
    };
    const run = mountOnce(entry, { defaults: { [name]: { overrides: [rule] } } }, withFixture);
    routes.B = run.tokens.has(PROBE_B)
      ? { ok: true, detail: `matched on {${shown}}` }
      : { ok: false, detail: `rule on {${shown}} reached no element`, leaks: axes };
  }

  // ── C: provider `unstyled` drops the root element's library classes ──
  // One element, not the subtree: token strings repeat across the library
  // (`inline-flex`, `items-center`), so a subtree-wide comparison reports a
  // *neighbour's* surviving class as this component's failure.
  //
  // Leaks: the classes that survive the flag — or, in the branch where the
  // probes went missing, the slots that lost them, since that failure is about
  // which element was measured rather than about what stayed on it.
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
            : 'renders no root element under provider `unstyled`',
        leaks: rootSlots
      };
    } else if (lostProbes.length) {
      // The probe is the identity of the element across the two mounts *and*
      // a contract in its own right: `unstyled` drops the library's classes,
      // never the consumer's.
      routes.C = {
        ok: false,
        detail: `the root element under \`unstyled\` lost the provider's own slotClasses (${lostProbes.join(', ')}) — either \`unstyled\` drops them with the library's, or this is a different element`,
        leaks: lostProbes
      };
    } else if (styled.length === 0) {
      // The same shape as route D's "no candidate collides" and the ladder's
      // "no pair to resolve": `unstyled` promises to drop the library's classes
      // and there is none on this element, so the route has no subject and the
      // honest answer is "not measured", not "failed". Encoded as a failure it
      // was worse than useless — an entry could pin its empty leak set and
      // freeze the emptiness (measured: with `collapsibleVariants.base` emptied
      // and such an entry written, the sweep ran 807 passed | 13 skipped).
      routes.C = {
        ok: false,
        measured: false,
        detail: 'root element carries no library class — nothing to strip'
      };
    } else {
      const survivors = styled.filter((t) => stripped.rootTokens.has(t));
      routes.C = survivors.length
        ? {
            ok: false,
            detail: `${survivors.length}/${styled.length} library classes survive \`unstyled\`: ${survivors.slice(0, 6).join(' ')}`,
            leaks: survivors
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
          detail: `${survivors.length}/${plain.rootTokens.size} root classes survive \`unstyled\`: ${survivors.slice(0, 6).join(' ')}`,
          leaks: survivors
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

      // The slot is kept apart from the prose rather than prefixed onto it:
      // the slot names are route D's leak set, and reading them back out of a
      // formatted sentence would tie the entries below to its wording.
      const failures: { slot: string; detail: string }[] = [];
      let stripped = 0;
      for (const [slot, collisions] of perSlot) {
        const element = run.slotElements.get(slot);
        if (!element) {
          failures.push({ slot, detail: 'the colliding entry reached no element' });
          continue;
        }
        // A probe that never arrived carries no answer about the library class
        // it was meant to beat — reading its absence as a win is the "not
        // found equals stripped" confusion route C already paid for.
        const missing = [...new Set(collisions.values())].filter(
          (candidate) => !element.has(candidate)
        );
        if (missing.length) {
          failures.push({
            slot,
            detail: `the colliding entry did not arrive (${missing.join(' ')})`
          });
          continue;
        }
        const survivors = [...collisions.keys()].filter((token) => element.has(token));
        stripped += collisions.size - survivors.length;
        if (survivors.length) {
          failures.push({
            slot,
            detail: survivors
              .slice(0, 3)
              .map((token) => `${token} vs ${collisions.get(token)}`)
              .join(', ')
          });
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
        if (!element) {
          failures.push({
            slot: `${slot} (written alone)`,
            detail: 'the colliding entry reached no element'
          });
          continue;
        }
        // A candidate that arrived in the run above and not here lost its
        // bucket to a neighbouring library class that only this run leaves
        // unopposed — which is the defect, not a reason to skip. Both runs
        // write the same string into this slot, so nothing else can remove it.
        // Measured: with `Combobox`'s option row folding `optionActive` /
        // `optionSelected` into its own slot again, `bg-transparent` and
        // `font-normal` go missing here and route D reports it; skipping
        // instead leaves that shape green over the whole corpus.
        const missingAlone = candidates.filter((candidate) => !element.has(candidate));
        if (missingAlone.length) {
          failures.push({
            slot: `${slot} (written alone)`,
            detail: `the colliding entry did not arrive (${missingAlone.join(' ')})`
          });
          continue;
        }
        const survivors = [...collisions.keys()].filter((token) => element.has(token));
        if (survivors.length) {
          failures.push({
            slot: `${slot} (written alone)`,
            detail: survivors
              .slice(0, 3)
              .map((token) => `${token} vs ${collisions.get(token)}`)
              .join(', ')
          });
        }
      }

      routes.D = failures.length
        ? {
            ok: false,
            detail:
              `${failures.length}/${perSlot.size} slots keep a library class the consumer ` +
              `collides with — ${failures
                .slice(0, 4)
                .map((failure) => `${failure.slot}: ${failure.detail}`)
                .join(' · ')}`,
            // Leaks: the leaking slots, the per-slot pass named apart from the
            // joint one. Two passes ask two questions of the same slot, and an
            // entry that pins only the slot name would go on holding while the
            // second one started failing too.
            leaks: failures.map((failure) => failure.slot)
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
  //
  // Leaks: the library classes that survive the colliding prop. Its other
  // failures have no parts — a prop that reaches no element leaves none of the
  // component's classes standing to be named.
  if (entry.declaredProps.includes('class')) {
    // The element is found by the marker rather than by position: `class` does
    // not always land on the outermost element (Tooltip, CopyButton).
    const landed = mountOnce(entry, {}, withFixture, 'outermost', { class: PROBE_E }).classCarrier;
    if (!landed) {
      routes.E = { ok: false, detail: 'the `class` prop reached no element', leaks: [] };
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
          routes.E = {
            ok: false,
            detail: 'the colliding `class` prop reached no element',
            leaks: []
          };
        } else {
          const missing = candidates.filter((candidate) => !element.has(candidate));
          if (missing.length) {
            routes.E = {
              ok: false,
              detail: `the colliding \`class\` prop did not arrive (${missing.join(' ')})`,
              // The candidates are the sweep's, not the component's: nothing of
              // this component's survived to be named.
              leaks: []
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
                      .join(', '),
                  leaks: survivors
                }
              : { ok: true, detail: `${collisions.size} colliding library classes stripped` };
          }
        }
      }
    }
  } else {
    routes.E = { ok: false, measured: false, detail: 'declares no `class` prop' };
  }

  // ── F/G: a colliding `class` prop strips the `slotClasses` entry ──
  //
  // The two top rungs of the ladder, measured against each other. Route E asks
  // whether `class` beats the LIBRARY; this asks whether it beats the rung
  // directly below it, which is a different code path: both are consumer
  // sources, and until they reach `tv()` as two array elements they travel as
  // one string in which nothing strips anything.
  //
  // G is the same claim in the `unstyled` branch, where there is no library
  // class left and the component joins the two rungs by hand. Two routes
  // rather than one because the branches are two hand-written expressions per
  // slot and only a failure that names the branch is actionable — and because
  // they have disjoint controls: measured, breaking the fold inside `tv()`
  // (`sources.push(...overrideSources)` → `.flat()`) reddens 76 F rows and NOT
  // ONE G row, since G never enters `foldFor`; breaking `resolveClassChain`'s
  // own fold reddens 84 G rows. Neither sabotage stands in for the other.
  //
  // Leaks: none, on every branch. One `slotClasses` entry against one `class`
  // on one element is a question with a yes and a no and no middle, so an entry
  // here would pin the empty set — the failure itself, not a share of it.
  const ladder = (unstyled: boolean): Outcome => {
    if (!name) {
      return {
        ok: false,
        measured: false,
        detail: 'no provider name — `slotClasses` cannot be addressed'
      };
    }
    if (!entry.declaredProps.includes('class')) {
      return { ok: false, measured: false, detail: 'declares no `class` prop' };
    }
    const extra: Record<string, unknown> = unstyled ? { unstyled: true } : {};
    const rungs = {
      defaults: {
        [name]: { slotClasses: Object.fromEntries(entry.slots.map((slot) => [slot, LADDER_LOSER])) }
      }
    };
    const carried = mountOnce(entry, rungs, withFixture, 'outermost', {
      ...extra,
      class: PROBE_E
    }).classCarrier;
    if (!carried) return { ok: false, detail: 'the `class` prop reached no element', leaks: [] };
    if (!carried.has(LADDER_LOSER)) {
      // Without the lower rung on the same element there is no pair to
      // resolve — the honest answer is "not measured", not "passed".
      return {
        ok: false,
        measured: false,
        detail: `the element the \`class\` prop lands on carries no \`slotClasses\` entry (${[...carried].slice(0, 6).join(' ') || '<no classes>'})`
      };
    }
    const element = mountOnce(entry, rungs, withFixture, 'outermost', {
      ...extra,
      class: `${PROBE_E} ${LADDER_WINNER}`
    }).classCarrier;
    if (!element) {
      return { ok: false, detail: 'the colliding `class` prop reached no element', leaks: [] };
    }
    if (!element.has(LADDER_WINNER)) {
      return {
        ok: false,
        detail: `the colliding \`class\` prop did not arrive (${LADDER_WINNER})`,
        leaks: []
      };
    }
    return element.has(LADDER_LOSER)
      ? {
          ok: false,
          detail: `\`slotClasses\` ${LADDER_LOSER} survives a colliding \`class\` ${LADDER_WINNER} — both land in the attribute and the stylesheet decides`,
          leaks: []
        }
      : { ok: true, detail: `${LADDER_WINNER} stripped ${LADDER_LOSER}` };
  };
  routes.F = ladder(false);
  routes.G = ladder(true);

  // ── H: an instance `unstyled` strips what a provider `unstyled` strips ──
  //
  // Two ways to ask for the same thing, held to the same answer. The set is
  // read off the component rather than listed: whatever the provider flag
  // removes from the subtree is, by definition, this component's look — and a
  // wrapper that keeps it when the flag arrives as its own prop is stripping
  // its own root and leaving the components it renders dressed.
  //
  // Scoped to the component's own subtree, because a compound child's parent
  // is inside the provider and outside the instance prop.
  //
  // What it does NOT ask: whether `unstyled` reaches a component the CONSUMER
  // passes in as `children`. It must not — that is action at a distance from a
  // prop written on the wrapper, and `<BlocksProvider unstyled>` is the tool
  // for it. The sweep's `children` is a bare `<span>`, so nothing here depends
  // on the difference.
  //
  // And it answers for the markup a plain mount renders, no more: see
  // ROUTE_H_BLIND above for the four wrappers whose forwarding it cannot see,
  // and for how that set was measured.
  if (!entry.declaredProps.includes('unstyled')) {
    routes.H = { ok: false, measured: false, detail: 'declares no `unstyled` prop' };
  } else {
    const byProvider = mountOnce(entry, { unstyled: true }, withFixture);
    const stripped = [...plain.ownTokens].filter((token) => !byProvider.ownTokens.has(token));
    if (stripped.length === 0) {
      routes.H = {
        ok: false,
        measured: false,
        detail:
          'provider `unstyled` removes no class from this subtree — nothing to compare against'
      };
    } else {
      const byInstance = mountOnce(entry, {}, withFixture, 'outermost', { unstyled: true });
      const survivors = stripped.filter((token) => byInstance.ownTokens.has(token));
      routes.H = survivors.length
        ? {
            ok: false,
            detail:
              `${survivors.length}/${stripped.length} classes that provider \`unstyled\` removes ` +
              `survive an instance \`unstyled\`: ${survivors.slice(0, 6).join(' ')}`,
            leaks: survivors
          }
        : { ok: true, detail: `${stripped.length} classes dropped either way` };
    }
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
  it('probes routes F and G with a pair that actually collides', () => {
    // Both routes read "the winner stripped the loser". A pair the bucket
    // table no longer joins would satisfy that by never emitting the loser at
    // all, and ~90 components would go green on a measurement that stopped
    // happening.
    expect(resolveClassChain(LADDER_LOSER, LADDER_WINNER).split(' ')).toEqual([LADDER_WINNER]);
  });

  // Route D's co-located pass is the only thing in this file that catches a
  // state slot folded into its neighbour's `class` array, and no component in
  // the corpus carries that fold any more — so nothing here would fail if the
  // pass stopped reporting. `LadderFoldProbe` carries it on purpose, through a
  // hand-built entry rather than the roster derivation, which keeps it out of
  // the sweep's own rows and its exemption lists.
  //
  // The two mounts differ only in which row holds the state, and that is the
  // whole reach of the pass: `slotElements` keeps the FIRST element a slot's
  // probe lands on, so the fold is reported only where the state holds on that
  // element. Both answers are asserted, because a repair that widened the pass
  // and a fixture that stopped entering the state read the same from one row.
  const foldProbe: CascadeComponent = {
    providerName: 'LadderFoldProbe',
    exportName: 'LadderFoldProbe',
    slots: ['base', 'row', 'rowState'],
    libraryTokens: new Set([
      'flex',
      'flex-col',
      'gap-2',
      'p-2',
      'w-full',
      'items-center',
      'px-3',
      'py-2',
      'text-left',
      'text-sm',
      'font-normal',
      'bg-surface-hover',
      'font-medium'
    ]),
    declaredProps: ['stateOn', 'unstyled', 'slotClasses'],
    component: LadderFoldProbe as CascadeComponent['component']
  };
  const onRow = (stateOn: 'first' | 'second') => ({ props: { stateOn } });

  it('reports a state slot folded into the row it shares an element with', () => {
    const outcome = measure(foldProbe, onRow('first')).routes.D;
    expect(outcome.measured, 'route D found a library class and a challenger for it').not.toBe(
      false
    );
    expect(outcome.ok).toBe(false);
    // Named, not merely red: the main pass passes this fixture — both slots
    // resolve to one element, so they are handed the same candidates and none
    // of them can strip another. Only the per-slot pass leaves the library's
    // state class standing to be beaten.
    expect(outcome.detail).toContain('row (written alone): the colliding entry did not arrive');
    // And sized, which is what a KNOWN_GAPS entry pins. This is the only place
    // a leak set is asserted against a component built to produce it: the
    // entries below are pinned against the corpus, and a `leaks` that silently
    // came out empty would let every one of them keep passing.
    expect(outcome.leaks ?? []).toEqual(['row (written alone)']);
  });

  it('does not report the same fold when the state sits on the second row', () => {
    const probes = {
      defaults: {
        LadderFoldProbe: {
          slotClasses: Object.fromEntries(foldProbe.slots.map((slot) => [slot, probeA(slot)]))
        }
      }
    };
    // Without this the green below would also be what a fixture that stopped
    // rendering the state at all produces.
    expect(mountOnce(foldProbe, probes, onRow('second')).coLocated).toEqual([['row', 'rowState']]);
    const outcome = measure(foldProbe, onRow('second')).routes.D;
    expect(outcome.ok).toBe(true);
    // The other end of the same pin: a passing route names no leak at all, so
    // the two rows together are the shrink and the growth of one gap.
    expect(outcome.leaks).toBeUndefined();
  });

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
      ...Object.keys(ROOT_IS_A_WRAPPER),
      ...Object.keys(ROUTE_H_BLIND)
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

  it('lists no ROUTE_H_BLIND entry whose route H has started failing', () => {
    // The entry claims "H passes here, and that pass is worth nothing". A red H
    // means the second half is no longer the reason it is listed — a fixture
    // now reaches the child, or the forwarding broke. Either way the entry has
    // to be re-decided rather than left standing.
    //
    // This does NOT verify blindness; nothing in a test run can. Blindness is
    // shown by removing the forwarding and watching the sweep stay green.
    const stale: string[] = [];
    for (const name of Object.keys(ROUTE_H_BLIND)) {
      const measurement = measurements.find((m) => m.entry.exportName === name);
      if (!measurement || measurement.mountError) continue;
      if (!measurement.routes.H.ok) stale.push(`${name} — ${measurement.routes.H.detail}`);
    }
    expect(
      stale,
      'ROUTE_H_BLIND entries whose route H now fails — the entry says it passes ' +
        `for a reason that no longer holds:\n  ${stale.join('\n  ')}`
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
        const changed = ROUTES.some(
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
  E: 'E — a colliding `class` prop strips the library class it collides with',
  F: 'F — a colliding `class` prop strips the `slotClasses` entry it collides with',
  G: 'G — …and does so under `unstyled` too',
  H: 'H — an instance `unstyled` strips what a provider `unstyled` strips'
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

    for (const route of ROUTES) {
      const gap = KNOWN_GAPS[name]?.[route];
      it.skipIf(
        notMeasurable || measurement.mountError || measurement.routes[route].measured === false
      )(ROUTE_TITLE[route], () => {
        const outcome = measurement.routes[route];
        if (gap) {
          expect(
            outcome.ok,
            `${name} route ${route} is listed in KNOWN_GAPS (${gap.why}) but passes now — ` +
              'delete the entry, that is how the fix gets recorded'
          ).toBe(false);
          // Dead once the assertion above has thrown — it is what narrows the
          // union to the one shape that carries `leaks`.
          if (outcome.ok) return;
          expect(
            [...(outcome.leaks ?? [])].sort(),
            `${name} route ${route} still fails, but not by what its KNOWN_GAPS entry ` +
              `records (${gap.why}). A wider set is a regression inside the gap, which the ` +
              'reason no longer covers; a narrower one is a repair, and the entry has to be ' +
              `narrowed or deleted with it. The sweep says: ${outcome.detail}`
          ).toEqual([...gap.leaks].sort());
          return;
        }
        expect(outcome.ok, `${name} route ${route}: ${outcome.detail}`).toBe(true);
      });
    }
  }
);
