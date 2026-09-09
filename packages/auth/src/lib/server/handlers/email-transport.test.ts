import { describe, expect, it } from 'vitest';
import type { AuthDeps } from '../deps.js';
import { createMockAuthDeps } from '../test-utils.js';
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
import { createUpdateProfileHandler } from './update-profile.js';
import { createVerifyEmailHandler } from './verify-email.js';
import { createVerifyEmailChangeHandler } from './verify-email-change.js';

/** The bundle of a consumer who hands in no mail transport at all. */
function noTransport(): AuthDeps {
  const { email: _unused, ...deps } = createMockAuthDeps();
  return deps;
}

/**
 * Every factory that reaches `EmailTransport.send`, with the arguments a
 * consumer would mount it with. Each must refuse to mount without a transport,
 * naming itself — the requirement sits where the answer to "does this app send
 * mail?" is known, which is here and not at `createAuthDeps`.
 */
const MAILING: ReadonlyArray<[name: string, mount: (deps: AuthDeps) => unknown]> = [
  ['createRegisterHandler', (deps) => createRegisterHandler(deps)],
  ['createForgotPasswordHandler', (deps) => createForgotPasswordHandler(deps)],
  ['createChangeEmailHandler', (deps) => createChangeEmailHandler(deps)],
  [
    'createInvitationHandlers',
    (deps) => createInvitationHandlers(deps, { authorize: () => true, roles: ['admin'] })
  ]
];

/**
 * The factories a session-only deployment mounts — login and logout at the
 * least, and everything else that never mails. None of them may ask for a
 * transport: that is the whole point of the optional `deps.email`.
 */
const TRANSPORT_FREE: ReadonlyArray<[name: string, mount: (deps: AuthDeps) => unknown]> = [
  ['createLoginHandler', (deps) => createLoginHandler(deps)],
  ['createLogoutHandler', (deps) => createLogoutHandler(deps)],
  ['createMeHandler', (deps) => createMeHandler(deps)],
  ['createRefreshHandler', (deps) => createRefreshHandler(deps)],
  ['createResetPasswordHandler', (deps) => createResetPasswordHandler(deps)],
  ['createVerifyEmailHandler', (deps) => createVerifyEmailHandler(deps)],
  ['createVerifyEmailChangeHandler', (deps) => createVerifyEmailChangeHandler(deps)],
  ['createChangePasswordHandler', (deps) => createChangePasswordHandler(deps)],
  ['createUpdateProfileHandler', (deps) => createUpdateProfileHandler(deps)],
  ['createDeleteAccountHandler', (deps) => createDeleteAccountHandler(deps)],
  ['createPasswordPolicyHandler', (deps) => createPasswordPolicyHandler(deps)],
  ['createSessionsHandlers', (deps) => createSessionsHandlers(deps)]
];

describe('deps.email is required by the factories that mail, not at wiring', () => {
  it.each(MAILING)('%s throws at mount without a transport', (name, mount) => {
    expect(() => mount(noTransport())).toThrowError(
      // The name is in the message twice on purpose — what to pass, and what to
      // drop instead — so assert on both halves of the sentence.
      new RegExp(`\\[auth\\] deps\\.email is missing but ${name} sends mail\\..*${name}`, 's')
    );
  });

  it.each(MAILING)('%s mounts unchanged with a transport', (_name, mount) => {
    expect(() => mount(createMockAuthDeps())).not.toThrow();
  });

  it.each(TRANSPORT_FREE)('%s mounts without a transport', (_name, mount) => {
    expect(() => mount(noTransport())).not.toThrow();
  });
});
