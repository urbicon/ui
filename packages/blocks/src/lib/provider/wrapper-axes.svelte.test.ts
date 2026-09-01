// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Component } from 'svelte';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CurrencyInput from '$lib/components/CurrencyInput/CurrencyInput.svelte';
import LocaleSwitcher from '$lib/components/LocaleSwitcher/LocaleSwitcher.svelte';
import NumberInput from '$lib/components/NumberInput/NumberInput.svelte';
import ConfirmDialog from '$lib/primitives/ConfirmDialog/ConfirmDialog.svelte';
import { dialogVariants } from '$lib/primitives/Dialog/dialog.variants';
import Input from '$lib/primitives/Input/Input.svelte';
import { inputVariants } from '$lib/primitives/Input/input.variants';
import { selectVariants } from '$lib/primitives/Select/select.variants';
import type { TVConfig } from '$lib/utils/variants';
import WrapperBodyHost from './__fixtures__/WrapperBodyHost.svelte';
import WrapperCascadeHost from './__fixtures__/WrapperCascadeHost.svelte';
import type { ComponentDefaults } from './blocks-context';

/**
 * Against which state is an `overrides` rule under a **wrapper's** name
 * matched?
 *
 * A wrapper hands the styling contract to one inner component (NumberInput to
 * Input, LocaleSwitcher to Select) and resolves the cascade under its own name
 * so a preset written for the number field does not style every text field.
 * The state that cascade is matched against has to be the state the inner
 * component is actually in — anything else fires a rule on a component that is
 * not in it, which reads like a success and is not one.
 *
 * Three kinds of axis are only knowable inside, and each has its row here:
 *
 * - **derived** — the inner component computes it rather than receiving it:
 *   `tier` (read off a context), `messageType` (`error ? 'error' : 'helper'`);
 * - **coerced** — `error` is a `string` prop on Input and Select and a
 *   *boolean* axis in their configs;
 * - **owned** — `open` is Select's own runtime state, and `iconPosition` is an
 *   axis Input declares but hands to each slot call rather than carrying for
 *   itself, so no rule keyed on it may fire under either name.
 *
 * The neighbour half of the host is what separates "the rule fired" from "the
 * rule fired everywhere"; the leak half at the bottom is what separates "the
 * wrapper's rungs reached its inner component" from "they reached everything
 * below it".
 */

const PROBE_ON = 'zz-on';
const PROBE_OFF = 'zz-off';

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

interface Mounted {
  /** Elements inside the component under test carrying each probe. */
  on: number;
  off: number;
  target: HTMLElement;
}

function render(props: Record<string, unknown>): Mounted {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(WrapperCascadeHost, {
    target,
    props: props as never
  });
  dispose = () => unmount(app);
  flushSync();
  const scope = target.querySelector('[data-scope="wrapper"]');
  return {
    on: scope?.querySelectorAll(`.${PROBE_ON}`).length ?? -1,
    off: scope?.querySelectorAll(`.${PROBE_OFF}`).length ?? -1,
    target
  };
}

/**
 * Two rules on the two sides of one axis, so every assertion reads both: a
 * mechanism that simply stopped matching would satisfy "the wrong one is gone"
 * on its own.
 */
const twoSided = (
  component: string,
  slot: string,
  axis: string,
  on: string | boolean,
  off: string | boolean
): Record<string, ComponentDefaults> => ({
  [component]: {
    overrides: [
      { [axis]: on, class: { [slot]: PROBE_ON } },
      { [axis]: off, class: { [slot]: PROBE_OFF } }
    ]
  }
});

