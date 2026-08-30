// @vitest-environment jsdom
import type { Component } from 'svelte';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CurrencyInput from '$lib/components/CurrencyInput/CurrencyInput.svelte';
import LocaleSwitcher from '$lib/components/LocaleSwitcher/LocaleSwitcher.svelte';
import NumberInput from '$lib/components/NumberInput/NumberInput.svelte';
import ConfirmDialog from '$lib/primitives/ConfirmDialog/ConfirmDialog.svelte';
import Dialog from '$lib/primitives/Dialog/Dialog.svelte';
import { dialogVariants } from '$lib/primitives/Dialog/dialog.variants';
import Input from '$lib/primitives/Input/Input.svelte';
import { inputVariants } from '$lib/primitives/Input/input.variants';
import Select from '$lib/primitives/Select/Select.svelte';
import { selectVariants } from '$lib/primitives/Select/select.variants';
import type { TVConfig } from '$lib/utils/variants';
import PresetScopeHost from './__fixtures__/PresetScopeHost.svelte';
import type { PresetMap } from './blocks-context';

/**
 * Under which name does a wrapper resolve its `preset`, and against which
 * props are that preset's `overrides` rules matched?
 *
 * These four are thin wrappers around a component that owns the styling
 * contract. Left in the rest spread, `preset` would be resolved inside that
 * component, under *its* name — so a preset written for the number field styles
 * every Input under the provider, and the DEV warning for an unregistered name
 * names a component the consumer never typed. Resolving it in the wrapper
 * instead costs the inner component's defaults: the wrapper sees only what its
 * caller wrote, so a rule keyed on an axis the caller left out matches nothing
 * unless `wrapperActiveProps` fills it in. All three are asserted here.
 *
 * The neighbouring plain `<Input preset="compact">` / `<Select …>` in the host
 * is what makes the scope half falsifiable — with only the wrapper mounted,
 * "the preset arrived" and "the preset arrived everywhere" look the same.
 */

const PROBE = 'preset-probe';

interface Case {
  /** The key a consumer would type, having written the preset for this component. */
  own: string;
  /** The component it wraps, whose name the preset used to resolve under. */
  inner: string;
  component: unknown;
  props: Record<string, unknown>;
  /** A plain instance of the wrapped component, to catch a preset firing too wide. */
  neighbour: unknown;
  neighbourProps: Record<string, unknown>;
  /** A slot both the wrapper's inner component and the neighbour paint. */
  slot: string;
  /** The wrapped component's tv() config — the source of the defaults under test. */
  innerConfig: TVConfig;
  /**
   * An axis this wrapper leaves to the inner component's default, with that
   * default's value: the `overrides` rule that only fires if the defaults are
   * filled in. Read off `innerConfig` in the assertion, so a moved default
   * moves the expectation with it.
   */
  defaultedAxis: string;
}

const SELECT_OPTIONS = { options: [{ label: 'A', value: 'a' }] };
/** Dialog renders its body through `children` and throws without one. */
const DIALOG_BODY = createRawSnippet(() => ({ render: () => '<p>body</p>' }));

const CASES: Case[] = [
  {
    own: 'NumberInput',
    inner: 'Input',
    component: NumberInput,
    props: {},
    neighbour: Input,
    neighbourProps: {},
    slot: 'base',
    innerConfig: inputVariants.config,
    defaultedAxis: 'size'
  },
  {
    own: 'CurrencyInput',
    inner: 'Input',
    component: CurrencyInput,
    props: {},
    neighbour: Input,
    neighbourProps: {},
    slot: 'base',
    innerConfig: inputVariants.config,
    defaultedAxis: 'variant'
  },
  {
    own: 'ConfirmDialog',
    inner: 'Dialog',
    component: ConfirmDialog,
    props: { open: true, title: 'Delete?' },
    neighbour: Dialog,
    neighbourProps: { open: true, title: 'Neighbour', children: DIALOG_BODY },
    slot: 'panel',
    innerConfig: dialogVariants.config,
    defaultedAxis: 'placement'
  },
  {
    own: 'LocaleSwitcher',
    inner: 'Select',
    component: LocaleSwitcher,
    props: {},
    neighbour: Select,
    neighbourProps: SELECT_OPTIONS,
    slot: 'trigger',
    innerConfig: selectVariants.config,
    // `variant` and `size` are LocaleSwitcher's own answer for Select; `tier`
    // is the one it leaves alone.
    defaultedAxis: 'tier'
  }
];

interface Run {
  /** The component name each `[BlocksProvider]` preset warning carried. */
  warnedFor: string[];
  /** Elements inside the component under test carrying the preset's probe class. */
  carriers: number;
  /** The same count for the plain inner component standing next to it. */
  neighbourCarriers: number;
}

