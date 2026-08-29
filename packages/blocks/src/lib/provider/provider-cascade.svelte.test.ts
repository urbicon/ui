// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import CascadeCompoundHost from './__fixtures__/CascadeCompoundHost.svelte';
import CascadeHost from './__fixtures__/CascadeHost.svelte';
import { MOUNT_FIXTURES } from './__fixtures__/cascade-mount-props';
import { type CascadeComponent, exportedComponents } from './__fixtures__/cascade-registry';

/**
 * The oracle for the override cascade: every public component that declares an
 * `unstyled` prop — the component's own claim to the styling contract — is
 * mounted under a `<BlocksProvider>` and asked whether the provider's three
 * routes reach its markup: unconditional `slotClasses` (A), a conditional
 * `overrides` rule (B), and `unstyled` (C).
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
 */

/** Probe token for route A, one per slot so the landing slot stays identifiable. */
const probeA = (slot: string) => `pa-${slot}`;
/** Probe token for route B. */
const PROBE_B = 'pb-override';

type Route = 'A' | 'B' | 'C';

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

  // #339 — public components outside the resolver: no provider name to address,
  // and for two of them `unstyled` does not reach the markup either.
  CalendarHeader: {
    A: '#339 never calls resolveSlotClasses, so it has no provider name',
    B: '#339 never calls resolveSlotClasses, so it has no provider name'
  },
  ChartFrame: {
    A: '#339 never calls resolveSlotClasses, so it has no provider name',
    B: '#339 never calls resolveSlotClasses, so it has no provider name',
    C: '#339 never reads getBlocksConfig(), so provider `unstyled` does nothing'
  },
  LocaleSwitcher: {
    A: '#339 never calls resolveSlotClasses, so it has no provider name',
    B: '#339 never calls resolveSlotClasses, so it has no provider name'
  },
  Sparkline: {
    A: '#339 never calls resolveSlotClasses, so it has no provider name',
    B: '#339 never calls resolveSlotClasses, so it has no provider name',
    C: '#339 never reads getBlocksConfig(), so provider `unstyled` does nothing'
  }
};

/**
 * Components the sweep cannot mount at all, with the reason. Every entry is a
 * component whose cascade nobody measures, so the list has to stay short and
 * each line has to name something the harness genuinely cannot supply.
 * Stale entries are errors.
 */
const NOT_MEASURABLE: Record<string, string> = {};

/**
 * Lower bound on the components actually measured. A broken glob or a renamed
 * barrel export would otherwise report a green sweep over an empty set — the
 * failure mode `variants-lint.ts` guards with its own `loaded.length` check.
 */
const MIN_MEASURED = 75;

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
}

interface Measurement {
  entry: CascadeComponent;
  mountError?: string;
  routes: Record<Route, Outcome>;
}

interface MountResult {
  /** Every class token in the rendered markup, element by element. */
  tokens: Set<string>;
  /** Class tokens of the component's own outermost element. */
  rootTokens: Set<string>;
  /** Class tokens of the element the slot probes reached first. */
  probeRootTokens: Set<string>;
  /** Whether anything rendered at all. */
  rendered: boolean;
  /** The condition object the component handed to `resolveSlotClasses`. */
  condition: Record<string, unknown> | undefined;
}

