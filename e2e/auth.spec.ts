import { expect, type Page, test } from '@playwright/test';

/**
 * E2E coverage for the `@urbicon-ui/auth` kernel flow. Walks a user through
 * the whole lifecycle exactly as a browser would, against an in-memory
 * harness wired up in `apps/docs/src/lib/server/test-auth.ts`:
 *
 *   1. seed a fresh world
 *   2. invited user registers → session cookie + refresh cookie set
 *   3. log out → cookies cleared → protected route redirects to login
 *   4. log in again with the password → protected route renders
 *   5. drop the access cookie and hit a protected route → the handle
 *      hook transparently rotates the refresh cookie and the user stays
 *      signed in
 *   6. replay the revoked refresh cookie → handle hook detects reuse and
 *      invalidates the whole family
 */

const TEST_USER = { email: 'alice@test.local', name: 'Alice', password: 'AliceSecret123' };
/**
 * The raw token of the invitation `seedWorld` creates for that address.
 *
 * Registration is gated on holding it and on nothing else (#149) — knowing the
 * invited address stopped being proof of anything. The seed uses a fixed token
 * (see `hashToken('seed-invitation-token')` in `test-auth.ts`) precisely so this
 * walk-through can present one; a real invitation gets a random one that leaves
 * the server once, in the invite link.
 */
const INVITATION_TOKEN = 'seed-invitation-token';
// Mirrors playwright.config.ts's PORT override — a hardcoded 5174 here makes
// the auth CSRF gate 403 every seed call under `PORT=<n>` session isolation.
const ORIGIN = `http://localhost:${Number(process.env.PORT ?? 5174)}`;

async function seedWorld(page: Page) {
  const res = await page.request.post('/test-fixtures/auth/api/reset', {
    headers: { origin: ORIGIN }
  });
  expect(res.status()).toBe(200);
}

async function register(page: Page) {
  const res = await page.request.post('/test-fixtures/auth/api/register', {
    data: { ...TEST_USER, token: INVITATION_TOKEN },
    headers: { origin: ORIGIN }
  });
  expect(res.status()).toBe(201);
}

// The only suite in this repo that drives shared SERVER state: every test calls
// `seedWorld`, which POSTs to `/test-fixtures/auth/api/reset` and wipes the
// in-memory world for the whole dev server. Two of these running at once means
// one test resets the world the other is mid-way through — which is exactly what
// happened when the suite was first run fully parallel (logout and
// wrong-password both failed at `workers: 16`, passing at 8 only by timing
// luck). Pin the isolation here rather than relying on a low worker count:
// other spec files still run alongside this one, they just do not touch auth.
test.describe.configure({ mode: 'serial' });

