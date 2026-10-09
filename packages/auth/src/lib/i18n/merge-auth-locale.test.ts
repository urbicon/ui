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

  it('is kind-preserving: null/array/primitive over a subtree keeps the base', () => {
    // JSON is the natural carrier for consumer override files and cannot
    // express `undefined` — a hand-written `null` must not blank a subtree
    // the merge promises to keep complete (silent-failure review M1).
    const overrides = JSON.parse(
      '{"auth": null, "passkeys": ["nope"], "sessions": 42, "account": {"profile": {"title": "Mein Profil"}}}'
    );
    const merged = mergeAuthLocale(en, overrides);
    expect(merged.auth.login.title).toBe(en.auth.login.title);
    expect(merged.passkeys.title).toBe(en.passkeys.title);
    expect(merged.sessions.title).toBe(en.sessions.title);
    // the well-formed sibling in the same overrides object still applies
    expect(merged.account.profile.title).toBe('Mein Profil');
  });

  it('is kind-preserving: an object over a string leaf keeps the base string', () => {
    const overrides = JSON.parse('{"auth": {"login": {"title": {"nested": "x"}, "submit": 7}}}');
    const merged = mergeAuthLocale(en, overrides);
    expect(merged.auth.login.title).toBe(en.auth.login.title);
    expect(merged.auth.login.submit).toBe(en.auth.login.submit);
  });

  it('ignores __proto__/constructor keys from JSON-loaded overrides', () => {
    const overrides = JSON.parse(
      '{"__proto__": {"polluted": true}, "constructor": {"x": 1}, "auth": {"login": {"title": "Hi"}}}'
    );
    const merged = mergeAuthLocale(en, overrides);
    expect(merged.auth.login.title).toBe('Hi');
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(
      (merged as unknown as Record<string, unknown>).polluted,
      'merged bundle must not be reparented'
    ).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted, 'no global pollution').toBeUndefined();
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
