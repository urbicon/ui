import type { TokenTtlConfig } from '../types.js';

/**
 * Parse an `Ns | Nm | Nh | Nd` duration into seconds — the one grammar every
 * duration-shaped config field uses (`jwt.expiresIn`, `refreshTokenTtl`,
 * `twoFactor.pendingTokenTtl`, …). One copy on purpose: the JWT `exp` claim
 * and the session cookie `maxAge` are derived from the SAME `expiresIn`
 * value, so two drifting parsers would silently desynchronize token and
 * cookie lifetime.
 */
export function parseDurationSeconds(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: ${value}`);
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      throw new Error(`Unknown time unit: ${match[2]}`);
  }
}

/**
 * The lifetime each mailed single-use token gets when `config.tokenTtl` leaves
 * it unset. One table rather than a literal per handler: these are the values a
 * compliance requirement is measured against, so they have to be readable in
 * one place.
 */
const DEFAULT_TOKEN_TTL = {
  emailVerification: '24h',
  passwordReset: '1h',
  emailChange: '1h'
} as const satisfies Required<TokenTtlConfig>;

/**
 * Resolve one `config.tokenTtl` window to milliseconds — the unit the handlers
 * add to `Date.now()` for the expiry column.
 *
 * Throws on a malformed duration (via {@link parseDurationSeconds}) and on the
 * two values the grammar accepts but a token cannot survive: `'0h'`, whose link
 * is dead in the same millisecond it is mailed, and a window so large that
 * `Date.now() + ms` leaves the representable range, which stores an
 * `Invalid Date` — and an unparsable expiry is exactly the `null`-shaped hole
 * that makes a token immortal. Call it where the handler is created, not inside
 * the request: a typo in a config value must fail the wiring, not one password
 * reset at 3am.
 */
export function resolveTokenTtlMs(
  config: TokenTtlConfig | undefined,
  purpose: keyof TokenTtlConfig
): number {
  const value = config?.[purpose] ?? DEFAULT_TOKEN_TTL[purpose];
  const ms = parseDurationSeconds(value) * 1000;
  if (ms <= 0 || Number.isNaN(new Date(Date.now() + ms).getTime())) {
    throw new Error(
      `[auth] tokenTtl.${purpose} must name a window a token can live in, got ${value}. ` +
        'Zero expires the link before it is read; a window beyond the Date range stores no expiry at all.'
    );
  }
  return ms;
}