const WARNED_COMPONENT = /Preset "[^"]+" for component "([^"]+)"/;

function run(entry: Case, presets: PresetMap): Run {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  document.body.innerHTML = '';
  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(PresetScopeHost, {
    target,
    props: {
      component: entry.component as Component<Record<string, unknown>>,
      props: { ...entry.props, preset: 'compact' },
      neighbour: entry.neighbour as Component<Record<string, unknown>>,
      neighbourProps: entry.neighbourProps,
      presets
    }
  });
  flushSync();
  const inScope = (scope: string) =>
    target.querySelector(`[data-scope="${scope}"]`)?.querySelectorAll(`.${PROBE}`).length ?? -1;
  const carriers = inScope('wrapper');
  const neighbourCarriers = inScope('neighbour');
  const warnedFor = warn.mock.calls
    .map((call) => WARNED_COMPONENT.exec(String(call[0]))?.[1])
    .filter((name): name is string => name !== undefined);
  warn.mockRestore();
  unmount(app);
  document.body.innerHTML = '';
  return { warnedFor, carriers, neighbourCarriers };
}

const withSlotClasses = (component: string, slot: string): PresetMap => ({
  [component]: { compact: { slotClasses: { [slot]: PROBE } } }
});

const withOverride = (
  component: string,
  slot: string,
  condition: Record<string, unknown>
): PresetMap => ({
  [component]: { compact: { overrides: [{ ...condition, class: { [slot]: PROBE } }] } }
});

describe.each(CASES.map((entry) => [entry.own, entry] as const))('%s', (_name, entry) => {
  beforeEach(() => {
    // The warning is DEV- and browser-gated; without both, the name half of
    // this file asserts nothing and would pass on an empty array.
    expect(import.meta.env.DEV).toBe(true);
    expect(typeof window).not.toBe('undefined');
  });

  it(`resolves its preset under \`${_name}\`, not \`${entry.inner}\``, () => {
    const { warnedFor, carriers } = run(entry, withSlotClasses(entry.own, entry.slot));
    expect(
      warnedFor.includes(entry.own),
      `a preset registered under "${entry.own}" must resolve without a warning`
    ).toBe(false);
    expect(carriers, `the preset reached no element of the ${entry.own}`).toBe(1);
  });

  it(`does not take a preset registered under \`${entry.inner}\``, () => {
    const { warnedFor, carriers, neighbourCarriers } = run(
      entry,
      withSlotClasses(entry.inner, entry.slot)
    );
    expect(carriers, `a preset registered under "${entry.inner}" reached the ${entry.own}`).toBe(0);
    expect(
      warnedFor,
      `the unregistered-preset warning must name "${entry.own}" — the key the consumer types — ` +
        `not "${entry.inner}"`
    ).toContain(entry.own);
    // The other side of the same claim: `presets.${entry.inner}` is not broken,
    // it has simply stopped being the wrapper's namespace. Without this the row
    // above would also pass if the inner component's preset lookup were deleted.
    expect(
      neighbourCarriers,
      `the plain ${entry.inner} next to it lost its own preset`
    ).toBeGreaterThanOrEqual(1);
  });

  it('matches an `overrides` rule on an axis the caller left to the inner default', () => {
    // The shape `packages/blocks/README.md` documents. The wrapper never sees
    // this axis — the caller wrote nothing and the default lives in the inner
    // component — so without `wrapperActiveProps` the rule matches nothing.
    const axis = entry.defaultedAxis;
    const value = entry.innerConfig.defaultVariants?.[axis];
    expect(value, `\`${axis}\` has no default on ${entry.inner} to test against`).toBeDefined();
    const { carriers } = run(entry, withOverride(entry.own, entry.slot, { [axis]: value }));
    expect(
      carriers,
      `an \`overrides\` rule on { ${axis}: ${JSON.stringify(value)} } — ${entry.inner}'s own ` +
        `default, which the caller did not write — reached no element of the ${entry.own}`
    ).toBe(1);
  });

  it.skipIf(!('disabled' in (entry.innerConfig.variants ?? {})))(
    'keeps `{ disabled: false }` from firing, the way the primitives do',
    () => {
      // `ConditionalOverride` documents that a boolean axis a component carries
      // as `undefined` matches only its `true` side. A wrapper that filled the
      // axis with the config's literal `false` default would make one rule fire
      // under its name and not under the inner component's.
      const { carriers, neighbourCarriers } = run(
        entry,
        withOverride(entry.own, entry.slot, { disabled: false })
      );
      expect(
        carriers,
        `{ disabled: false } fired on the ${entry.own} — it fires on no primitive`
      ).toBe(0);
      expect(neighbourCarriers, 'the neighbour is unrelated to this rule').toBe(0);
    }
  );
});