function mountOnce(
  entry: CascadeComponent,
  providerProps: Record<string, unknown>,
  withFixture = true
): MountResult {
  const fixture = (withFixture && MOUNT_FIXTURES[entry.exportName]) || {};
  const props: Record<string, unknown> = { ...fixture.props };
  if (entry.declaredProps.includes('children') && !('children' in props)) {
    props.children = createRawSnippet(() => ({ render: () => '<span>content</span>' }));
  }
  if (fixture.family) {
    // Inside a parent the outermost element belongs to the parent, so the
    // child marks its own root through its rest-props spread.
    props['data-cascade-root'] = '';
  }

  document.body.innerHTML = '';
  const target = document.createElement('div');
  document.body.appendChild(target);
  recorder.calls.length = 0;

  const app = fixture.family
    ? mount(CascadeCompoundHost, {
        target,
        props: { family: fixture.family, component: entry.component, props, ...providerProps }
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
  const root = fixture.family
    ? target.querySelector('[data-cascade-root]')
    : target.firstElementChild;
  const rootTokens = new Set(root ? [...root.classList] : []);
  // The outermost element the slot probes reached — the component's root slot,
  // named by its own markup rather than by DOM position. A hand-written wrapper
  // outside the slot system is regularly the first element (Tooltip,
  // CitationChip), which is why position alone would measure the wrong element.
  const probedRoot = painted.find((element) =>
    [...element.classList].some((token) => token.startsWith('pa-'))
  );
  const probeRootTokens = new Set(
    probedRoot ? [...probedRoot.classList].filter((token) => !token.startsWith('pa-')) : []
  );
  // The settled call: a component may resolve more than once while mounting.
  const condition = recorder.calls
    .filter((call) => call.component === entry.providerName)
    .at(-1)?.activeProps;

  unmount(app);
  document.body.innerHTML = '';
  return { tokens, rootTokens, probeRootTokens, rendered, condition };
}

function measure(entry: CascadeComponent, withFixture = true): Measurement {
  const routes: Record<Route, Outcome> = {
    A: { ok: false, detail: 'not run' },
    B: { ok: false, detail: 'not run' },
    C: { ok: false, detail: 'not run' }
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

  // ── A: an unconditional `slotClasses` entry reaches the markup ──
  let probed: MountResult | undefined;
  if (!slotProbes) {
    routes.A = { ok: false, detail: 'no provider name — `defaults` cannot address this component' };
  } else {
    probed = mountOnce(entry, slotProbes, withFixture);
    const landed = [...probed.tokens].filter((t) => t.startsWith('pa-'));
    routes.A = landed.length
      ? { ok: true, detail: `${landed.length}/${entry.slots.length} slots landed` }
      : { ok: false, detail: `no slot of {${entry.slots.join(', ')}} reached any element` };
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

  // ── C: provider `unstyled` drops the root slot's library classes ──
  // Scoped to one element on purpose: token strings repeat across the library
  // (`inline-flex`, `items-center`), so a subtree-wide comparison reports a
  // *neighbour's* surviving class as this component's failure.
  if (routes.A.ok && slotProbes && probed) {
    // The slot probes ride along so the same element is identifiable in both
    // mounts, and only the tv() configs' own tokens count — a hand-written
    // class on that element is not `unstyled`'s to remove.
    const styled = [...probed.probeRootTokens].filter((t) => entry.libraryTokens.has(t));
    if (styled.length === 0) {
      routes.C = { ok: false, detail: 'root slot carries no library class — nothing to strip' };
    } else {
      const stripped = mountOnce(entry, { ...slotProbes, unstyled: true }, withFixture);
      const survivors = styled.filter((t) => stripped.probeRootTokens.has(t));
      routes.C = survivors.length
        ? {
            ok: false,
            detail: `${survivors.length}/${styled.length} library classes survive \`unstyled\`: ${survivors.slice(0, 6).join(' ')}`
          }
        : { ok: true, detail: `${styled.length} library classes dropped` };
    }
  } else {
    // No provider name means no probe to find the root slot with, so the
    // outermost element stands in and every surviving class counts: a
    // component the provider cannot address has no styling it may keep.
    const stripped = mountOnce(entry, { unstyled: true }, withFixture);
    const survivors = [...plain.rootTokens].filter((t) => stripped.rootTokens.has(t));
    routes.C = survivors.length
      ? {
          ok: false,
          detail: `${survivors.length}/${plain.rootTokens.size} root classes survive \`unstyled\`: ${survivors.slice(0, 6).join(' ')}`
        }
      : { ok: true, detail: `${plain.rootTokens.size} root classes dropped` };
  }

  return { entry, routes };
}

// A component that declares `unstyled` has claimed the styling contract, and
// that claim — not a hand-written roster — is what puts it in the sweep.
const components = (await exportedComponents()).filter((entry) =>
  entry.declaredProps.includes('unstyled')
);
const measurements = components.map((entry) => measure(entry));

describe('BlocksProvider cascade reaches the markup', () => {
  it('measures enough components to be worth reading', () => {
    const measured = measurements.filter((m) => !m.mountError);
    expect(
      measured.length,
      `only ${measured.length} of ${measurements.length} components were measured — a sweep ` +
        'this small means a broken registry, not a healthy library'
    ).toBeGreaterThanOrEqual(MIN_MEASURED);
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

  it('lists no entry for a component the sweep does not know', () => {
    const known = new Set(components.map((entry) => entry.exportName));
    const stale = [
      ...Object.keys(KNOWN_GAPS),
      ...Object.keys(NOT_MEASURABLE),
      ...Object.keys(MOUNT_FIXTURES)
    ].filter((name) => !known.has(name));
    expect(
      stale,
      `entries for components the sweep no longer sees — delete them:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });

  it('needs every mount fixture it carries', () => {
    // A fixture earns its place by changing an answer: without it the
    // component must fail to mount, or measure differently. Anything else is
    // dead weight — the contract `imports-lint` puts on its own allowlist.
    const unnecessary: string[] = [];
    for (const name of Object.keys(MOUNT_FIXTURES)) {
      const fixtured = measurements.find((m) => m.entry.exportName === name);
      if (!fixtured) continue;
      let bare: Measurement;
      try {
        bare = measure(fixtured.entry, false);
      } catch {
        continue; // throwing without the fixture is what makes it necessary
      }
      if (bare.mountError) continue;
      const changed = (['A', 'B', 'C'] as Route[]).some(
        (route) =>
          fixtured.routes[route].ok !== bare.routes[route].ok ||
          fixtured.routes[route].detail !== bare.routes[route].detail
      );
      if (!changed) unnecessary.push(name);
    }
    expect(
      unnecessary,
      `MOUNT_FIXTURES entries that change no answer — delete them:\n  ${unnecessary.join('\n  ')}`
    ).toEqual([]);
  });
});

const ROUTE_TITLE: Record<Route, string> = {
  A: 'A — `defaults.slotClasses` reaches the markup',
  B: 'B — a conditional `overrides` rule reaches the markup',
  C: 'C — provider `unstyled` drops the root slot’s library classes'
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

    for (const route of ['A', 'B', 'C'] as Route[]) {
      const gap = KNOWN_GAPS[name]?.[route];
      it.skipIf(notMeasurable || measurement.mountError)(ROUTE_TITLE[route], () => {
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
