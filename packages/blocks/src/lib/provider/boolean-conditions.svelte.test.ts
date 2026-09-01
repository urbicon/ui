// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { effectiveVariants } from '$lib/utils/variants';
import CascadeCompoundHost from './__fixtures__/CascadeCompoundHost.svelte';
import CascadeHost from './__fixtures__/CascadeHost.svelte';
import { MOUNT_FIXTURES, type MountFixture } from './__fixtures__/cascade-mount-props';
import { type CascadeComponent, exportedComponents } from './__fixtures__/cascade-registry';

/**
 * One house rule, registered once, landing everywhere: `overrides: [{ disabled:
 * true, … }]` on a provider has to reach **every** component that has a
 * `disabled` state, and `{ disabled: false }` has to reach every component that
 * is currently *not* disabled. The same for `readonly` and `error`.
 *
 * The sweep in `provider-cascade.svelte.test.ts` cannot answer this. Its route B
 * builds one rule out of the *whole* condition object, and `matchesCompound` is
 * satisfied by any non-empty subset of it — so a component whose `disabled` is
 * individually unmatchable still passes B on its other axes. This file asks the
 * one question B folds away: does a rule keyed on **this axis alone** fire?
 *
 * Both sides of the boolean are asserted, and the `false` side is the one that
 * used to fail: a component carrying `disabled: disabled || undefined` handed
 * the resolver no usable `disabled` at all when it was not disabled, so a rule
 * keyed on `false` could never match. It can now, because the axes below carry
 * their raw value and because {@link effectiveVariants} answers a key written
 * as `undefined` with that axis's default.
 *
 * The last two rows are the fold's own witnesses, and they are here because
 * nothing else in this file reaches it: with every boolean axis carrying a raw
 * `false`, the rows above pass with the fold reverted to `matchProps =
 * activeProps` — measured.
 *
 * What it does not measure: whether the classes the rule carries are the ones
 * that paint. This is a class-attribute assertion in jsdom, like every other
 * route in the cascade sweep.
 */

/** The props a consumer expects to be able to key a house rule on. */
const BOOLEAN_PROPS = ['disabled', 'readonly', 'error'] as const;
type BooleanProp = (typeof BOOLEAN_PROPS)[number];

/** Probe token for the rule under test — no library config emits it. */
const PROBE = 'bc-rule';

/**
 * Why a pair cannot arrive. The kind is **checked against the component's own
 * `tv()` config**, captured from the running call — so an entry whose prose and
 * whose code disagree fails here rather than sitting and being believed. That
 * is not hypothetical: `SegmentItem` carried "no `disabled` axis" while
 * `segmentGroupVariants` declared one, and what the entry was really recording
 * was a defect.
 */
type GapKind =
  /** The config declares no axis of that name — the state is styled by a CSS
   *  variant (`disabled:opacity-50`), which needs no variant branch. */
  | 'no-axis'
  /**
   * The axis exists but is handed to a slot function per row/element, so no
   * component-level object can carry it for one row without claiming it of all
   * of them.
   *
   * **The one kind the check cannot fully verify.** Two of its three halves are
   * measured — the config declares the axis, and the component's condition
   * object does not carry it — but "and it is passed at a slot call instead" is
   * not observable from the wrapped `resolveSlotClasses` call: that argument
   * goes to a `tv()` slot function this harness never sees. So a component that
   * declared the axis and simply forgot to name it would also satisfy this
   * kind. That is the `SegmentItem` shape, which was a real defect; if a second
   * entry ever appears here, read the component before believing it.
   */
  | 'per-slot-call'
  /** The component has no provider name, so `overrides` cannot address it. */
  | 'no-provider-name';

interface Gap {
  kind: GapKind;
  why: string;
}

/**
 * Pairs that cannot arrive today. An entry asserts that **neither** side fires,
 * so closing the gap without deleting the entry is an error — the contract
 * `imports-lint`, `examples-lint` and the cascade sweep share. Neither, not
 * "not both": a pair where exactly one side fires is a working axis with one
 * value unreachable, which is a defect and not a gap.
 *
 * Giving a component an axis purely to be addressable would add a branch no
 * stylesheet needs — `variants:lint` hunts exactly those — so these are listed
 * rather than repaired, and *adding* such an axis or dropping the prop has to
 * come past this file.
 */
