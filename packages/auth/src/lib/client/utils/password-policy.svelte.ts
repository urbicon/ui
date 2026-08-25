import type { AuthLocale } from '../../i18n/keys.js';
import {
  DEFAULT_PASSWORD_POLICY,
  PASSWORD_RULES,
  type PasswordPolicy,
  type PasswordRuleId,
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
  adopt(policy: PasswordPolicy): void;
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
    },
    /**
     * Take the policy out of a server refusal. Without it the form would keep
     * gating on the policy it failed to read, so the user's next attempt is
     * refused by the same rule the checklist still does not show — a loop, not
     * a correction. The consumer's explicit `policy` prop still wins.
     */
    adopt(policy: PasswordPolicy) {
      loaded = policy;
    }
  };
}

/** A password the server refused, in machine form (see `passwordRefusal` on the server). */
export interface PasswordRefusal {
  /** The rules the password failed, in `PASSWORD_RULES` order. */
  rules: PasswordRuleId[];
  /** The policy they were measured against — the server's, not the form's. */
  policy: PasswordPolicy;
}

/**
 * Read a password refusal out of a `validation_error` body, or `null` when the
 * body is any other failure. Read-tolerant on purpose: an older server sends
 * neither field, and the caller then falls through to the ordinary
 * code/prose chain.
 */
export function passwordRefusalFromBody(data: Record<string, unknown>): PasswordRefusal | null {
  if (data.code !== 'validation_error' || !Array.isArray(data.rules)) return null;
  const rules = PASSWORD_RULES.filter((rule) => (data.rules as unknown[]).includes(rule));
  if (rules.length === 0) return null;
  return { rules, policy: parsePasswordPolicy(data.passwordPolicy) };
}

/**
 * The localized sentence for a refusal. Names the failing rules inside the
 * message rather than relying on the checklist beside it, because the
 * checklist can be switched off (`showRequirements={false}`) and because it is
 * the only text a screen reader reaches through the error region.
 */
export function passwordRefusalMessage(refusal: PasswordRefusal, t: AuthLocale): string {
  const labels = refusal.rules.map((rule) =>
    rule === 'minLength'
      ? t.auth.passwordRequirements.rules.minLength.replace('{n}', String(refusal.policy.minLength))
      : t.auth.passwordRequirements.rules[rule]
  );
  // ` · ` rather than a comma: the labels are capitalised noun phrases in both
  // bundles, and joining them into a sentence would need per-language casing.
  return t.auth.passwordRequirements.failed.replace('{rules}', labels.join(' · '));
}
