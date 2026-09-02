// @vitest-environment jsdom
import type { Component } from 'svelte';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CurrencyInput from '$lib/components/CurrencyInput/CurrencyInput.svelte';
import LocaleSwitcher from '$lib/components/LocaleSwitcher/LocaleSwitcher.svelte';
import NumberInput from '$lib/components/NumberInput/NumberInput.svelte';
import ConfirmDialog from '$lib/primitives/ConfirmDialog/ConfirmDialog.svelte';
import Dialog from '$lib/primitives/Dialog/Dialog.svelte';
import Input from '$lib/primitives/Input/Input.svelte';
import Select from '$lib/primitives/Select/Select.svelte';
import WrapperCascadeHost from './__fixtures__/WrapperCascadeHost.svelte';
import type { ComponentDefaults, PresetMap } from './blocks-context';

/**
 * In which **order** do the rungs of a wrapper's cascade land on the element?
 *
 * `resolveClassChain` appends each source after the one before it, stripping
 * only what collides per Tailwind bucket — so a marker class that collides with
 * nothing survives every rung, and the rendered `class` attribute spells the
 * fold order out left to right. That is the measurement here: nine rungs, nine
 * markers, one string.
 *
 * The order under test, weakest first:
 *
 *     Input.defaults → Input.defaults.overrides
 *       → Input.preset → Input.preset.overrides
 *       → [ NumberInput.defaults → NumberInput.defaults.overrides
 *           → NumberInput.preset → NumberInput.preset.overrides
 *           → NumberInput.instance slotClasses ]
 *
 * Two of those rungs are unreachable *inside* a wrapper on purpose and the
 * matrix asserts their absence: a wrapper forwards no `preset`, so the inner
 * component's own preset rungs stay empty there while the plain instance
 * standing beside it takes them. That is the scope claim — a preset written
 * for the number field must not dress every text field — read off the same
 * string as the order claim.
 *
 * Each `overrides` rule is keyed on an axis the wrapper and the component it
 * wraps agree on (the inner config's default, or the value the wrapper writes),
 * so this file measures the fold and not which state a rule is matched
 * against — `wrapper-axes.svelte.test.ts` is where that question lives.
 */

const MARKER = /^zz[wn]\d$/;

/** Wrapper rungs, weakest to strongest. */
const W = ['zzw1', 'zzw2', 'zzw3', 'zzw4', 'zzw5'] as const;
/** Inner-name rungs, weakest to strongest. */
const N = ['zzn1', 'zzn2', 'zzn3', 'zzn4', 'zzn5'] as const;

interface Case {
  wrapper: string;
  inner: string;
  component: unknown;
  props: Record<string, unknown>;
  neighbour: unknown;
  neighbourProps: Record<string, unknown>;
  /** A slot both the wrapper's inner component and the plain neighbour paint. */
  slot: string;
  /** An axis both sides answer the same way, so the `overrides` rungs match. */
  condition: Record<string, unknown>;
}

const DIALOG_BODY = createRawSnippet(() => ({ render: () => '<p>body</p>' }));
const SELECT_OPTIONS = { options: [{ label: 'A', value: 'a' }] };

const CASES: Case[] = [
  {
    wrapper: 'NumberInput',
    inner: 'Input',
    component: NumberInput,
    props: {},
    neighbour: Input,
    neighbourProps: {},
    slot: 'base',
    condition: { variant: 'outlined' }
  },
  {
    wrapper: 'CurrencyInput',
    inner: 'Input',
    component: CurrencyInput,
    props: {},
    neighbour: Input,
    neighbourProps: {},
    slot: 'base',
    condition: { variant: 'outlined' }
  },
  {
    wrapper: 'ConfirmDialog',
    inner: 'Dialog',
    component: ConfirmDialog,
    props: { open: true, title: 'Delete?' },
    neighbour: Dialog,
    neighbourProps: { open: true, title: 'Neighbour', children: DIALOG_BODY },
    slot: 'panel',
    // ConfirmDialog's own answer for Dialog, written on both sides.
    condition: { size: 'sm' }
  },
  {
    wrapper: 'LocaleSwitcher',
    inner: 'Select',
    component: LocaleSwitcher,
    props: {},
    neighbour: Select,
    neighbourProps: SELECT_OPTIONS,
    slot: 'trigger',
    condition: { variant: 'outlined' }
  }
];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** The marker tokens on the element that carries `anchor`, in render order. */
function markersOn(target: HTMLElement, scope: string, anchor: string): string[] {
  const element = target.querySelector(`[data-scope="${scope}"] .${anchor}`);
  if (!element) return [];
  return element.className.split(/\s+/).filter((token) => MARKER.test(token));
}

