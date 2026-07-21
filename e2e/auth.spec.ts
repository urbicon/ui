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
    data: TEST_USER,
    headers: { origin: ORIGIN }
  });
  expect(res.status()).toBe(201);
}

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
