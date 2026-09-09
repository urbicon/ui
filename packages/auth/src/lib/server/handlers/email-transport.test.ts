import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../../types.js';
import { createInMemoryRepos } from '../adapters/in-memory.js';
import type { AuthDeps } from '../deps.js';
import { createAuthDeps } from '../deps.js';
import { createAuthHandle } from '../handle.js';
import { createInMemoryChallengeStore } from '../passkey/challenge-store.js';
import { createPasskeyHandlers } from '../passkey/handlers.js';
import { createChangeEmailHandler } from './change-email.js';
import { createChangePasswordHandler } from './change-password.js';
import { createDeleteAccountHandler } from './delete-account.js';
import { createForgotPasswordHandler } from './forgot-password.js';
import { createInvitationHandlers } from './invitation.js';
import { createLoginHandler } from './login.js';
import { createLogoutHandler } from './logout.js';
import { createMeHandler } from './me.js';
import { createPasswordPolicyHandler } from './password-policy.js';
import { createRefreshHandler } from './refresh.js';
import { createRegisterHandler } from './register.js';
import { createResetPasswordHandler } from './reset-password.js';
import { createSessionsHandlers } from './sessions.js';
import { createTwoFactorHandlers } from './two-factor.js';
import { createUpdateProfileHandler } from './update-profile.js';
import { createVerifyEmailHandler } from './verify-email.js';
import { createVerifyEmailChangeHandler } from './verify-email-change.js';

// Its own secret: the repeat-bundle warning and the rate-limit counters are
// keyed process-wide on a fingerprint of it, so a shared literal would couple
// this file to whichever other suite ran first.
const SECRET = 'email-optional-suite-secret';

function config(): AuthConfig {
  return {
    appUrl: 'https://app.test',
    jwt: { secret: SECRET },
    // Keep the wiring warnings (repeat bundle) out of the run's stderr.
    logger: { warn: vi.fn(), error: vi.fn() }
  };
}

/**
 * The bundle a login/logout-only app builds. The call compiles **because**
 * `AuthDeps.email` is optional — that is the type-level half of this file, and
 * `svelte-check` is what enforces it.
 */
function depsWithoutEmail(): AuthDeps {
  return createAuthDeps({ config: config(), repos: createInMemoryRepos() });
}

function depsWithEmail(): AuthDeps {
  return createAuthDeps({
    config: config(),
    repos: createInMemoryRepos(),
    email: { send: vi.fn() }
  });
}

const webauthn = {
  rpId: 'app.test',
  rpName: 'Test',
  origin: 'https://app.test',
  challengeStore: createInMemoryChallengeStore()
};

/** Every factory whose handler can reach `email.send`. */
const mailingFactories: [name: string, mount: (deps: AuthDeps) => unknown][] = [
  ['createRegisterHandler', (deps) => createRegisterHandler(deps)],
  ['createForgotPasswordHandler', (deps) => createForgotPasswordHandler(deps)],
  ['createChangeEmailHandler', (deps) => createChangeEmailHandler(deps)],
  [
    'createInvitationHandlers',
    (deps) => createInvitationHandlers(deps, { authorize: () => true, roles: ['admin'] })
  ]
];

/** Every other factory that takes the bundle, plus the mandatory handle hook. */
const transportFreeFactories: [name: string, mount: (deps: AuthDeps) => unknown][] = [
  ['createLoginHandler', (deps) => createLoginHandler(deps)],
  ['createLogoutHandler', (deps) => createLogoutHandler(deps)],
  ['createMeHandler', (deps) => createMeHandler(deps)],
  ['createRefreshHandler', (deps) => createRefreshHandler(deps)],
  ['createSessionsHandlers', (deps) => createSessionsHandlers(deps)],
  ['createTwoFactorHandlers', (deps) => createTwoFactorHandlers(deps)],
  ['createChangePasswordHandler', (deps) => createChangePasswordHandler(deps)],
  ['createDeleteAccountHandler', (deps) => createDeleteAccountHandler(deps)],
  ['createUpdateProfileHandler', (deps) => createUpdateProfileHandler(deps)],
  ['createVerifyEmailHandler', (deps) => createVerifyEmailHandler(deps)],
  ['createVerifyEmailChangeHandler', (deps) => createVerifyEmailChangeHandler(deps)],
  ['createResetPasswordHandler', (deps) => createResetPasswordHandler(deps)],
  ['createPasswordPolicyHandler', (deps) => createPasswordPolicyHandler(deps)],
  ['createPasskeyHandlers', (deps) => createPasskeyHandlers(deps, webauthn)],
  [
    'createAuthHandle',
    (deps) => createAuthHandle({ config: deps.config, repos: createInMemoryRepos() })
  ]
];

describe('deps.email is required by the mailing factories only', () => {
  it('createAuthDeps builds a bundle with no transport', () => {
    expect(depsWithoutEmail().email).toBeUndefined();
  });

  it.each(mailingFactories)('%s throws at mount without a transport', (name, mount) => {
    const deps = depsWithoutEmail();
    // Synchronously, at the factory call — not on the first request. Three of
    // the four send their mail decoupled from the response, where a throw
    // reaches the logger at best and the user never.
    expect(() => mount(deps)).toThrow(`${name}: deps.email is required`);
  });

  it.each(mailingFactories)('%s mounts with a transport', (_name, mount) => {
    const deps = depsWithEmail();
    expect(() => mount(deps)).not.toThrow();
  });

  it.each(transportFreeFactories)('%s mounts without a transport', (_name, mount) => {
    const deps = depsWithoutEmail();
    expect(() => mount(deps)).not.toThrow();
  });
});
