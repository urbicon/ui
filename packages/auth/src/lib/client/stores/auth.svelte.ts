import type { AuthUser } from '../../types.js';
import type { CsrfClientOptions } from '../csrf.js';
import { csrfFetch } from '../csrf.js';
import { getJson, postJson, wireError } from '../utils/http.js';

export interface AuthStoreConfig {
  basePath?: string;
  /**
   * CSRF cookie/header names — only needed when the server overrides the
   * defaults via `config.csrf.cookieName`/`headerName`. Omit to use the
   * package defaults. Mutating requests echo the CSRF token automatically;
   * when no token cookie exists the request is sent unchanged (origin-only
   * mode keeps working).
   */
  csrf?: CsrfClientOptions;
  /**
   * Custom fetch implementation for all API calls. Defaults to the global
   * `fetch`. Useful for mock backends in demos/tests or custom retry layers —
   * the same injection point every component exposes (review R18).
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

const NETWORK_FAILURE: AuthActionResult = { success: false, code: 'network_error' };

export function createAuthStore<R extends string>(config?: AuthStoreConfig) {
  const basePath = config?.basePath ?? '/api/auth';
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
        `${basePath}/login`,
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
      user = (data.user as AuthUser<R> | undefined) ?? null;
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
      const { ok, data } = await postJson(`${basePath}/2fa/verify`, { code }, { csrf, fetcher });
      if (!ok) return failure(data);
      user = (data.user as AuthUser<R> | undefined) ?? null;
      twoFactorRequired = false;
      return { success: true };
    } catch {
      return NETWORK_FAILURE;
    }
  }

  async function register(
    name: string,
    email: string,
    password: string
  ): Promise<AuthActionResult> {
    try {
      const { ok, data } = await postJson(
        `${basePath}/register`,
        { name, email, password },
        { csrf, fetcher }
      );
      if (!ok) return failure(data);
      user = (data.user as AuthUser<R> | undefined) ?? null;
      return { success: true };
    } catch {
      return NETWORK_FAILURE;
    }
  }

  /**
   * End the session. The local state is cleared unconditionally — the user
   * asked to leave, so the UI must not stay signed-in — but the result still
   * reports whether the server actually revoked the session (a failed logout
   * leaves the cookies valid; a caller may want to retry or warn).
   */
  async function logout(): Promise<AuthActionResult> {
    let result: AuthActionResult;
    try {
      const res = await csrfFetch(`${basePath}/logout`, { method: 'POST' }, csrf, fetcher);
      result = res.ok ? { success: true } : { success: false };
    } catch {
      result = NETWORK_FAILURE;
    }
    user = null;
    twoFactorRequired = false;
    return result;
  }

  async function checkStatus(): Promise<void> {
    try {
      loading = true;
      const { data } = await getJson(`${basePath}/me`, { fetcher });
      user = (data.user as AuthUser<R> | undefined) ?? null;
      if (user) twoFactorRequired = false;
    } catch {
      user = null;
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
