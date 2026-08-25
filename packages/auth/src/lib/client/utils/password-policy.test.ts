import { describe, expect, it, vi } from 'vitest';
import { de } from '../../i18n/de.js';
import { en } from '../../i18n/en.js';
import { DEFAULT_PASSWORD_POLICY } from '../../password-policy.js';
import {
  fetchPasswordPolicy,
  type PasswordRefusal,
  passwordRefusalFromBody,
  passwordRefusalMessage
} from './password-policy.svelte.js';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  ) as unknown as typeof globalThis.fetch;

describe('fetchPasswordPolicy', () => {
  it('reads the policy the endpoint published', async () => {
    const policy = { ...DEFAULT_PASSWORD_POLICY, minLength: 14, requireDigit: true };
    expect(
      await fetchPasswordPolicy('/api/auth/password-policy', respond(200, { policy }))
    ).toEqual(policy);
  });

  it('answers null when the route is not mounted, so the caller keeps the defaults', async () => {
    // A 404 here is the ordinary "consumer has not added the +server.ts yet"
    // case; the form must still work, gating on what an unconfigured server
    // enforces rather than on nothing.
    expect(await fetchPasswordPolicy('/api/auth/password-policy', respond(404, {}))).toBeNull();
  });

  it('answers null instead of throwing inside a component effect when the request fails', async () => {
    const boom = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(
      await fetchPasswordPolicy(
        '/api/auth/password-policy',
        boom as unknown as typeof globalThis.fetch
      )
    ).toBeNull();
  });

  it('tolerates a body without a policy field', async () => {
    expect(await fetchPasswordPolicy('/x', respond(200, { nope: 1 }))).toEqual(
      DEFAULT_PASSWORD_POLICY
    );
  });
});

describe('passwordRefusalFromBody / passwordRefusalMessage', () => {
  const refusalBody = {
    error: 'Password must be at least 12 characters',
    code: 'validation_error',
    errors: ['Password must be at least 12 characters'],
    rules: ['minLength'],
    passwordPolicy: { ...DEFAULT_PASSWORD_POLICY, minLength: 12 }
  };

  it('renders the localized rules, not the English server prose', () => {
    // The whole point: `errorMessageFromCode` prefers the server prose for
    // `validation_error`, so without this path a German user reads
    // "Password must be at least 12 characters".
    const refusal = passwordRefusalFromBody(refusalBody);
    expect(refusal).not.toBeNull();
    const msg = passwordRefusalMessage(refusal as PasswordRefusal, de);
    expect(msg).toBe(
      de.auth.passwordRequirements.failed.replace('{rules}', 'Mindestens 12 Zeichen')
    );
    expect(msg).not.toContain('Password must be');
  });

  it("takes {n} from the SERVER's policy, not from the policy the form gated on", () => {
    // The form measured against 8 and let the password through; the refusal
    // says 12. Rendering the form's number would name a rule that passed.
    const msg = passwordRefusalMessage(passwordRefusalFromBody(refusalBody) as PasswordRefusal, en);
    expect(msg).toContain('At least 12 characters');
    expect(msg).not.toContain('At least 8');
  });

  it('joins several failing rules in PASSWORD_RULES order', () => {
    const refusal = passwordRefusalFromBody({
      ...refusalBody,
      // Deliberately out of order on the wire.
      rules: ['digit', 'minLength']
    }) as PasswordRefusal;
    expect(refusal.rules).toEqual(['minLength', 'digit']);
    expect(passwordRefusalMessage(refusal, en)).toContain('At least 12 characters · One digit');
  });

  it('ignores a body that is not a password refusal', () => {
    expect(passwordRefusalFromBody({ code: 'invalid_credentials' })).toBeNull();
    // An older server: validation_error with no machine rules — the caller
    // falls through to the ordinary code/prose chain.
    expect(
      passwordRefusalFromBody({ code: 'validation_error', error: 'Email is invalid' })
    ).toBeNull();
    expect(passwordRefusalFromBody({ code: 'validation_error', rules: ['not-a-rule'] })).toBeNull();
  });

  it('falls back to the shipped policy when the body omits it', () => {
    const refusal = passwordRefusalFromBody({
      code: 'validation_error',
      rules: ['uppercase']
    }) as PasswordRefusal;
    expect(refusal.policy).toEqual(DEFAULT_PASSWORD_POLICY);
  });
});
