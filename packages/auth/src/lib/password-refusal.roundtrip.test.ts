import { describe, expect, it } from 'vitest';
import { errorMessageFromCode } from './client/utils/error-message.js';
import {
  passwordRefusalFromBody,
  passwordRefusalMessage
} from './client/utils/password-policy.svelte.js';
import { de } from './i18n/de.js';
import { DEFAULT_PASSWORD_POLICY, unmetPasswordRules } from './password-policy.js';
import { createRegisterHandler } from './server/handlers/register.js';
import { createMockAuthDeps, mockPostEvent } from './server/test-utils.js';

/**
 * The one path #290 is about, end to end: a server that configured
 * `minLength: 12`, a deployment that did NOT mount the policy endpoint, and a
 * German user. The client then gates on the package defaults, lets an 8-character
 * password through, and the server refuses it.
 *
 * The parts are tested in isolation next to each of them; this pins the seam,
 * because every one of them can be right while the wire field is dropped
 * somewhere in between — which is how the English string survived the first
 * round of this work.
 */
describe('a password refusal survives the wire as something a localized form can render', () => {
  const password = 'abcdefgh'; // 8 characters

  async function refuseIt() {
    const deps = createMockAuthDeps({
      config: { jwt: { secret: 's' }, appUrl: 'https://a.test', password: { minLength: 12 } }
    });
    const res = await createRegisterHandler(deps).POST(
      mockPostEvent({ email: 'a@b.test', name: 'A', password, token: 't' }) as never
    );
    return { res, body: (await res.json()) as Record<string, unknown> };
  }

  it('the form-side gate really does let this password through (the premise)', () => {
    expect(unmetPasswordRules(password, DEFAULT_PASSWORD_POLICY)).toEqual([]);
  });

  it('the ordinary code+prose chain still yields the English sentence', async () => {
    // Not a bug in `errorMessageFromCode`: it prefers the server prose for
    // `validation_error` on purpose, because that text names the field. This is
    // the string the refusal fields exist to replace.
    const { body } = await refuseIt();
    expect(errorMessageFromCode(body.code as string, de, body.error as string)).toBe(
      'Password must be at least 12 characters'
    );
  });

  it('the refusal fields yield a German sentence naming the rule', async () => {
    const { res, body } = await refuseIt();
    expect(res.status).toBe(400);
    const refusal = passwordRefusalFromBody(body);
    expect(refusal, 'the handler must ship rules + passwordPolicy').not.toBeNull();
    expect(passwordRefusalMessage(refusal!, de)).toBe(
      'Dein Passwort erfüllt die Anforderungen nicht: Mindestens 12 Zeichen'
    );
  });

  it('and the adopted policy refuses the same password locally on the next attempt', async () => {
    // Without adoption the user retries against the same 8-character gate and
    // is refused again by a rule the form still does not show — a loop.
    const { body } = await refuseIt();
    const refusal = passwordRefusalFromBody(body)!;
    expect(refusal.policy.minLength).toBe(12);
    expect(unmetPasswordRules(password, refusal.policy)).toEqual(['minLength']);
  });
});
