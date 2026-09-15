import type { Locale } from '@urbicon-ui/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig, AuthLogger } from '../../types.js';

/**
 * `resolveEmailSettings` reads the module-global bundle registry and keeps its
 * own per-process set of already-reported locales, so each test takes a fresh
 * module graph. Both modules are imported after the reset, so `resolve.ts` and
 * the registry it reads are the same instance.
 */
async function freshResolve() {
  vi.resetModules();
  const [{ resolveEmailSettings }, { registerAuthLocale }, { de }, { en }] = await Promise.all([
    import('./resolve.js'),
    import('../../i18n/index.js'),
    import('../../i18n/de.js'),
    import('../../i18n/en.js')
  ]);
  return { resolveEmailSettings, registerAuthLocale, de, en };
}

function configWith(locale: Locale | undefined, logger: AuthLogger): AuthConfig {
  return {
    jwt: { secret: 'test-secret-that-is-long-enough-for-hs256' },
    appUrl: 'https://app.example.com',
    logger,
    email: { locale }
  };
}

function spyLogger() {
  return {
    warn: vi.fn<(message: string, ...context: unknown[]) => void>(),
    error: vi.fn<(message: string, ...context: unknown[]) => void>()
  } satisfies AuthLogger;
}

describe('resolveEmailSettings — locale', () => {
  it('falls back to English for an unregistered locale and warns once per process', async () => {
    const { resolveEmailSettings, en } = await freshResolve();
    const logger = spyLogger();
    const config = configWith('de', logger);

    expect(resolveEmailSettings(config).t).toBe(en);
    expect(resolveEmailSettings(config).t).toBe(en);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[0]).toMatch(/email\.locale is "de"/);
    expect(logger.warn.mock.calls[0]?.[0]).toMatch(/registerAuthLocale\('de', bundle\)/);
  });

  it('resolves a registered locale and stays quiet', async () => {
    // `de` has never been reported in this module graph, so the silence below
    // is caused by the registration and not by the warn-once set.
    const { resolveEmailSettings, registerAuthLocale, de } = await freshResolve();
    const logger = spyLogger();

    registerAuthLocale('de', de);

    expect(resolveEmailSettings(configWith('de', logger)).t).toBe(de);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns per locale, not once overall', async () => {
    const { resolveEmailSettings } = await freshResolve();
    const logger = spyLogger();

    resolveEmailSettings(configWith('de', logger));
    resolveEmailSettings(configWith('fr', logger));

    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('says nothing when no locale is configured', async () => {
    const { resolveEmailSettings, en } = await freshResolve();
    const logger = spyLogger();

    expect(resolveEmailSettings(configWith(undefined, logger)).t).toBe(en);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('survives a logger that throws', async () => {
    // Shielded like every other auth log site: a broken transport must not
    // stop the mail this call is resolving settings for.
    const { resolveEmailSettings, en } = await freshResolve();
    const logger: AuthLogger = {
      warn: () => {
        throw new Error('transport down');
      },
      error: () => {}
    };

    expect(resolveEmailSettings(configWith('de', logger)).t).toBe(en);
  });
});