const KNOWN_GAPS: Record<string, Partial<Record<BooleanProp, Gap>>> = {
  Accordion: {
    disabled: { kind: 'no-axis', why: 'the item dims via the `disabled:` CSS variant' }
  },
  AccordionItem: { disabled: { kind: 'no-axis', why: 'dims via the `disabled:` CSS variant' } },
  Button: { disabled: { kind: 'no-axis', why: 'dims via the `disabled:` CSS variant' } },
  Calendar: { disabled: { kind: 'no-axis', why: 'disabled days dim via `dayState`' } },
  Collapsible: { disabled: { kind: 'no-axis', why: 'dims via the `disabled:` CSS variant' } },
  CopyButton: { disabled: { kind: 'no-axis', why: 'forwarded to the Button it wraps' } },
  // One cause, one entry per prop: without a provider name neither rule can be
  // addressed at all, whatever the config says.
  FormField: {
    disabled: { kind: 'no-provider-name', why: 'a rule goes under the field it wraps' },
    error: { kind: 'no-provider-name', why: 'a rule goes under the field it wraps' }
  },
  Menu: {
    disabled: {
      kind: 'per-slot-call',
      why: '`ctx.styles.item({ disabled })` per row — it says "this row", not "this menu"'
    }
  },
  PaginationItem: {
    disabled: { kind: 'no-provider-name', why: 'a rule for these buttons goes under `Button`' }
  },
  // A disabled *day* is a `dayState` value passed per cell, not this prop.
  Planner: { disabled: { kind: 'no-axis', why: 'a disabled day is a `dayState` value, per cell' } },
  PromptInput: { disabled: { kind: 'no-axis', why: 'dims via the `disabled:` CSS variant' } },
  // Its own config header says so: cell state is conditional classes in the
  // markup rather than boolean variants, driven by `isCellDisabled()`.
  ResourceTimeline: {
    disabled: { kind: 'no-axis', why: 'cell state is conditional classes in the markup' }
  },
  Tab: { disabled: { kind: 'no-axis', why: 'dims via the `disabled:` CSS variant' } },
  TabItem: { disabled: { kind: 'no-axis', why: 'dims via the `disabled:` CSS variant' } },
  Tooltip: {
    disabled: { kind: 'no-axis', why: '`disabled` suppresses the tip, it does not style it' }
  }
};

/** Components the harness cannot mount at all, with the reason. Stale = error. */
const NOT_MOUNTABLE: Record<string, string> = {
  MenuItem: 'throws without the Menu context a plain mount cannot supply',
  MenuSubmenu: 'throws without the Menu context a plain mount cannot supply'
};

const recorder = vi.hoisted(() => ({
  calls: [] as { component: string; activeProps: Record<string, unknown>; axes: string[] }[]
}));

// The condition object never leaves the component otherwise — same wrap the
// cascade sweep uses, and for the same reason: its keys and values are only
// exact at the call itself.
vi.mock('$lib/provider', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/provider')>();
  return {
    ...original,
    resolveSlotClasses: (
      ...args: Parameters<typeof original.resolveSlotClasses>
    ): ReturnType<typeof original.resolveSlotClasses> => {
      // The props the resolver matches on — config defaults folded under the
      // component's own bag — so a failure message names what a rule was
      // actually tested against.
      recorder.calls.push({
        component: args[1],
        activeProps: effectiveVariants(args[5], args[3]),
        // The component's own config, so a KNOWN_GAPS entry claiming "no such
        // axis" can be checked against the config instead of believed.
        axes: Object.keys(args[5].variants ?? {})
      });
      return original.resolveSlotClasses(...args);
    }
  };
});

interface MountOutcome {
  /** Every class token in the rendered markup. */
  tokens: Set<string>;
  /** The condition object the component handed the resolver, if it ran. */
  condition: Record<string, unknown> | undefined;
  /** Axis names the component's own `tv()` config declares. */
  axes: string[];
  error?: string;
}

