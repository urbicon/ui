import type { AuthUser } from '../../types.js';
import type { CsrfClientOptions } from '../csrf.js';
import { csrfFetch } from '../csrf.js';
import { getJson, parseJsonBody, postJson, userFromSuccess, wireError } from '../utils/http.js';

export interface AuthStoreConfig {
  apiPath?: string;
  /**
   * CSRF cookie/header names. Only needed when the server overrides the
   * defaults via `config.csrf.cookieName`/`headerName`. Omit to use the
   * package defaults. Mutating requests echo the CSRF token automatically;
   * when no token cookie exists the request is sent unchanged (origin-only
   * mode keeps working).
   */
  csrf?: CsrfClientOptions;
  /**
   * Custom fetch implementation for all API calls. Defaults to the global
   * `fetch`. Useful for mock backends in demos/tests or custom retry layers —
   * the same injection point every component exposes.
   */
  fetcher?: typeof globalThis.fetch;
}

/**
 * Outcome of a store action. On failure it carries the server's wire contract
 * — machine `code` plus English `error` prose — instead of a hardcoded string,
 * so a consumer localizes it exactly like the components do:
 *
 * ```ts
 * const result = await auth.login(email, password);
 * if (!result.success) message = errorMessageFromCode(result.code, t, result.error) ?? t.common.error;
 * ```
 *
 * A request that never reached the server yields the client-synthesized
 * `code: 'network_error'` (mapped to `auth.errors.networkError`).
 */
export interface AuthActionResult {
  success: boolean;
  /** English server prose (the `error` field of the wire contract), if any. */
  error?: string;
  /** Machine error code (`AuthErrorCode` or the client-side `network_error`). */
  code?: string;
  twoFactorRequired?: boolean;
}

function failure(data: Record<string, unknown>): AuthActionResult {
  return { success: false, ...wireError(data) };
}

// Frozen: returned by reference from every network-failure path.
const NETWORK_FAILURE: AuthActionResult = Object.freeze({
  success: false,
  code: 'network_error'
});

// An `ok` body without the user it should carry (see `userFromSuccess`).
const MALFORMED_SUCCESS: AuthActionResult = Object.freeze({
  success: false,
  code: 'server_error'
});

/**
 * Runes store for session state (`user`, `isAuthenticated`, `loading`) plus the
 * five auth actions, for consumers that build their own forms or need the
 * session across routes (a layout guard, a header menu). Its routes are the
 * same handlers the pre-built pages call — `POST {apiPath}/login`,
 * `/register`, `/logout`, `/2fa/verify`, `GET {apiPath}/me`.
 *
 * The pages (`LoginPage`, `RegisterPage`) do **not** instantiate this store.
 * They own no session: they render a form, call the endpoint through the same
 * request core (`postJson` in `utils/http.ts` — one implementation of fetch,
 * CSRF and body parsing) and report `onSuccess`, leaving `user` to whichever
 * store the consumer holds. A second store inside a page would be state nobody
 * reads, disagreeing with the consumer's until its next `checkStatus()`. What
 * each side does with the parsed body is its own — the one rule both apply is
 * that a success status without `user` is not a success.
 */
export function createAuthStore<R extends string>(config?: AuthStoreConfig) {
  const apiPath = config?.apiPath ?? '/api/auth';
  const csrf = config?.csrf;
  const fetcher = config?.fetcher;

  let user = $state<AuthUser<R> | null>(null);
  let loading = $state(true);
  // Set when a password login succeeds but the account has 2FA on: the caller
  // must collect a code and call verifyTwoFactor before a session exists.
  let twoFactorRequired = $state(false);
  const isAuthenticated = $derived(user !== null);

  async function login(email: string, password: string): Promise<AuthActionResult> {
    try {
      const { ok, data } = await postJson(
        `${apiPath}/login`,
        { email, password },
        { csrf, fetcher }
      );
      if (!ok) return failure(data);
      // The password was correct but a second factor is required: do NOT set
      // `user` (there is no session yet). The caller shows a code-entry step
      // that calls verifyTwoFactor.
      if (data.twoFactorRequired) {
        twoFactorRequired = true;
        return { success: true, twoFactorRequired: true };
      }
      const signedIn = userFromSuccess<AuthUser<R>>(data);
      if (!signedIn) return MALFORMED_SUCCESS;
      user = signedIn;
      twoFactorRequired = false;
      return { success: true };
    } catch {
      return NETWORK_FAILURE;
    }
  }

  /**
   * Complete a 2FA login by submitting the authenticator code (or a backup
   * code). Only meaningful after `login` returned `twoFactorRequired`. On
   * success the session is established and `user` is populated.
   */
  async function verifyTwoFactor(code: string): Promise<AuthActionResult> {
    try {
      const { ok, data } = await postJson(`${apiPath}/2fa/verify`, { code }, { csrf, fetcher });
      if (!ok) return failure(data);
      const signedIn = userFromSuccess<AuthUser<R>>(data);
      if (!signedIn) return MALFORMED_SUCCESS;
      user = signedIn;
      twoFactorRequired = false;
      return { success: true };
    } catch {
      return NETWORK_FAILURE;
    }
  }

  async function register(
    name: string,
    email: string,
    password: string,
    /** The invitation token from the invite link's `?token=` — required (#149). */
    token: string
  ): Promise<AuthActionResult> {
    try {
      const { ok, data } = await postJson(
        `${apiPath}/register`,
        { name, email, password, token },
        { csrf, fetcher }
      );
      if (!ok) return failure(data);
      const signedIn = userFromSuccess<AuthUser<R>>(data);
      if (!signedIn) return MALFORMED_SUCCESS;
      user = signedIn;
      return { success: true };
    } catch {
      return NETWORK_FAILURE;
    }
  }

  /**
   * End the session. The local state is cleared unconditionally — the user
   * asked to leave, so the UI must not stay signed-in — but the result still
   * reports whether the server actually revoked the session (a failed logout
   * leaves the cookies valid; a caller may want to retry or warn, so the
   * failure carries the wire contract like every other action).
   */
  async function logout(): Promise<AuthActionResult> {
    let result: AuthActionResult;
    try {
      const res = await csrfFetch(`${apiPath}/logout`, { method: 'POST' }, csrf, fetcher);
      result = res.ok ? { success: true } : failure(await parseJsonBody(res));
    } catch {
      result = NETWORK_FAILURE;
    }
    user = null;
    twoFactorRequired = false;
    return result;
  }

  /**
   * Probe the session status (`GET /me`). "Signed out" and "could not ask"
   * are different facts: a 200 or the me-contract's `401 { user: null }`
   * resolves `user` and reports success; a transport failure or a non-contract
   * error (5xx, proxy body) leaves the current `user` untouched and reports
   * the failure — so a route guard can retry or wait instead of bouncing a
   * signed-in user to the login page over a transient blip.
   */
  async function checkStatus(): Promise<AuthActionResult> {
    try {
      loading = true;
      const { ok, data } = await getJson(`${apiPath}/me`, { fetcher });
      if (ok || 'user' in data) {
        user = (data.user as AuthUser<R> | undefined) ?? null;
        if (user) twoFactorRequired = false;
        return { success: true };
      }
      return failure(data);
    } catch {
      return NETWORK_FAILURE;
    } finally {
      loading = false;
    }
  }

  return {
    get user() {
      return user;
    },
    get loading() {
      return loading;
    },
    get isAuthenticated() {
      return isAuthenticated;
    },
    get twoFactorRequired() {
      return twoFactorRequired;
    },
    login,
    register,
    logout,
    checkStatus,
    verifyTwoFactor
  };
}
