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
 * used to fail: a component that carried `disabled: disabled || undefined`
 * handed the resolver no `disabled` at all when it was not disabled, while
 * `tv()` styled it as `disabled: false` out of its own `defaultVariants`. The
 * two now read the same fold (`effectiveVariants`), which is what makes the
 * `false` row assertable at all rather than a second spelling of the `true` row.
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
 * Pairs that cannot arrive today, each with the reason. An entry asserts the
 * pair **fails**, so closing the gap without deleting the entry is an error —
 * the contract `imports-lint`, `examples-lint` and the cascade sweep share.
 *
 * Every entry here is one shape: the component takes the prop, but its `tv()`
 * config declares no axis of that name, because it dims/marks through a CSS
 * variant (`disabled:opacity-50`, `aria-[invalid]:…`) rather than a variant
 * branch. A rule keyed on the prop has nothing to select, and giving these an
 * axis purely to be addressable would add a branch no stylesheet needs —
 * `variants:lint` hunts exactly those. They are listed rather than derived so
 * that *adding* such an axis, or dropping the prop, has to come past this file.
 */
const KNOWN_GAPS: Record<string, Partial<Record<BooleanProp, string>>> = {
  Accordion: { disabled: 'no `disabled` axis — the item dims via the `disabled:` CSS variant' },
  AccordionItem: { disabled: 'no `disabled` axis — dims via the `disabled:` CSS variant' },
  Button: { disabled: 'no `disabled` axis — dims via the `disabled:` CSS variant' },
  Calendar: { disabled: 'no `disabled` axis — disabled days dim via `dayState`' },
  Collapsible: { disabled: 'no `disabled` axis — dims via the `disabled:` CSS variant' },
  CopyButton: { disabled: 'no `disabled` axis — forwarded to the Button it wraps' },
  FormField: {
    disabled: '`formFieldVariants` declares no axes at all',
    error: 'no provider name — a rule goes under the field it wraps'
  },
  // `menuVariants.disabled` writes the `item` slot and is passed at the
  // per-item slot call (`ctx.styles.item({ disabled })`), not per component —
  // so it says "this row is disabled", which a component-level condition
  // object cannot carry without claiming it of every row.
  Menu: { disabled: '`disabled` is a per-item slot-call axis, not a menu-level one' },
  PaginationItem: { disabled: 'no provider name — a rule for these buttons goes under `Button`' },
  Planner: { disabled: 'no `disabled` axis — dims via the `disabled:` CSS variant' },
  PromptInput: { disabled: 'no `disabled` axis — dims via the `disabled:` CSS variant' },
  ResourceTimeline: { disabled: 'no `disabled` axis — dims via the `disabled:` CSS variant' },
  SegmentItem: { disabled: 'no `disabled` axis — dims via the `disabled:` CSS variant' },
  Tab: { disabled: 'no `disabled` axis — dims via the `disabled:` CSS variant' },
  TabItem: { disabled: 'no `disabled` axis — dims via the `disabled:` CSS variant' },
  Tooltip: { disabled: 'no `disabled` axis — `disabled` suppresses the tip, it does not style it' }
};

/** Components the harness cannot mount at all, with the reason. Stale = error. */
const NOT_MOUNTABLE: Record<string, string> = {
  MenuItem: 'throws without the Menu context a plain mount cannot supply',
  MenuSubmenu: 'throws without the Menu context a plain mount cannot supply'
};

const recorder = vi.hoisted(() => ({
  calls: [] as { component: string; activeProps: Record<string, unknown> }[]
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
        activeProps: effectiveVariants(args[5], args[3])
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
    return { tokens: new Set(), condition: undefined, error: (error as Error).message };
  }

  const tokens = new Set<string>();
  for (const element of target.querySelectorAll('*')) {
    for (const token of element.classList) tokens.add(token);
  }
  const call = recorder.calls.find((c) => c.component === entry.providerName);
  return { tokens, condition: call?.activeProps };
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

  for (const { entry, prop } of PAIRS) {
    const name = entry.exportName;
    const gap = KNOWN_GAPS[name]?.[prop];
    const skip = NOT_MOUNTABLE[name];

    (skip ? it.skip : it)(`${name}: a rule on \`${prop}\` fires on both sides`, () => {
      const onTrue = ruleArrives(entry, prop, true);
      const onFalse = ruleArrives(entry, prop, false);

      if (gap) {
        // The entry claims the pair cannot arrive. Prove it still cannot —
        // a gap that has closed has to be deleted, not left standing.
        expect(
          onTrue.ok && onFalse.ok,
          `${name}.${prop} is listed in KNOWN_GAPS (${gap}) but both sides fire now — delete the entry`
        ).toBe(false);
        return;
      }

      expect(onTrue.ok, `${name} with \`${prop}\` set: ${onTrue.detail}`).toBe(true);
      expect(onFalse.ok, `${name} with \`${prop}={false}\`: ${onFalse.detail}`).toBe(true);
    });
  }
});
