import {
  DEFAULT_PASSWORD_POLICY,
  type PasswordPolicy,
  parsePasswordPolicy
} from '../../password-policy.js';
import { getJson } from './http.js';

/** Where a component reads its policy from. Re-read on every effect run, so props stay reactive. */
export interface PasswordPolicySource {
  /** Policy supplied by the consumer (e.g. from a `+page.server.ts` load). Wins, and skips the request. */
  policy?: PasswordPolicy;
  /** Endpoint serving `createPasswordPolicyHandler`. `null` disables the request. */
  path?: string | null;
  /** Custom fetch, forwarded from the component's `fetcher` prop. */
  fetcher?: typeof globalThis.fetch;
}

/**
 * GET the server's password policy. Returns `null` when the endpoint is not
 * mounted or unreachable — the caller then keeps {@link DEFAULT_PASSWORD_POLICY},
 * which is what an unconfigured server enforces, so the gate still matches.
 * A deployment that *has* configured `config.password` and has NOT mounted the
 * route is the one case where client and server can still disagree; that is
 * what the DEV warning names.
 */
export async function fetchPasswordPolicy(
  path: string,
  fetcher?: typeof globalThis.fetch
): Promise<PasswordPolicy | null> {
  try {
    const { ok, data } = await getJson(path, { fetcher });
    if (!ok) {
      if (import.meta.env?.DEV) {
        console.warn(
          `[auth] ${path} did not answer with a password policy — the form falls back to the package defaults (min ${DEFAULT_PASSWORD_POLICY.minLength}, no character classes). Mount createPasswordPolicyHandler there, or pass the policy as the passwordPolicy prop.`
        );
      }
      return null;
    }
    return parsePasswordPolicy(data.policy);
  } catch {
    // Offline / CORS: the form still works, it just gates on the defaults.
    return null;
  }
}

/**
 * The password policy a form should gate against: the consumer's prop if it
 * has one, otherwise the server's, otherwise the package defaults. The request
 * runs in an effect, so it never fires during SSR and never fires twice for a
 * prop-supplied policy.
 */
export function usePasswordPolicy(read: () => PasswordPolicySource): {
  readonly current: PasswordPolicy;
} {
  let loaded = $state<PasswordPolicy | null>(null);

  $effect(() => {
    const { policy, path, fetcher } = read();
    if (policy || path == null) return;
    let cancelled = false;
    void fetchPasswordPolicy(path, fetcher).then((fetched) => {
      if (!cancelled && fetched) loaded = fetched;
    });
    return () => {
      cancelled = true;
    };
  });

  return {
    get current() {
      return read().policy ?? loaded ?? DEFAULT_PASSWORD_POLICY;
    }
  };
}