function mountWith(
  entry: CascadeComponent,
  extraProps: Record<string, unknown>,
  providerProps: Record<string, unknown>
): MountOutcome {
  const fixture: MountFixture = MOUNT_FIXTURES[entry.exportName] ?? {};
  const props: Record<string, unknown> = { ...fixture.props, ...extraProps };
  if (entry.declaredProps.includes('children') && !('children' in props)) {
    props.children = createRawSnippet(() => ({ render: () => '<span>content</span>' }));
  }
  document.body.replaceChildren();
  const target = document.createElement('div');
  document.body.appendChild(target);
  recorder.calls.length = 0;

  try {
    if (fixture.family) {
      mount(CascadeCompoundHost, {
        target,
        props: {
          family: fixture.family,
          tour: fixture.tour ?? false,
          component: entry.component,
          props,
          ...providerProps
        }
      });
    } else {
      mount(CascadeHost, {
        target,
        props: { component: entry.component, props, ...providerProps }
      });
    }
    // Dialog, Drawer and CommandPalette gate their markup on an `$effect` that
    // runs after `mount` returns.
    flushSync();
  } catch (error) {
    return { tokens: new Set(), condition: undefined, axes: [], error: (error as Error).message };
  }

  const tokens = new Set<string>();
  for (const element of target.querySelectorAll('*')) {
    for (const token of element.classList) tokens.add(token);
  }
  const call = recorder.calls.find((c) => c.component === entry.providerName);
  return { tokens, condition: call?.activeProps, axes: call?.axes ?? [] };
}

/**
 * Does a rule keyed on `prop: value` alone reach the markup of a component
 * mounted in that state? The rule paints every slot the component has, so a
 * component whose root is not the slot under test still answers.
 */
function ruleArrives(
  entry: CascadeComponent,
  prop: BooleanProp,
  value: boolean
): { ok: boolean; detail: string } {
  const name = entry.providerName;
  if (!name) return { ok: false, detail: 'no provider name — `overrides` cannot address it' };

  const rule = { [prop]: value, class: Object.fromEntries(entry.slots.map((s) => [s, PROBE])) };
  const run = mountWith(entry, { [prop]: value }, { defaults: { [name]: { overrides: [rule] } } });
  if (run.error) return { ok: false, detail: `mount threw: ${run.error}` };
  if (run.condition === undefined) {
    return { ok: false, detail: `resolveSlotClasses never ran for "${name}"` };
  }
  if (run.tokens.has(PROBE)) return { ok: true, detail: `{ ${prop}: ${value} } matched` };

  const carried = prop in run.condition ? JSON.stringify(run.condition[prop]) : 'no such key';
  return {
    ok: false,
    detail: `{ ${prop}: ${value} } reached no element — the condition object carries ${carried}`
  };
}

const exported = await exportedComponents();

/** Every (component, prop) pair a consumer can reasonably expect to key on. */
const PAIRS = exported.flatMap((entry) =>
  BOOLEAN_PROPS.filter((prop) => entry.declaredProps.includes(prop)).map((prop) => ({
    entry,
    prop
  }))
);

