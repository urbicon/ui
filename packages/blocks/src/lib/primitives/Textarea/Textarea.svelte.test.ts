// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TextareaProps } from './index';
import Textarea from './Textarea.svelte';

// Interaction layer for Textarea — the counter (live updates while typing,
// over-limit display) and the autoResize mechanism. jsdom has no layout, so
// `scrollHeight` is 0 by default: the min-clamp path is exercised as-is and the
// growth/max-clamp paths mock the `scrollHeight` getter — the tests assert the
// *mechanism* (style.height / overflowY bookkeeping), not real pixels; that is
// Playwright's job. Also pins the consumer-oninput passthrough: Textarea wires
// its own `oninput` after `{...restProps}`, which used to swallow the
// consumer's handler (same class as the Input onkeydown regression). Same
// stack as the Combobox pilot: Svelte's own `mount`/`unmount`,
// @testing-library/dom + user-event, native vitest matchers (no jest-dom).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderTextarea(props: Partial<TextareaProps> = {}) {
  const instance = mount(Textarea, { target: document.body, props: props as TextareaProps });
  dispose = () => unmount(instance);
  flushSync();
}

const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement;

const mockScrollHeight = (el: HTMLTextAreaElement, value: number) => {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => value });
};

describe('Textarea (counter)', () => {
  it('renders a live counter and updates it while typing', async () => {
    const user = userEvent.setup();
    renderTextarea({ showCounter: true, maxlength: 10 });

    const counter = screen.getByText('0/10');
    expect(counter.getAttribute('aria-live')).toBe('polite');

    await user.type(textarea(), 'hello');
    expect(counter.textContent).toBe('5/10');
  });

  it('shows an over-limit count for a pre-filled value longer than maxlength', () => {
    // Typing can't exceed maxlength (the platform caps it), but a programmatic
    // value can — the counter must report it instead of clamping.
    renderTextarea({ showCounter: true, maxlength: 10, value: '0123456789AB' });
    expect(screen.getByText('12/10')).toBeTruthy();
  });

  it('renders no counter (and no footer) without maxlength', () => {
    renderTextarea({ showCounter: true, value: 'abc' });
    expect(document.querySelector('[aria-live]')).toBeNull();
  });

  it('caps typed input at maxlength', async () => {
    const user = userEvent.setup();
    renderTextarea({ showCounter: true, maxlength: 5 });

    await user.type(textarea(), 'overflowing');

    expect(textarea().value).toBe('overf');
    expect(screen.getByText('5/5')).toBeTruthy();
  });
});

describe('Textarea (autoResize)', () => {
  it('clamps the height to minRows on mount and locks rows to minRows', () => {
    // size=md → 24px line height; jsdom scrollHeight is 0 → min clamp wins.
    renderTextarea({ autoResize: true, minRows: 3 });

    const el = textarea();
    expect(el.rows).toBe(3);
    expect(el.style.height).toBe('72px');
    expect(el.style.overflowY).toBe('hidden');
  });

  it('grows with the content height on input', async () => {
    const user = userEvent.setup();
    renderTextarea({ autoResize: true, minRows: 3 });

    const el = textarea();
    mockScrollHeight(el, 200);
    await user.type(el, 'a');

    expect(el.style.height).toBe('200px');
    expect(el.style.overflowY).toBe('hidden');
  });

  it('caps the height at maxRows and enables scrolling beyond it', async () => {
    const user = userEvent.setup();
    // maxRows=5 × 24px = 120px cap; mocked content wants 200px.
    renderTextarea({ autoResize: true, minRows: 3, maxRows: 5 });

    const el = textarea();
    mockScrollHeight(el, 200);
    await user.type(el, 'a');

    expect(el.style.height).toBe('120px');
    expect(el.style.overflowY).toBe('auto');
  });

  it('honours a consumer rows attribute only without autoResize', () => {
    renderTextarea({ rows: 7 });
    expect(textarea().rows).toBe(7);

    dispose?.();
    document.body.replaceChildren();
    renderTextarea({ rows: 7, autoResize: true, minRows: 3 });
    expect(textarea().rows).toBe(3);
  });
});

describe('Textarea (consumer handler passthrough)', () => {
  it('forwards oninput to the consumer handler without autoResize', async () => {
    const user = userEvent.setup();
    const oninput = vi.fn();
    renderTextarea({ oninput });

    await user.type(textarea(), 'a');

    expect(oninput).toHaveBeenCalledOnce();
    expect(textarea().value).toBe('a');
  });

  it('forwards oninput to the consumer handler alongside the autoResize adjustment', async () => {
    const user = userEvent.setup();
    const oninput = vi.fn();
    renderTextarea({ oninput, autoResize: true, minRows: 3 });

    const el = textarea();
    mockScrollHeight(el, 200);
    await user.type(el, 'a');

    // Both must run: the consumer's handler AND the height adjustment.
    expect(oninput).toHaveBeenCalledOnce();
    expect(el.style.height).toBe('200px');
  });
});

describe('Textarea (aria-describedby merge)', () => {
  // Form-family forwarding contract (docs/COMPONENT-API-CONVENTIONS.md
  // §restProps ordering): a consumer-supplied
  // `aria-describedby` is APPENDED to the internal error/helper chain — internal
  // id first, consumer id last — never dropped, never replaced. Textarea used to
  // set the explicit attribute after `{...restProps}`, so the internal value
  // REPLACED the consumer's (and dropped it entirely when there was no error).
  it('appends a consumer aria-describedby after the internal error id', () => {
    renderTextarea({ error: 'Too short', 'aria-describedby': 'ext-hint' });

    const el = textarea();
    const alert = screen.getByRole('alert');
    expect(el.getAttribute('aria-describedby')).toBe(`${alert.id} ext-hint`);
  });

  it('appends a consumer aria-describedby after the internal helper id', () => {
    renderTextarea({ helper: 'Max 280 characters', 'aria-describedby': 'ext-hint' });

    const el = textarea();
    const helper = screen.getByText('Max 280 characters');
    expect(el.getAttribute('aria-describedby')).toBe(`${helper.id} ext-hint`);
  });

  it('keeps a consumer aria-describedby when there is no internal description', () => {
    renderTextarea({ 'aria-describedby': 'ext-hint' });

    expect(textarea().getAttribute('aria-describedby')).toBe('ext-hint');
  });
});

describe('Textarea (id / external label association)', () => {
  // Same defect class as Input: Textarea hardcoded `textarea-${propsId}` and
  // dropped a consumer-supplied `id` on the floor, so an external
  // `<label for>` addressed nothing.
  it('applies a consumer-supplied id to the textarea itself', () => {
    renderTextarea({ id: 'bio-field' });
    expect(textarea().id).toBe('bio-field');
  });

  it('associates an external <label for> with the textarea and focuses it on click', async () => {
    const user = userEvent.setup();
    const label = document.createElement('label');
    label.setAttribute('for', 'bio-field');
    label.textContent = 'Bio';
    document.body.append(label);

    renderTextarea({ id: 'bio-field' });

    expect(label.control).toBe(textarea());
    await user.click(label);
    expect(document.activeElement).toBe(textarea());
  });

  it('still generates a stable id (label and textarea agree) when none is supplied', () => {
    renderTextarea({ label: 'Bio' });

    const generated = textarea().id;
    expect(generated.startsWith('textarea-')).toBe(true);
    expect(screen.getByText('Bio').getAttribute('for')).toBe(generated);
  });
});