describe('a derived axis the inner component computes', () => {
  it('matches the tier the rendered field is in, not the config default', () => {
    // `tier` reaches Input off a context, so the wrapper never sees it. Under a
    // `commit` context the field IS `commit`; a rule that answers `modify` here
    // has painted a state the component is not in.
    const { on, off } = render({
      component: NumberInput,
      tier: 'commit',
      defaults: twoSided('NumberInput', 'base', 'tier', 'commit', 'modify')
    });

    expect(on, '{ tier: "commit" } reached no element of the NumberInput').toBe(1);
    expect(off, '{ tier: "modify" } fired on a field the tier context put in `commit`').toBe(0);
  });

  it('matches whether the field it wraps actually has a right icon', () => {
    // `hasRightIcon` is Input's, computed from what it was handed. NumberInput
    // hands it a stepper, so the field IS `hasRightIcon: true` — and the axis
    // name is not one a wrapper could ever write: its prop is `rightIcon`.
    const { on, off } = render({
      component: NumberInput,
      defaults: twoSided('NumberInput', 'base', 'hasRightIcon', true, false)
    });

    expect(on, '{ hasRightIcon: true } reached no element of a NumberInput with a stepper').toBe(1);
    expect(off, '{ hasRightIcon: false } fired on a field that renders a stepper').toBe(0);
  });

  it('matches whether it actually has a left icon', () => {
    // The same axis on the other side, and the other input wrapper: a prefix
    // symbol is a left icon, so the field is `hasLeftIcon: true`.
    const { on, off } = render({
      component: CurrencyInput,
      props: { symbolPosition: 'prefix' },
      defaults: twoSided('CurrencyInput', 'base', 'hasLeftIcon', true, false)
    });

    expect(on, '{ hasLeftIcon: true } reached no element of a prefix-symbol CurrencyInput').toBe(1);
    expect(off, '{ hasLeftIcon: false } fired on a field that renders a left symbol').toBe(0);
  });

  it('matches the message the field is showing', () => {
    // `messageType` is `error ? "error" : "helper"`, computed in Input. With an
    // error string written on the wrapper, the field shows an error.
    const { on, off } = render({
      component: NumberInput,
      props: { error: 'too large' },
      defaults: twoSided('NumberInput', 'message', 'messageType', 'error', 'helper')
    });

    expect(on, '{ messageType: "error" } reached no element of the errored NumberInput').toBe(1);
    expect(off, '{ messageType: "helper" } fired on a field showing an error').toBe(0);
  });
});

describe('a coerced axis', () => {
  it('matches the boolean the axis is, not the string the prop was', () => {
    // `error` is a `string` prop and a boolean axis. `{ error: true }` is the
    // shape that fires on a plain `<Input error="x">`, so it is the shape a
    // rule under the wrapper has to answer too.
    const { on, off } = render({
      component: NumberInput,
      props: { error: 'too large' },
      defaults: twoSided('NumberInput', 'base', 'error', true, 'too large')
    });

    expect(on, '{ error: true } reached no element of the errored NumberInput').toBe(1);
    expect(
      off,
      '{ error: "too large" } fired — the string reaches the axis as `!!error`, so no rule ' +
        'keyed on the string can fire inside Input either'
    ).toBe(0);
  });

  it('gives the wrapper and the plain component the same answer', () => {
    // One rule shape, two names, one mount each — the two cannot share a mount,
    // because a `defaults.Input` rule reaches the field inside the wrapper too
    // and would hide a wrapper that matched nothing.
    const carriers = (component: unknown, name: string) => {
      const { on } = render({
        component,
        props: { error: 'x' },
        defaults: { [name]: { overrides: [{ error: true, class: { base: PROBE_ON } }] } }
      });
      dispose?.();
      dispose = undefined;
      return on;
    };

    const underWrapper = carriers(NumberInput, 'NumberInput');
    const underInner = carriers(Input, 'Input');

    expect(underInner, '{ error: true } stopped firing on a plain errored <Input>').toBe(1);
    expect(
      underWrapper,
      '{ error: true } answered differently under "NumberInput" than under "Input" — one rule, ' +
        'two behaviours, which is the asymmetry this file exists to catch'
    ).toBe(underInner);
  });
});

describe('an axis the inner component owns', () => {
  it("matches Select's open state under LocaleSwitcher", async () => {
    // `open` is Select's own runtime state; no caller of the switcher writes
    // it, and nothing above Select can read it.
    const user = userEvent.setup();
    const { target } = render({
      component: LocaleSwitcher,
      defaults: twoSided('LocaleSwitcher', 'trigger', 'open', true, false)
    });
    const scope = () => target.querySelector('[data-scope="wrapper"]');
    const on = () => scope()?.querySelectorAll(`.${PROBE_ON}`).length ?? -1;
    const off = () => scope()?.querySelectorAll(`.${PROBE_OFF}`).length ?? -1;

    expect(on(), '{ open: true } fired on a closed select').toBe(0);
    expect(off(), '{ open: false } reached no element of the closed select').toBe(1);

    await user.click(screen.getByRole('combobox'));
    flushSync();

    expect(on(), '{ open: true } reached no element of the open select').toBe(1);
    expect(off(), '{ open: false } fired on an open select').toBe(0);
  });

  it('fires on neither side for an axis handed out per slot call', () => {
    // `iconPosition` is declared by `inputVariants` and never enters Input's
    // condition object — it is passed to each `iconContainer` call. A rule
    // keyed on it fires nowhere, and a wrapper is not the exception.
    expect(Object.keys(inputVariants.config.variants ?? {})).toContain('iconPosition');
    const position = inputVariants.config.defaultVariants?.iconPosition;
    expect(position, 'iconPosition has no default to key the rule on').toBeDefined();

    const target = document.createElement('div');
    document.body.appendChild(target);
    const app = mount(WrapperCascadeHost, {
      target,
      props: {
        component: NumberInput as unknown as Component<Record<string, unknown>>,
        neighbour: Input as unknown as Component<Record<string, unknown>>,
        defaults: {
          NumberInput: { overrides: [{ iconPosition: position, class: { base: PROBE_ON } }] },
          Input: { overrides: [{ iconPosition: position, class: { base: PROBE_ON } }] }
        }
      } as never
    });
    dispose = () => unmount(app);
    flushSync();

    expect(
      target.querySelectorAll(`.${PROBE_ON}`).length,
      `{ iconPosition: ${JSON.stringify(position)} } painted something — it can match under ` +
        'neither name, so a hit under the wrapper is a rule firing on a state nothing is in'
    ).toBe(0);
  });
});