describe('a boolean house rule reaches every component that takes the prop', () => {
  it('measures a non-trivial roster', () => {
    // A roster that silently collapsed to nothing would make every row below
    // vacuous. The floor is the count at the time of writing, minus room to
    // remove a prop; it is a smoke check, not a pinned number.
    expect(PAIRS.length).toBeGreaterThan(40);
  });

  it('lists no NOT_MOUNTABLE entry that mounts now', () => {
    const stale = Object.keys(NOT_MOUNTABLE).filter((name) => {
      const entry = exported.find((e) => e.exportName === name);
      return entry && !mountWith(entry, {}, {}).error;
    });
    expect(stale, 'NOT_MOUNTABLE entries that mount now — delete them').toEqual([]);
  });

  it('names only components that exist', () => {
    const known = new Set(exported.map((e) => e.exportName));
    const unknown = [...Object.keys(KNOWN_GAPS), ...Object.keys(NOT_MOUNTABLE)].filter(
      (name) => !known.has(name)
    );
    expect(unknown, 'entries naming a component the package no longer exports').toEqual([]);
  });

  it('lists no KNOWN_GAPS pair that is not measured at all', () => {
    const measured = new Set(PAIRS.map(({ entry, prop }) => `${entry.exportName}.${prop}`));
    const unmeasured: string[] = [];
    for (const [name, props] of Object.entries(KNOWN_GAPS)) {
      for (const prop of Object.keys(props)) {
        if (!measured.has(`${name}.${prop}`)) unmeasured.push(`${name}.${prop}`);
      }
    }
    expect(
      unmeasured,
      'KNOWN_GAPS pairs whose component no longer declares the prop, so the entry asserts nothing'
    ).toEqual([]);
  });

  // ── The fold itself, both directions ────────────────────────────────────
  //
  // The rows above do not reach it. Once every boolean axis carries its raw
  // value, the key is present *and* the value is `false`, so they pass with the
  // fold reverted to `matchProps = activeProps` — measured. These two do reach
  // it, and they are the pair that defines it: a key the component wrote as
  // `undefined` takes the config default, a key it never wrote takes nothing.
  it('fills in an axis the component names but left undefined', () => {
    // `Card` writes `dividers: dividers || undefined`, and `cardVariants`
    // defaults `dividers: false`. The key is the component's claim to the axis;
    // the default answers for it. Revert the fold and this row goes red.
    const card = exported.find((e) => e.exportName === 'Card') as CascadeComponent;
    const run = mountWith(
      card,
      {},
      { defaults: { Card: { overrides: [{ dividers: false, class: { base: PROBE } }] } } }
    );
    expect(
      run.tokens.has(PROBE),
      `{ dividers: false } reached no element of a Card — it carries ${JSON.stringify(
        run.condition?.dividers
      )}`
    ).toBe(true);
  });

  it('fills in nothing for an axis the component never names', () => {
    // `SegmentItem` shares `segmentGroupVariants` with `SegmentGroup`, which is
    // where `fullWidth` belongs — the item never writes the key. Folding the
    // config's `fullWidth: false` in would hand the item its parent's axis, and
    // a rule keyed on it would paint every item of every group. This is the row
    // that goes red if the fold ever iterates the config instead of the keys.
    const item = exported.find((e) => e.exportName === 'SegmentItem') as CascadeComponent;
    const run = mountWith(
      item,
      {},
      { defaults: { SegmentItem: { overrides: [{ fullWidth: false, class: { item: PROBE } }] } } }
    );
    expect(
      run.tokens.has(PROBE),
      "{ fullWidth: false } fired on a SegmentItem — `fullWidth` is SegmentGroup's axis, and " +
        'the item never names it, so no rule may claim it here'
    ).toBe(false);
    // Without this the row above would also pass if the mount rendered nothing.
    expect(run.condition, 'the item resolved no slot classes at all').toBeDefined();
  });

  for (const { entry, prop } of PAIRS) {
    const name = entry.exportName;
    const gap = KNOWN_GAPS[name]?.[prop];
    const skip = NOT_MOUNTABLE[name];

    (skip ? it.skip : it)(`${name}: a rule on \`${prop}\` fires on both sides`, () => {
      const onTrue = ruleArrives(entry, prop, true);
      const onFalse = ruleArrives(entry, prop, false);

      if (gap) {
        // The entry claims the pair cannot arrive at all. `||`, not `&&`: with
        // `&&` an entry also passes when exactly ONE side fires, which is not a
        // gap but a half-working axis — the shape `SegmentItem` sat in.
        expect(
          onTrue.ok || onFalse.ok,
          `${name}.${prop} is listed in KNOWN_GAPS (${gap.kind}: ${gap.why}) but a rule fires ` +
            `now (true: ${onTrue.ok}, false: ${onFalse.ok}) — delete the entry`
        ).toBe(false);

        // And the stated reason has to be the real one. Measured from the
        // config the component handed the resolver, so prose cannot drift.
        const axes = mountWith(entry, {}, {}).axes;
        if (gap.kind === 'no-axis') {
          expect(
            axes,
            `${name}.${prop} claims "no-axis", but its tv() config declares \`${prop}\``
          ).not.toContain(prop);
        } else if (gap.kind === 'per-slot-call') {
          expect(
            axes,
            `${name}.${prop} claims "per-slot-call", but its tv() config declares no \`${prop}\` ` +
              `axis at all — that is a "no-axis" entry`
          ).toContain(prop);
          // The other observable half: the component must not carry the axis
          // itself. Without this the kind says only "the config has it", which
          // is also true of a component that names it and works.
          expect(
            Object.keys(mountWith(entry, {}, {}).condition ?? {}),
            `${name}.${prop} claims "per-slot-call", but the component's own condition object ` +
              `carries \`${prop}\` — then a rule on it can match and this is not a gap`
          ).not.toContain(prop);
        } else {
          expect(
            entry.providerName,
            `${name}.${prop} claims "no-provider-name", but it has one (${entry.providerName})`
          ).toBeNull();
        }
        return;
      }

      expect(onTrue.ok, `${name} with \`${prop}\` set: ${onTrue.detail}`).toBe(true);
      expect(onFalse.ok, `${name} with \`${prop}={false}\`: ${onFalse.detail}`).toBe(true);
    });
  }
});
