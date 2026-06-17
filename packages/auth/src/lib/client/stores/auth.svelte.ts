import type { AuthUser } from '../../types.js';
import { type CsrfClientOptions, csrfFetch } from '../csrf.js';

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
}

export function createAuthStore<R extends string>(config?: AuthStoreConfig) {
  const basePath = config?.basePath ?? '/api/auth';
  const csrf = config?.csrf;

  let user = $state<AuthUser<R> | null>(null);
  let loading = $state(true);
  // Set when a password login succeeds but the account has 2FA on: the caller
  // must collect a code and call verifyTwoFactor before a session exists.
  let twoFactorRequired = $state(false);
  const isAuthenticated = $derived(user !== null);

  async function login(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; twoFactorRequired?: boolean }> {
    try {
      const res = await csrfFetch(
        `${basePath}/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        },
        csrf
      );
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error ?? 'Login failed' };
      }
      // The password was correct but a second factor is required: do NOT set
      // `user` (there is no session yet). The caller shows a code-entry step
      // that calls verifyTwoFactor.
      if (data.twoFactorRequired) {
        twoFactorRequired = true;
        return { success: true, twoFactorRequired: true };
      }
      user = data.user;
      twoFactorRequired = false;
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Complete a 2FA login by submitting the authenticator code (or a backup
   * code). Only meaningful after `login` returned `twoFactorRequired`. On
   * success the session is established and `user` is populated.
   */
  async function verifyTwoFactor(code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await csrfFetch(
        `${basePath}/2fa/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        },
        csrf
      );
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error ?? 'Verification failed' };
      }
      user = data.user;
      twoFactorRequired = false;
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }

  async function register(
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await csrfFetch(
        `${basePath}/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        },
        csrf
      );
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error ?? 'Registration failed' };
      }
      user = data.user;
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }

  async function logout(): Promise<void> {
    await csrfFetch(`${basePath}/logout`, { method: 'POST' }, csrf);
    user = null;
    twoFactorRequired = false;
  }

  async function checkStatus(): Promise<void> {
    try {
      loading = true;
      const res = await fetch(`${basePath}/me`);
      const data = await res.json();
      user = data.user ?? null;
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
