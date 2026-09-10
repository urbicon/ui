// @vitest-environment jsdom
import { getAllByLabelText } from '@testing-library/dom';
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
 * The glyph is the span's `::after`, not a text node. The oracle for that is
 * the query that reads a label's text content — `getByLabelText('Email')` —
 * which a text node breaks on every required field (8.21.0 shipped one).
 *
 * jsdom, because the answer is markup — which element carries the glyph class,
 * what else it wears, and whether it exists at all when there is no label.
 * Whether the class paints a `*` is the browser's answer: e2e/required-mark.spec.ts.
 */

const GLYPH = "after:content-['*']";

const emptyChildren = createRawSnippet(() => ({ render: () => '<span></span>' }));
const fieldChildren = createRawSnippet<[{ id: string }]>((ctx) => ({
  render: () => `<input id="${ctx().id}" />`
}));

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
 * Checkbox's box and Select's chevron are hidden too — so the glyph class
 * decides. `getAttribute`, not `className`: on an SVG element that is an
 * `SVGAnimatedString`, and Select, Combobox, Checkbox and TimeInput all render
 * an icon.
 */
function markers(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')].filter((el) =>
    (el.getAttribute('class') ?? '').includes(GLYPH)
  );
}

describe.each(FIELDS)('%s required marker', (_name, component, props) => {
  it('draws exactly one aria-hidden marker when required', () => {
    render(component, { ...props, label: 'Field label', required: true });

    const found = markers();
    expect(found.length).toBe(1);
    // The tone is the resting one: nothing has failed yet.
    expect(found[0].className).toContain('text-text-secondary');
    expect(found[0].className).not.toContain('danger');
  });

  it('keeps the glyph out of the text: the span is empty and the label query resolves', () => {
    render(component, { ...props, label: 'Field label', required: true });

    expect(markers()[0].textContent).toBe('');
    expect(document.body.textContent).not.toContain('*');
    // The query that reads a label's text content, with the exact string a
    // consumer writes. A text-node glyph fails it with "Unable to find a label".
    expect(getAllByLabelText(document.body, 'Field label').length).toBeGreaterThan(0);
  });

  it('puts the glyph class on the span alone, never on the label', () => {
    render(component, { ...props, label: 'Field label', required: true });

    const carriers = [...document.querySelectorAll('[class]')].filter((el) =>
      (el.getAttribute('class') ?? '').includes(GLYPH)
    );
    expect(carriers).toEqual(markers());
  });

  it('draws nothing when the field is not required', () => {
    render(component, { ...props, label: 'Field label' });
    expect(markers().length).toBe(0);
  });

  it('draws nothing when there is no label to mark', () => {
    render(component, { ...props, required: true });
    expect(markers().length).toBe(0);
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

describe('required marker under unstyled', () => {
  const span = (): HTMLElement | null => document.querySelector('label span[aria-hidden="true"]');

  it('renders the span empty: no class, no glyph', () => {
    render(Input as never, { label: 'Field label', required: true, unstyled: true });

    expect(span()?.getAttribute('class') ?? '').toBe('');
    expect(span()?.textContent).toBe('');
  });

  it("is the consumer's content class", () => {
    render(Input as never, {
      label: 'Field label',
      required: true,
      unstyled: true,
      slotClasses: { requiredMark: GLYPH }
    });

    expect(span()?.getAttribute('class')).toBe(GLYPH);
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
