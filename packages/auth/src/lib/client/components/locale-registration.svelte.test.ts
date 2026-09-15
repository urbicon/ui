// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { de } from '../../i18n/de.js';
import { registerAuthLocale } from '../../i18n/index.svelte.js';
import LocaleHarness from './__fixtures__/LocaleHarness.svelte';
import NotificationBadge from './NotificationBadge/NotificationBadge.svelte';

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderBadgeAt(locale: 'en' | 'de'): void {
  dispose?.();
  const instance = mount(LocaleHarness, {
    target: document.body,
    props: {
      component: NotificationBadge as never,
      componentProps: { count: 3 },
      locale
    }
  });
  flushSync();
  dispose = () => unmount(instance);
}

const label = () => screen.getByRole('status').getAttribute('aria-label');

describe('a locale reaches the components only once its bundle is registered', () => {
  // One test, three phases: the registry is module-global and the package
  // exposes no unregister, so "before" and "after" cannot be independent `it`s
  // without one of them silently depending on the other having run first.
  it('renders English under <I18nProvider locale="de"> until registerAuthLocale, German after', () => {
    renderBadgeAt('de');
    expect(label()).toBe('Unread notifications: 3');

    // Phase 2 — the registration lands while the tree from phase 1 is still
    // mounted and is never re-mounted: this is the case a non-reactive registry
    // leaves in English, because a property written into a plain object
    // invalidates no `$derived`.
    registerAuthLocale('de', de);
    flushSync();
    expect(label()).toBe('Ungelesene Benachrichtigungen: 3');

    // Phase 3 — a fresh mount sees it too, and the built-in bundle is untouched.
    renderBadgeAt('de');
    expect(label()).toBe('Ungelesene Benachrichtigungen: 3');

    renderBadgeAt('en');
    expect(label()).toBe('Unread notifications: 3');
  });
});
