// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { de } from '../../i18n/de.js';
import { registerAuthLocale } from '../../i18n/index.js';
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

describe('a locale reaches the components only once its bundle is registered', () => {
  // One test, two phases: the registry is module-global and the package exposes
  // no unregister, so "before" and "after" cannot be two independent `it`s
  // without one of them silently depending on the other having run first.
  it('renders English under <I18nProvider locale="de"> until registerAuthLocale, German after', () => {
    renderBadgeAt('de');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Unread notifications: 3');

    registerAuthLocale('de', de);

    renderBadgeAt('de');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
      'Ungelesene Benachrichtigungen: 3'
    );

    // The built-in bundle is untouched by the registration.
    renderBadgeAt('en');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Unread notifications: 3');
  });
});
