// @vitest-environment jsdom
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CoreFieldMessage from './CoreFieldMessage.svelte';

// The helper/error line under a form field, extracted from Input, PinInput and
// TimeInput (field-chrome part b). Those three used to hand-copy this block, so
// its invariants were asserted three times at best and nowhere at worst — the
// helper arm had no coverage in any of them, and "error beats helper" was
// implied by `{:else if}` rather than tested.
//
// Now that one component owns the rules, they get one test. The call-site
// wiring (which ids are passed, which slot class) stays covered by each
// component's own suite; what is pinned here is the behaviour the core decides.
//
// Same stack as the rest of the DOM suites: Svelte's own mount/unmount and
// native vitest matchers, no jest-dom.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Record<string, unknown>) {
  const instance = mount(CoreFieldMessage, { target: document.body, props });
  dispose = () => unmount(instance);
  return document.body;
}

const only = (): HTMLElement | null => document.body.querySelector('div');

describe('CoreFieldMessage', () => {
  it('renders nothing when neither error nor helper is set', () => {
    render({ errorId: 'f-error', helperId: 'f-helper', class: 'msg' });
    expect(only()).toBeNull();
  });

  it('renders the helper arm without a live region', () => {
    render({ helper: 'Two to eight characters', helperId: 'f-helper', class: 'msg' });

    const el = only();
    expect(el?.textContent?.trim()).toBe('Two to eight characters');
    expect(el?.id).toBe('f-helper');
    // Helper text is static description reachable via aria-describedby.
    // Announcing it would interrupt the user for text that never changed.
    expect(el?.getAttribute('role')).toBeNull();
  });

  it('renders the error arm as a live region', () => {
    render({ error: 'That code has expired', errorId: 'f-error', class: 'msg' });

    const el = only();
    expect(el?.textContent?.trim()).toBe('That code has expired');
    expect(el?.id).toBe('f-error');
    expect(el?.getAttribute('role')).toBe('alert');
  });

  it('lets the error win over the helper, and renders only one element', () => {
    render({
      error: 'Required',
      helper: 'Optional hint',
      errorId: 'f-error',
      helperId: 'f-helper',
      class: 'msg'
    });

    const all = document.body.querySelectorAll('div');
    expect(all.length).toBe(1);
    expect(all[0].textContent?.trim()).toBe('Required');
    expect(all[0].id).toBe('f-error');
    expect(all[0].getAttribute('role')).toBe('alert');
    expect(document.body.textContent).not.toContain('Optional hint');
  });

  it('applies the call site’s resolved class verbatim — the core owns no look', () => {
    render({ helper: 'Hint', helperId: 'f-helper', class: 'text-xs text-text-tertiary' });
    expect(only()?.getAttribute('class')).toBe('text-xs text-text-tertiary');
  });

  it('styles the helper arm through `helperClass` when the call site has a slot for it', () => {
    // Combobox exposes `slotClasses.helper` beside `slotClasses.message`, so its
    // two tones are slot constants rather than one `messageType` axis. Without
    // this prop its helper would inherit the error slot and read red while the
    // field is invalid — the exact regression combobox.variants.test.ts guards
    // on the variants side.
    render({
      helper: 'Start typing to search',
      helperId: 'f-helper',
      class: 'text-danger',
      helperClass: 'text-text-tertiary'
    });
    expect(only()?.getAttribute('class')).toBe('text-text-tertiary');
  });

  it('falls back to `class` for the helper arm when no `helperClass` is given', () => {
    // Every other field routes both arms through one `message` slot whose tone
    // comes from the `messageType` axis, so omitting `helperClass` must not
    // strip the helper of its class.
    render({ helper: 'Hint', helperId: 'f-helper', class: 'msg' });
    expect(only()?.getAttribute('class')).toBe('msg');
  });

  it('accepts the same id on both arms (the shared-messageId call sites)', () => {
    // PinInput and TimeInput point `aria-describedby` at one `messageId` and
    // pass it as BOTH ids, since only one arm can ever render.
    render({ error: 'Nope', errorId: 'f-msg', helperId: 'f-msg', class: 'msg' });
    expect(only()?.id).toBe('f-msg');
  });
});
