// @vitest-environment jsdom
import type { Component } from 'svelte';
import { createRawSnippet, flushSync, mount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReasoningDisclosure from '$lib/components/Chat/ReasoningDisclosure/ReasoningDisclosure.svelte';
import CopyButton from '$lib/components/CopyButton/CopyButton.svelte';
import { copyButtonVariants } from '$lib/components/CopyButton/copy-button.variants';
import DatePicker from '$lib/components/DatePicker/DatePicker.svelte';
import { datePickerVariants } from '$lib/components/DatePicker/datepicker.variants';
import Card from '$lib/primitives/Card/Card.svelte';
import { cardVariants } from '$lib/primitives/Card/card.variants';
import Input from '$lib/primitives/Input/Input.svelte';
import { inputVariants } from '$lib/primitives/Input/input.variants';
import Stepper from '$lib/primitives/Stepper/Stepper.svelte';
import { stepperVariants } from '$lib/primitives/Stepper/stepper.variants';
import OverrideKeyHost from './__fixtures__/OverrideKeyHost.svelte';
import type { ComponentDefaults, PresetMap } from './blocks-context';

/**
 * An `overrides` condition key the component neither passes nor declares.
 * `ConditionalOverride`'s index signature admits any string, so `varaint` and
 * `mint` (a real `Card` prop, no axis) type-check, paint nothing, and look
 * exactly like the rule that is simply not matched — which is the normal case
 * and must stay silent.
 *
 * The check therefore runs on the RULE, before matching. Reading the resolved
 * slot map instead — the shape `Sparkline` uses for its renamed slot keys —
 * cannot see this class at all: a key only reaches that map when its rule
 * matches, and a mistyped key is exactly the one whose rule never does.
 *
 * The silent half is the load-bearing one. Both halves of the union that buys
 * silence are pinned by a component only the other half covers (`CopyButton`,
 * `Input`), because a check against either alone reports correct config as a
 * typo — 4 components and 14 components respectively, measured across the 88
 * that resolve a cascade.
 *
 * The union is not what the message prints, and the Stepper row is why: only a
 * key the component *passes* can match, so an axis its config declares and it
 * hands out per slot call must stay off the recommended list. That row walks
 * the whole path — report, follow the advice, see it paint.
 *
 * **The dedupe set is module-global and never cleared** (that is the point: one
 * typo, one report, whatever the instance count). So every test that asserts a
 * report uses its OWN misspelling — `varaint`, `paddng`, `mint`, `stepState`,
 * `vairant`, `varient`, `vaiant`, `varaint2`. Reusing a spent one here yields a
 * green assertion on zero warnings.
 *
 * The warning is `import.meta.env?.DEV`-gated and window-gated, like the
 * unregistered-preset warning it sits beside; this file is the jsdom half, so
 * both are true.
 */

/** Card's accepted set: it passes every axis its config declares, so the two halves coincide. */
const CARD_AXES = Object.keys(cardVariants.config.variants ?? {});

// Re-spied per test with a restore after it, because these assertions count
// calls: `vi.spyOn` hands back the EXISTING mock for an already-spied method
// and `mockImplementation` does not clear its history, so without the restore
// one test's calls are counted by the next (`blocks-testing` skill).
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  document.body.replaceChildren();
});

afterEach(() => {
  warn.mockRestore();
});

function render(props: {
  component: unknown;
  props?: Record<string, unknown>;
  preset?: string;
  defaults?: Record<string, ComponentDefaults>;
  presets?: PresetMap;
}): void {
  const target = document.createElement('div');
  document.body.appendChild(target);
  mount(OverrideKeyHost, {
    target,
    props: { ...props, component: props.component as Component<Record<string, unknown>> }
  });
  flushSync();
}

const text = createRawSnippet(() => ({ render: () => '<span>content</span>' }));

/** Every message the check emits, so an assertion reads the whole console. */
const messages = (): string[] => warn.mock.calls.map((call: unknown[]) => String(call[0]));
const mentioning = (key: string): string[] =>
  messages().filter((message) => message.includes(`conditions on "${key}"`));

