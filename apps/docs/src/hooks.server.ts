import type { Handle } from '@sveltejs/kit';
import { createAuthHandle } from '@urbicon-ui/auth/server';
import { dev } from '$app/environment';
import { testAuthDeps } from '$lib/server/test-auth.js';

// Auth handle is scoped to the E2E test fixtures only. The rest of the
// docs site is marketing/reference content that doesn't want session
// enforcement, CSRF, or redirect-on-401 behaviour.
const authHandle = createAuthHandle({
  config: testAuthDeps.config,
  repos: testAuthDeps.repos,
  publicRoutes: [
    '/test-fixtures/auth/login',
    '/test-fixtures/auth/register',
    '/test-fixtures/auth/api/'
  ]
});

const TEST_AUTH_SCOPE = '/test-fixtures/auth';

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith(TEST_AUTH_SCOPE)) {
    // The fixture routes wipe state, mint cookies, and expose a known-password
    // admin account. Hard-404 them outside `bun run dev` so a prod docs build
    // cannot expose a world-reset or cookie-issuing surface to visitors.
    if (!dev) {
      return new Response('Not found', { status: 404 });
    }
    return authHandle({ event, resolve });
  }
  return resolve(event);
};