function run(entry: Case): HTMLElement {
  const defaults: Record<string, ComponentDefaults> = {
    [entry.inner]: {
      slotClasses: { [entry.slot]: N[0] },
      overrides: [{ ...entry.condition, class: { [entry.slot]: N[1] } }]
    },
    [entry.wrapper]: {
      slotClasses: { [entry.slot]: W[0] },
      overrides: [{ ...entry.condition, class: { [entry.slot]: W[1] } }]
    }
  };
  const presets: PresetMap = {
    [entry.inner]: {
      compact: {
        slotClasses: { [entry.slot]: N[2] },
        overrides: [{ ...entry.condition, class: { [entry.slot]: N[3] } }]
      }
    },
    [entry.wrapper]: {
      compact: {
        slotClasses: { [entry.slot]: W[2] },
        overrides: [{ ...entry.condition, class: { [entry.slot]: W[3] } }]
      }
    }
  };

  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(WrapperCascadeHost, {
    target,
    props: {
      component: entry.component as Component<Record<string, unknown>>,
      props: { ...entry.props, slotClasses: { [entry.slot]: W[4] } },
      preset: 'compact',
      neighbour: entry.neighbour as Component<Record<string, unknown>>,
      neighbourProps: { ...entry.neighbourProps, slotClasses: { [entry.slot]: N[4] } },
      neighbourPreset: 'compact',
      defaults,
      presets
    } as never
  });
  dispose = () => unmount(app);
  flushSync();
  return target;
}

describe.each(CASES.map((entry) => [entry.wrapper, entry] as const))('%s', (_name, entry) => {
  it(`folds ${entry.inner}'s rungs under its own, in that order`, () => {
    const target = run(entry);

    expect(
      markersOn(target, 'wrapper', W[4]),
      `the ${entry.wrapper} cascade did not fold weakest-first: ${entry.inner}'s provider rungs ` +
        `come before the wrapper's, and the wrapper's instance \`slotClasses\` come last`
    ).toEqual([N[0], N[1], W[0], W[1], W[2], W[3], W[4]]);
  });

  it(`leaves the plain ${entry.inner} beside it on its own five rungs`, () => {
    const target = run(entry);

    expect(
      markersOn(target, 'neighbour', N[4]),
      `the plain ${entry.inner} lost a rung, or took one of the ${entry.wrapper}'s`
    ).toEqual([N[0], N[1], N[2], N[3], N[4]]);
  });

  it(`takes no preset registered under ${entry.inner}`, () => {
    // The scope half, read off the same string: the wrapper forwards no
    // `preset`, so `presets.${entry.inner}.compact` reaches its inner component
    // through nothing — while the neighbour above proves the preset is
    // registered and live.
    const target = run(entry);
    const markers = markersOn(target, 'wrapper', W[4]);

    expect(
      markers,
      `a preset registered under "${entry.inner}" dressed the ${entry.wrapper}`
    ).not.toContain(N[2]);
    expect(markers).not.toContain(N[3]);
  });

  it(`still takes provider defaults registered under ${entry.inner}`, () => {
    // The other direction of the same claim, and the one that would break
    // quietly: `defaults: { Input: … }` is how a project styles every field,
    // and the field inside a wrapper is one of them.
    const target = run(entry);

    expect(markersOn(target, 'wrapper', W[4]).slice(0, 2)).toEqual([N[0], N[1]]);
  });
});

describe('without a BlocksProvider', () => {
  it.each(CASES.map((entry) => [entry.wrapper, entry] as const))(
    '%s still passes its instance slotClasses through',
    (_name, entry) => {
      const target = document.createElement('div');
      document.body.appendChild(target);
      const app = mount(entry.component as Component<Record<string, unknown>>, {
        target,
        props: { ...entry.props, slotClasses: { [entry.slot]: W[4] } }
      });
      dispose = () => unmount(app);
      flushSync();

      expect(
        target.querySelectorAll(`.${W[4]}`).length,
        `\`slotClasses\` written on a bare <${entry.wrapper}> reached no element`
      ).toBe(1);
    }
  );
});
