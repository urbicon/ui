// @vitest-environment jsdom
import { type Component, createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PinInput from '$lib/components/PinInput/PinInput.svelte';
import TimeInput from '$lib/components/TimeInput/TimeInput.svelte';
import Checkbox from '$lib/primitives/Checkbox/Checkbox.svelte';
import Combobox from '$lib/primitives/Combobox/Combobox.svelte';
import FormField from '$lib/primitives/FormField/FormField.svelte';
import Input from '$lib/primitives/Input/Input.svelte';
import RadioGroup from '$lib/primitives/RadioGroup/RadioGroup.svelte';
import Select from '$lib/primitives/Select/Select.svelte';
import Textarea from '$lib/primitives/Textarea/Textarea.svelte';
import CascadeHost from '$lib/provider/__fixtures__/CascadeHost.svelte';

/**
 * One build of the required marker, asked of every field that has a label.
 *
 * The marker used to exist in three builds — a shared pseudo-element constant,
 * three verbatim copies of it, and a `<span>` on two components — and Checkbox
 * drew nothing. Only the span is on the override ladder, so the question this
 * file answers per component is not "is there an asterisk" but "can a consumer
 * reach it": through `slotClasses`, and through the provider.
 *
 * jsdom, because the answer is markup — which element carries the glyph, what
 * classes it wears, and whether it exists at all when there is no label.
 */

const emptyChildren = createRawSnippet(() => ({ render: () => '<span></span>' }));
const fieldChildren = createRawSnippet(() => ({ render: () => '<input />' }));

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' }
];

/** Every field that draws a label, with the minimum that makes it render. */
const FIELDS: Array<[name: string, component: Component<never>, props: Record<string, unknown>]> = [
  ['Input', Input as never, {}],
  ['Textarea', Textarea as never, {}],
  ['Select', Select as never, { options: OPTIONS }],
  ['Combobox', Combobox as never, { options: OPTIONS }],
  ['RadioGroup', RadioGroup as never, { children: emptyChildren }],
  ['Checkbox', Checkbox as never, {}],
  ['PinInput', PinInput as never, {}],
  ['TimeInput', TimeInput as never, {}],
  ['FormField', FormField as never, { children: fieldChildren }]
];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(component: Component<never>, props: Record<string, unknown>): void {
  const instance = mount(component as Component<Record<string, unknown>>, {
    target: document.body,
    props
  });
  dispose = () => unmount(instance);
  flushSync();
}

/**
 * The marker, wherever it sits. `aria-hidden` alone does not identify it —
 * Checkbox's box and Select's chevron are hidden too — so the glyph decides.
 */
function markers(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')].filter(
    (el) => el.textContent === '*'
  );
}

describe.each(FIELDS)('%s required marker', (_name, component, props) => {
  it('draws exactly one aria-hidden asterisk when required', () => {
    render(component, { ...props, label: 'Field label', required: true });

    const found = markers();
    expect(found.length).toBe(1);
    // The tone is the resting one: nothing has failed yet.
    expect(found[0].className).toContain('text-text-secondary');
    expect(found[0].className).not.toContain('danger');
  });

  it('draws nothing when the field is not required', () => {
    render(component, { ...props, label: 'Field label' });
    expect(markers().length).toBe(0);
  });

  it('draws nothing when there is no label to mark', () => {
    render(component, { ...props, required: true });
    expect(markers().length).toBe(0);
  });

  it('leaves the label free of a pseudo-element asterisk', () => {
    render(component, { ...props, label: 'Field label', required: true });

    // `getAttribute`, not `className` — on an SVG element that is an
    // `SVGAnimatedString`, and Select, Combobox, Checkbox and TimeInput all
    // render an icon.
    const pseudo = [...document.querySelectorAll('[class]')].filter((el) =>
      (el.getAttribute('class') ?? '').includes("after:content-['*']")
    );
    expect(pseudo).toEqual([]);
  });

  it('is reachable through slotClasses', () => {
    render(component, {
      ...props,
      label: 'Field label',
      required: true,
      slotClasses: { requiredMark: 'hidden' }
    });

    expect(markers()[0]?.className).toContain('hidden');
  });
});

describe('required marker through the provider', () => {
  it('takes provider defaults for the requiredMark slot', () => {
    const instance = mount(CascadeHost, {
      target: document.body,
      props: {
        component: Input as never,
        props: { label: 'Email', required: true },
        defaults: { Input: { slotClasses: { requiredMark: 'hidden' } } }
      }
    });
    dispose = () => unmount(instance);
    flushSync();

    expect(markers()[0]?.className).toContain('hidden');
  });

  it('takes a conditional override keyed on required', () => {
    const instance = mount(CascadeHost, {
      target: document.body,
      props: {
        component: Input as never,
        props: { label: 'Email', required: true },
        defaults: {
          Input: {
            overrides: [{ required: true, class: { requiredMark: 'sr-only' } }]
          }
        }
      }
    });
    dispose = () => unmount(instance);
    flushSync();

    expect(markers()[0]?.className).toContain('sr-only');
  });
});