describe('the rungs a wrapper sets reach its own inner component and stop there', () => {
  const LEAK = 'zz-leak';
  const CONTROL = 'zz-control';

  function renderBody(
    body: 'input' | 'select' | 'number',
    defaults: Record<string, ComponentDefaults>
  ): HTMLElement {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const app = mount(WrapperBodyHost, { target, props: { body, defaults } as never });
    dispose = () => unmount(app);
    flushSync();
    return target;
  }

  // A slot the body component paints and the Dialog around it does not, so the
  // probe can only be on the page by way of a cascade that outlived the Dialog.
  // The three cascade consumers are Input, Select and Dialog; a nested Dialog
  // has no such slot — every one of its slots is a slot of the Dialog it sits
  // in — so the two that can be told apart are the two measured here.
  it.each([
    ['input', 'base', 'Input'],
    ['select', 'trigger', 'Select']
  ] as const)('a <%s> in a ConfirmDialog body takes none of its rungs', (body, slot, own) => {
    const target = renderBody(body, {
      ConfirmDialog: { slotClasses: { [slot]: LEAK } },
      [own]: { slotClasses: { [slot]: CONTROL } }
    });

    // The control proves the query reaches the body component at all — without
    // it, "no leak" and "nothing rendered" are the same reading.
    expect(
      target.querySelectorAll(`.${CONTROL}`).length,
      `the <${body}> in the dialog body took no \`defaults.${own}\` classes — the probe reaches nothing`
    ).toBe(1);
    expect(
      target.querySelectorAll(`.${LEAK}`).length,
      'a rung set for the ConfirmDialog reached a component in its body'
    ).toBe(0);
  });

  it('lets a wrapper in the body address its own inner component', () => {
    // The other direction: a wrapper below a wrapper addresses the component it
    // wraps, the nearer cascade winning over the one it was rendered inside.
    const target = renderBody('number', {
      ConfirmDialog: { slotClasses: { base: LEAK } },
      NumberInput: { slotClasses: { base: CONTROL } }
    });

    expect(
      target.querySelectorAll(`.${CONTROL}`).length,
      'the NumberInput in the dialog body did not take its own rung'
    ).toBe(1);
    expect(
      target.querySelectorAll(`.${LEAK}`).length,
      "the ConfirmDialog's rung reached the field of a NumberInput in its body"
    ).toBe(0);
  });
});

describe('the unknown-condition-key warning under a wrapper name', () => {
  // Re-spied per test with a restore after it, because these assertions read
  // the calls: `vi.spyOn` hands back the EXISTING mock for an already-spied
  // method and `mockImplementation` does not clear its history.
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    expect(import.meta.env.DEV, 'the warning is DEV-gated; without it this asserts nothing').toBe(
      true
    );
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('recommends the axes the inner component really carries', () => {
    // Under a wrapper's name the rule is matched against the inner component's
    // condition object, so the keys that can match are that object's — not
    // every axis the config declares. `iconPosition` is the difference: Input
    // declares it and hands it out per slot call, so recommending it would
    // send the reader from one silent no-op into the next.
    render({
      component: NumberInput,
      defaults: {
        NumberInput: { overrides: [{ zzTypo: 'x', class: { base: 'zz-dead' } }] }
      }
    });

    const reported = warn.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .filter((line: string) => line.includes('conditions on "zzTypo"'));
    expect(reported).toHaveLength(1);
    const [message] = reported;
    expect(message).toContain('component "NumberInput"');

    const from = message.indexOf('Keys that can match here:');
    expect(from, 'the message recommended nothing').toBeGreaterThan(-1);
    const recommended = message.slice(from, message.indexOf('.', from));
    // The axes Input actually passes, named under the wrapper's name.
    for (const axis of ['tier', 'variant', 'size', 'error', 'messageType']) {
      expect(recommended).toContain(axis);
    }
    expect(
      recommended,
      '`iconPosition` was recommended under the wrapper name, though no rule keyed on it can ' +
        'match inside Input either'
    ).not.toContain('iconPosition');
    expect(message).toMatch(/That config also declares[^.]*iconPosition/);
    // The describing half has to be true under a wrapper's name too. Both
    // lists are Input's here — NumberInput passes no variant prop and
    // `numberInputVariants` declares no axis — so a possessive pointing at the
    // named component states the opposite of what was measured.
    expect(message, "the message called the props and the config the wrapper's own").not.toMatch(
      /\bnor an axis its\b|\ba prop it passes\b|\bIts config\b/
    );
    expect(message).toContain('the variant props this rule is matched against');
    expect(document.querySelector('.zz-dead')).toBeNull();
  });
});