test.describe('Auth kernel flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-fixtures/auth');
    await seedWorld(page);
  });

  test('register → protected route renders the user', async ({ page }) => {
    await register(page);

    await page.goto('/test-fixtures/auth/protected');
    await expect(page.getByTestId('protected-user')).toHaveText(`Signed in as ${TEST_USER.email}`);
  });

  // #149. The unit tests pin the handler's decision; this pins the whole path —
  // real CSRF gate, real handler, real adapter — because the property being
  // defended is "no account exists at the end", and only this layer can say so.
  test('registration without the invitation token creates no account', async ({ page }) => {
    const noToken = await page.request.post('/test-fixtures/auth/api/register', {
      data: TEST_USER,
      headers: { origin: ORIGIN }
    });
    expect(noToken.status(), 'a missing token is a malformed request').toBe(400);

    // Knowing the invited address used to be the entire proof. It is now worth
    // nothing without the token that came with it.
    const guessed = await page.request.post('/test-fixtures/auth/api/register', {
      data: { ...TEST_USER, token: 'a-guessed-token' },
      headers: { origin: ORIGIN }
    });
    expect(guessed.status()).toBe(403);
    expect((await guessed.json()).code).toBe('invitation_required');

    // And no session was established by either attempt.
    await page.goto('/test-fixtures/auth/protected');
    await expect(page.getByTestId('protected-user')).toHaveCount(0);

    // The invitation survives both attempts — a failed guess must not burn it,
    // which is how the original defect locked the genuine invitee out.
    await register(page);
    await page.goto('/test-fixtures/auth/protected');
    await expect(page.getByTestId('protected-user')).toHaveText(`Signed in as ${TEST_USER.email}`);
  });

  test('logout clears cookies and redirects protected route to login', async ({ page }) => {
    await register(page);

    await page.goto('/test-fixtures/auth/protected');
    await expect(page.getByTestId('protected-user')).toBeVisible();

    const logoutRes = await page.request.post('/test-fixtures/auth/api/logout', {
      headers: { origin: ORIGIN }
    });
    expect(logoutRes.status()).toBe(200);

    // After the server-side logout the cookies are gone — hitting a
    // protected route redirects to the login page.
    await page.goto('/test-fixtures/auth/protected');
    await expect(page).toHaveURL(/\/test-fixtures\/auth\/login/);
  });

  test('login via API signs the user in and the protected route renders', async ({ page }) => {
    await register(page);
    await page.context().clearCookies();

    const loginRes = await page.request.post('/test-fixtures/auth/api/login', {
      data: { email: TEST_USER.email, password: TEST_USER.password },
      headers: { origin: ORIGIN }
    });
    expect(loginRes.status()).toBe(200);

    await page.goto('/test-fixtures/auth/protected');
    await expect(page.getByTestId('protected-user')).toHaveText(`Signed in as ${TEST_USER.email}`);
  });

  test('wrong password does not sign the user in', async ({ page }) => {
    await register(page);
    await page.context().clearCookies();

    const res = await page.request.post('/test-fixtures/auth/api/login', {
      data: { email: TEST_USER.email, password: 'wrong-password' },
      headers: { origin: ORIGIN }
    });
    expect(res.status()).toBe(401);

    // Cookies weren't set → the protected route still redirects.
    await page.goto('/test-fixtures/auth/protected');
    await expect(page).toHaveURL(/\/test-fixtures\/auth\/login/);
  });

  test('handle hook transparently rotates the refresh cookie when the access cookie is missing', async ({
    page
  }) => {
    await register(page);

    // Drop only the access cookie — keep the refresh cookie so the hook can rotate.
    const cookies = await page.context().cookies();
    const refresh = cookies.find((c) => c.name === 'refresh');
    expect(refresh, 'refresh cookie was not issued by register').toBeDefined();

    await page.context().clearCookies();
    await page.context().addCookies([refresh!]);

    const oldRefreshValue = refresh!.value;

    await page.goto('/test-fixtures/auth/protected');
    await expect(page.getByTestId('protected-user')).toHaveText(`Signed in as ${TEST_USER.email}`);

    // After the hook ran, both cookies are present again and the refresh value rotated.
    const after = await page.context().cookies();
    expect(after.find((c) => c.name === 'session')).toBeDefined();
    expect(after.find((c) => c.name === 'refresh')?.value).not.toBe(oldRefreshValue);

    // Replay the just-revoked refresh cookie. Within the 10 s
    // concurrent-rotation grace (ROTATION_GRACE_MS, refresh-token.ts) this is
    // DELIBERATELY served as a parallel-request race (`race_ok`), not a
    // replay: a real browser fires overlapping requests the moment the access
    // cookie expires, and hard reuse-detection here would log the loser out.
    // The genuine replay — outside the window → whole family revoked — needs
    // fake timers and is pinned by the unit suite (refresh-token.test.ts,
    // "detects reuse … outside the window" / "treats a replay inside the
    // window as a concurrent-rotation race"). This spec's earlier 302/401
    // expectation predated the grace and only survived because the CI e2e job
    // is red on the darwin-snapshot debt.
    await page.context().clearCookies();
    await page.context().addCookies([refresh!]);
    const res = await page.request.get('/test-fixtures/auth/protected', {
      maxRedirects: 0
    });
    expect(res.status()).toBe(200);
  });
});
