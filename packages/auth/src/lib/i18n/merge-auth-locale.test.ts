import { describe, expect, it } from 'vitest';
import { de } from './de.js';
import { en } from './en.js';
import { mergeAuthLocale } from './index.js';

describe('mergeAuthLocale', () => {
  it('returns the base bundle itself when there is nothing to merge', () => {
    expect(mergeAuthLocale(en)).toBe(en);
    expect(mergeAuthLocale(en, undefined)).toBe(en);
  });

  it('overrides a single leaf without touching any sibling key', () => {
    const merged = mergeAuthLocale(en, { auth: { login: { title: 'Welcome back' } } });
    expect(merged.auth.login.title).toBe('Welcome back');
    // siblings + unrelated trees stay intact — the R19 guarantee that a
    // one-string override never blanks the rest of the bundle
    expect(merged.auth.login.submit).toBe(en.auth.login.submit);
    expect(merged.auth.errors.serverError).toBe(en.auth.errors.serverError);
    expect(merged.account.delete.confirmTitle).toBe(en.account.delete.confirmTitle);
  });

  it('merges whole subtrees recursively', () => {
    const merged = mergeAuthLocale(de, {
      account: { profile: { title: 'Profil bearbeiten' } },
      common: { timeAgo: { now: 'jetzt' } }
    });
    expect(merged.account.profile.title).toBe('Profil bearbeiten');
    expect(merged.account.profile.save).toBe(de.account.profile.save);
    expect(merged.common.timeAgo.now).toBe('jetzt');
    expect(merged.common.timeAgo.minutes).toBe(de.common.timeAgo.minutes);
  });

  it('skips explicit undefined entries instead of erasing the base value', () => {
    const merged = mergeAuthLocale(en, { auth: { login: { title: undefined } } });
    expect(merged.auth.login.title).toBe(en.auth.login.title);
  });

  it('never mutates the base bundle', () => {
    const before = JSON.stringify(en);
    const merged = mergeAuthLocale(en, { passkeys: { title: 'Hardware keys' } });
    expect(merged.passkeys.title).toBe('Hardware keys');
    expect(JSON.stringify(en)).toBe(before);
    expect(en.passkeys.title).not.toBe('Hardware keys');
  });

  it('a stale consumer bundle missing new keys still resolves them from the base', () => {
    // Simulates the runtime-stale JS bundle case: a hand-rolled locale written
    // before `networkError`/`passkeys.cancelled` existed. The merge fills the
    // gaps from the built-in bundle — the structural fix for the empty-error
    // region noted in the package-4 review.
    const stale = { auth: { errors: { serverError: 'Custom oops' } } };
    const merged = mergeAuthLocale(en, stale);
    expect(merged.auth.errors.serverError).toBe('Custom oops');
    expect(merged.auth.errors.networkError).toBe(en.auth.errors.networkError);
    expect(merged.passkeys.cancelled).toBe(en.passkeys.cancelled);
  });
});