/**
 * The census: for every axis the inner config declares, does a rule keyed on it
 * at that config's own `defaultVariants` value fire under the wrapper's name?
 *
 * The shape of the change stated as a whole rather than one axis at a time,
 * which is what the per-axis assertions above cannot be: three axes went
 * unlisted in `packages/blocks/docs/MIGRATION.md` because each was only ever
 * looked for one at a time.
 *
 * A silent row has two possible causes and they are not the same claim, so the
 * table names them apart:
 *
 * - `written` — the wrapper itself hands the inner component a non-default
 *   value, so a rule keyed on the default misses. It missed before this change
 *   too; nothing moved.
 * - `moved` — the wrapper cannot write the axis at all. The old stand-in
 *   answered these with the config default and the rule fired; now the
 *   rendered component answers and it does not. Every entry belongs in the
 *   migration guide.
 *
 * The census only sees an axis at its config default, so an axis that moved at
 * some *other* value — `tier` under a `commit` context, `error` on an errored
 * field, `hasLeftIcon` with a left icon — is invisible here and carries its own
 * assertion above. This is the floor of the claim, not the whole of it.
 */
const CENSUS: {
  wrapper: string;
  component: unknown;
  props: Record<string, unknown>;
  slot: string;
  innerConfig: TVConfig;
  /** Silent on both mechanisms: the wrapper writes a non-default value itself. */
  written: string[];
  /** Silent only now: the old stand-in answered these with the config default. */
  moved: string[];
}[] = [
  {
    wrapper: 'NumberInput',
    component: NumberInput,
    props: {},
    slot: 'base',
    innerConfig: inputVariants.config,
    written: [],
    moved: ['hasRightIcon', 'iconPosition']
  },
  {
    wrapper: 'CurrencyInput',
    component: CurrencyInput,
    props: {},
    slot: 'base',
    innerConfig: inputVariants.config,
    written: [],
    moved: ['hasRightIcon', 'iconPosition']
  },
  {
    wrapper: 'LocaleSwitcher',
    component: LocaleSwitcher,
    props: {},
    slot: 'trigger',
    innerConfig: selectVariants.config,
    written: ['size'],
    moved: ['selected']
  },
  {
    wrapper: 'ConfirmDialog',
    component: ConfirmDialog,
    props: { open: true, title: 'Delete?' },
    slot: 'panel',
    innerConfig: dialogVariants.config,
    written: ['intent'],
    moved: []
  }
];

describe.each(CENSUS.map((row) => [row.wrapper, row] as const))('%s census', (_name, row) => {
  it("answers each of the inner config's axes at its own default", () => {
    const defaults = row.innerConfig.defaultVariants ?? {};
    const axes = Object.keys(row.innerConfig.variants ?? {}).filter(
      (axis) => defaults[axis] !== undefined
    );
    expect(axes.length, 'the inner config declares no defaulted axis to census').toBeGreaterThan(0);

    const { target } = render({
      component: row.component,
      props: row.props,
      defaults: {
        [row.wrapper]: {
          overrides: axes.map((axis) => ({
            [axis]: defaults[axis] as string | boolean,
            class: { [row.slot]: `zz-${axis}` }
          }))
        }
      }
    });
    const scope = target.querySelector('[data-scope="wrapper"]');
    const silent = axes.filter(
      (axis) => (scope?.querySelectorAll(`.zz-${axis}`).length ?? 0) === 0
    );

    expect(
      [...silent].sort(),
      `axes that answer no rule keyed on ${row.wrapper}'s inner default — every one that is ` +
        'not written by the wrapper itself has a row in the migration guide'
    ).toEqual([...row.written, ...row.moved].sort());
  });
});
