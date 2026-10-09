// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/dom';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocaleSwitcherHarness from './__fixtures__/LocaleSwitcherHarness.svelte';

// LocaleSwitcher spreads restProps onto Select first (COMPONENT-API-CONVENTIONS § restProps
// ordering). The loading text wins while a locale loads; otherwise a consumer `placeholder` or
// `aria-label` replaces the localized default on purpose.
//
// The placeholder only shows while the active locale is not among the options, so these tests
// list a locale other than the active one; Select warns (DEV) about that value, silenced here.
// Its own file because the loading case needs a module registry in which `de` has not loaded
// yet — mounting under `de` starts the chunk load, and the assertions run before it resolves.

let dispose: (() => void) | undefined;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  warn.mockRestore();
});

function render(props: Partial<ComponentProps<typeof LocaleSwitcherHarness>> = {}) {
  const instance = mount(LocaleSwitcherHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const trigger = () => screen.getByRole('combobox');
// The trigger is disabled exactly while a locale loads, which makes it the probe for that state.
const loading = () => trigger().hasAttribute('disabled');

describe('LocaleSwitcher (restProps)', () => {
  it('shows the loading text over a consumer placeholder while a locale loads', () => {
    render({ locales: ['en'], initialLocale: 'de', placeholder: 'Pick one' });

    expect(loading()).toBe(true);
    expect(trigger().textContent).toContain('Loading...');
    expect(trigger().textContent).not.toContain('Pick one');
  });

  it('shows a consumer placeholder over the localized default otherwise', async () => {
    render({ locales: ['de'], initialLocale: 'en', placeholder: 'Pick one' });

    // The registry is module-wide: the chunk the previous case started may still be in flight.
    await waitFor(() => expect(loading()).toBe(false));
    expect(trigger().textContent).toContain('Pick one');
  });

  it('is named by the localized default without a consumer aria-label', () => {
    render({ locales: ['en', 'de'] });
    expect(trigger().getAttribute('aria-label')).toBe('Language selection');
  });

  it('is named by a consumer aria-label over the localized default', () => {
    render({ locales: ['en', 'de'], 'aria-label': 'Interface language' });
    expect(trigger().getAttribute('aria-label')).toBe('Interface language');
  });
});