describe('an unknown overrides condition key', () => {
  it('reports a typo in a provider default, with the keys that would have worked', () => {
    render({
      component: Card,
      props: { children: text },
      defaults: { Card: { overrides: [{ varaint: 'outlined', class: { base: 'border' } }] } }
    });

    expect(mentioning('varaint')).toHaveLength(1);
    const [message] = mentioning('varaint');
    expect(message).toContain('component "Card"');
    expect(message).toContain('under defaults');
    // Named, not counted: the point of the message is which key to write
    // instead. Card passes every axis it declares, so all seven can match and
    // all seven are recommended — the one component where the two halves agree.
    for (const axis of CARD_AXES) expect(message).toContain(axis);
    expect(message).not.toContain('Its config also declares');
  });

  it('reports it in a preset, naming the preset it came from', () => {
    render({
      component: Card,
      props: { children: text },
      preset: 'compact',
      presets: {
        Card: { compact: { overrides: [{ paddng: 'sm', class: { base: 'p-1' } }] } }
      }
    });

    expect(mentioning('paddng')).toHaveLength(1);
    expect(mentioning('paddng')[0]).toContain('preset "compact"');
  });

  it('reports a real prop of the component that is no axis of it', () => {
    // `mint` is a `Card` prop and not in `cardVariants`. Nothing about the rule
    // is misspelled, and it is just as dead as the typo above.
    expect(CARD_AXES).not.toContain('mint');
    render({
      component: Card,
      props: { children: text },
      defaults: { Card: { overrides: [{ mint: 'brand', class: { base: 'ring-1' } }] } }
    });

    expect(mentioning('mint')).toHaveLength(1);
  });
});

