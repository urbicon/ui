// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerBlocksLocale } from '$lib/i18n';
import deTranslations from '$lib/translations/de';
import LocaleSwitcherHarness from './__fixtures__/LocaleSwitcherHarness.svelte';

// Interaction layer for LocaleSwitcher — a thin Select wrapper whose own contract is the i18n
// wiring: it lists the available locales, marks the active one, and on selection calls the
// write-strict useI18n().setLocale(value) plus the onLocaleChange callback. Select's own
// open/select mechanics are covered in Select.svelte.test.ts; here we assert the LocaleSwitcher
// glue. It needs a request-scoped i18n state (setLocale throws without a provider), so the test
// mounts it under a provideI18n harness that hands the I18nState back (onReady) to prove the locale
// actually moved — not just that the callback fired. Same stack as the Combobox pilot: svelte's own
// mount/unmount, @testing-library/dom + user-event, native matchers. Select renders options in a
// native popover with no top layer in jsdom, so they are queried with { hidden: true }. Options are
// chosen by index (locale order is preserved) rather than by translated label, so the tests don't
// couple to the language-name translation data.

type HarnessState = Parameters<
  NonNullable<ComponentProps<typeof LocaleSwitcherHarness>['onReady']>
>[0];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderSwitcher(props: Partial<ComponentProps<typeof LocaleSwitcherHarness>> = {}) {
  const instance = mount(LocaleSwitcherHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const trigger = () => screen.getByRole('combobox');
const options = () => screen.getAllByRole('option', { hidden: true });

// Since the en-eager/de-lazy split, mounting under a non-base initialLocale kicks off the
// de chunk load (provider mount effect) and LocaleSwitcher disables its trigger while
// registry.isLoading — under suite load a bare click can lose that race (flaked once in the
// full suite). Wait out the transient window before opening; real apps eager-register the
// locale at startup instead (registerBlocksLocale) and never see it.
async function openSwitcher(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    if (trigger().hasAttribute('disabled')) throw new Error('locale chunk still loading');
  });
  await user.click(trigger());
}

describe('LocaleSwitcher (component interaction)', () => {
  it('lists the provided locales as options', async () => {
    const user = userEvent.setup();
    renderSwitcher({ locales: ['en', 'de'] });

    await openSwitcher(user);
    expect(options()).toHaveLength(2);
  });

  it('falls back to the registered/default locales when no locales prop is given', async () => {
    const user = userEvent.setup();
    // The primary documented usage is `<LocaleSwitcher />` with no explicit list — it must fall
    // back to the blocks-registered locales (en, de), never render empty.
    renderSwitcher({});

    await openSwitcher(user);
    // Assert the floor (en + de) rather than an exact count: the source is the shared i18n
    // registry, so coupling to a precise length would couple to global registration order.
    expect(options().length).toBeGreaterThanOrEqual(2);
  });

  it('marks the active locale as selected', async () => {
    const user = userEvent.setup();
    renderSwitcher({ locales: ['en', 'de'], initialLocale: 'de' });

    await openSwitcher(user);
    // Locale order is preserved → index 1 is 'de', the active locale.
    const [en, de] = options();
    expect(de.getAttribute('aria-selected')).toBe('true');
    expect(en.getAttribute('aria-selected')).not.toBe('true');
  });

  it('selecting a locale calls setLocale (locale moves) and onLocaleChange', async () => {
    const user = userEvent.setup();
    const onLocaleChange = vi.fn();
    let state: HarnessState | undefined;
    renderSwitcher({
      locales: ['en', 'de'],
      initialLocale: 'en',
      onLocaleChange,
      onReady: (s) => {
        state = s;
      }
    });

    expect(state?.locale).toBe('en');
    await openSwitcher(user);
    await user.click(options()[1]); // 'de'
    flushSync();

    expect(onLocaleChange).toHaveBeenCalledWith('de');
    // The write-strict setLocale actually switched the request-scoped state (not just the callback).
    expect(state?.locale).toBe('de');
  });

  it('prepends the flag emoji when showFlag is set', async () => {
    const user = userEvent.setup();
    renderSwitcher({ locales: ['en', 'de'], showFlag: true });

    await openSwitcher(user);
    const [en, de] = options();
    expect(en.textContent).toContain('🇺🇸');
    expect(de.textContent).toContain('🇩🇪');
  });

  it('disables the trigger when disabled', () => {
    renderSwitcher({ locales: ['en', 'de'], disabled: true });

    const t = trigger();
    const isDisabled = t.hasAttribute('disabled') || t.getAttribute('aria-disabled') === 'true';
    expect(isDisabled).toBe(true);
  });

  it('never disables the trigger when the locale is eager-registered (SSR recipe)', async () => {
    // The documented startup recipe (registerBlocksLocale) must remove the transient
    // isLoading-disable entirely: with de eager-registered, mounting under initialLocale 'de'
    // finds the catalog present, the provider's load effect early-returns, and the trigger is
    // enabled from the first frame — no waitFor needed, that absence is the assertion.
    registerBlocksLocale('de', deTranslations);

    renderSwitcher({ locales: ['en', 'de'], initialLocale: 'de' });

    expect(trigger().hasAttribute('disabled')).toBe(false);
  });
});