describe('the silent half', () => {
  it('says nothing about a rule that correctly does not match', () => {
    // The normal case, and the one a false alarm would drown: `outlined` is a
    // real value of a real axis, on a card that is `quiet`.
    render({
      component: Card,
      props: { children: text, variant: 'quiet' },
      defaults: { Card: { overrides: [{ variant: 'outlined', class: { base: 'probe-no' } }] } }
    });

    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector('.probe-no')).toBeNull();
  });

  it('says nothing about a rule that matches, and still applies it', () => {
    render({
      component: Card,
      props: { children: text, variant: 'quiet' },
      defaults: { Card: { overrides: [{ variant: 'quiet', class: { base: 'probe-yes' } }] } }
    });

    expect(warn).not.toHaveBeenCalled();
    // The control on the control: "quiet" would also be what a check that threw
    // away the overrides produced.
    expect(document.querySelector('.probe-yes')).not.toBeNull();
  });

  it('says nothing about a wrapper keyed on an axis of what it wraps', () => {
    // `copyButtonVariants` declares `size` and `state`; the button passes those
    // two AND `variant`/`intent`, which belong to the Button inside it, so a
    // check against the config alone would call the two forwarded ones typos.
    // The only such case in THIS FILE — the corpus has a second, `AvatarGroup`
    // (declares `spacing`, passes `spacing` + `size`). A wrapper declaring
    // nothing (below) does not separate them: under a config-only check its
    // accepted set is empty, which is a different failure.
    expect(Object.keys(copyButtonVariants.config.variants ?? {})).not.toContain('intent');
    render({
      component: CopyButton,
      props: { value: 'copy me' },
      defaults: {
        CopyButton: { overrides: [{ intent: 'primary', class: { base: 'probe-cb' } }] }
      }
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it('says nothing about a wrapper whose own config declares no axis at all', () => {
    // `datePickerVariants` declares none; the picker names five that belong to
    // the Input and the Calendar inside it.
    expect(Object.keys(datePickerVariants.config.variants ?? {})).toHaveLength(0);
    render({
      component: DatePicker,
      defaults: {
        DatePicker: {
          overrides: [
            { inputVariant: 'filled', class: { base: 'probe-dp' } },
            { calendarVariant: 'plain', class: { base: 'probe-dp2' } }
          ]
        }
      }
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it('says nothing about an axis the component declares but passes per slot call', () => {
    // `iconPosition` is `inputVariants`' axis and `Input` never puts it in its
    // condition object — it hands it to each `iconContainer` call instead. The
    // rule cannot match, and it is not mistyped. Checking the condition object
    // alone would report it.
    expect(Object.keys(inputVariants.config.variants ?? {})).toContain('iconPosition');
    render({
      component: Input,
      defaults: { Input: { overrides: [{ iconPosition: 'right', class: { base: 'probe-in' } }] } }
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it('says nothing about a rule that carries no condition at all', () => {
    // `{ class: … }` alone matches everything, on every component. It is the
    // shape the no-axis message below points people at, so it must be silent
    // even where every keyed rule is dead.
    render({
      component: ReasoningDisclosure,
      props: { reasoning: { type: 'reasoning', text: 'why', durationMs: 12 } },
      defaults: { ReasoningDisclosure: { overrides: [{ class: { label: 'probe-live' } }] } }
    });

    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector('.probe-live')).not.toBeNull();
  });
});

describe('a component that passes no variant props', () => {
  it('reports the certain diagnosis instead of an empty list', () => {
    // 22 components are in this state — 9 here, 13 in `@urbicon-ui/auth` behind
    // one frozen empty config. A keyed rule on them is not *probably* dead, it
    // is certainly dead, so this is the one case where the check knows more
    // than anywhere else. Nothing about this rule looks mistyped.
    render({
      component: ReasoningDisclosure,
      props: { reasoning: { type: 'reasoning', text: 'why', durationMs: 12 } },
      defaults: {
        ReasoningDisclosure: { overrides: [{ varaint2: 'x', class: { label: 'zz-dead' } }] }
      }
    });

    expect(mentioning('varaint2')).toHaveLength(1);
    const [message] = mentioning('varaint2');
    expect(message).toContain('no conditional rule can match it');
    expect(message).toContain('unconditional `slotClasses`');
    // No dangling "Keys that can match here:" with nothing after it.
    expect(message).not.toContain('Keys that can match here');
    expect(document.querySelector('.zz-dead')).toBeNull();
  });
});

describe('what the message recommends', () => {
  it('leaves out an axis the config declares and the component passes per slot call', () => {
    // The `MIGRATION.md` path, end to end. `stepperVariants` declares `state`;
    // `Stepper` does not pass it (only `StepperStep` does), so `{ state: … }` is
    // as dead as the `stepState` that provoked the report. Recommending it would
    // send the reader from one silent no-op into the next.
    const declared = Object.keys(stepperVariants.config.variants ?? {});
    expect(declared).toContain('state');
    expect(declared).toContain('orientation');

    render({
      component: Stepper,
      props: { children: text },
      defaults: { Stepper: { overrides: [{ stepState: 'active', class: { base: 'zz' } }] } }
    });

    const [message] = mentioning('stepState');
    // Only the recommendation sentence — the one after it names the same axes
    // for the opposite reason, so slicing to the end would always "contain" them.
    const from = message.indexOf('Keys that can match here:');
    const recommended = message.slice(from, message.indexOf('.', from));
    expect(recommended).toContain('orientation');
    expect(recommended).not.toContain('state,');
    expect(recommended).not.toMatch(/\bstate\b/);
    // The declared-but-unpassed axes are still named — in the other sentence,
    // with the reason they cannot match.
    expect(message).toContain('Its config also declares');
    expect(message).toMatch(/Its config also declares[^.]*\bstate\b/);
  });

  it('recommends only keys that really paint, and the rejected one really does not', () => {
    // STEP2 / CONTROL of the same measurement, as assertions.
    render({
      component: Stepper,
      props: { children: text },
      defaults: {
        Stepper: {
          overrides: [
            { orientation: 'horizontal', class: { base: 'zz-recommended' } },
            { state: 'active', class: { base: 'zz-declared-only' } }
          ]
        }
      }
    });

    expect(document.querySelector('.zz-recommended')).not.toBeNull();
    expect(document.querySelector('.zz-declared-only')).toBeNull();
  });
});

describe('granularity', () => {
  it('reports one mistyped key once, however many components carry it', () => {
    const defaults: Record<string, ComponentDefaults> = {
      Card: { overrides: [{ vairant: 'quiet', class: { base: 'x' } }] }
    };
    render({ component: Card, props: { children: text }, defaults });
    render({ component: Card, props: { children: text }, defaults });

    expect(mentioning('vairant')).toHaveLength(1);
  });

  it('re-reports nothing on a re-render, and reports a second key that arrives', () => {
    // A second, matching rule carries the probe class, so the re-render is
    // observable. Without it, "no second warning" would also be what a
    // component that stopped updating produces — and the mistyped key cannot
    // carry the probe itself: an unmatchable key fails `matchesCompound` for
    // the whole rule, which is why the typo paints nothing in the first place.
    const defaults = $state<Record<string, ComponentDefaults>>({
      Card: {
        overrides: [
          { varient: 'quiet', class: { base: 'never' } },
          { variant: 'quiet', class: { base: 'probe-a' } }
        ]
      }
    });
    render({ component: Card, props: { children: text }, defaults });
    expect(mentioning('varient')).toHaveLength(1);
    expect(document.querySelector('.probe-a')).not.toBeNull();
    expect(document.querySelector('.never')).toBeNull();

    defaults.Card = {
      overrides: [
        { varient: 'quiet', class: { base: 'never' } },
        { variant: 'quiet', class: { base: 'probe-b' } }
      ]
    };
    flushSync();
    expect(document.querySelector('.probe-b')).not.toBeNull();
    expect(mentioning('varient')).toHaveLength(1);

    defaults.Card = { overrides: [{ vaiant: 'quiet', class: { base: 'probe-c' } }] };
    flushSync();
    expect(mentioning('vaiant')).toHaveLength(1);
  });
});
