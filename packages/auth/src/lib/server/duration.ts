/**
 * Parse an `Ns | Nm | Nh | Nd` duration into seconds — the one grammar every
 * duration-shaped config field uses (`jwt.expiresIn`, `refreshTokenTtl`,
 * `twoFactor.pendingTokenTtl`, …). One copy on purpose: the JWT `exp` claim
 * and the session cookie `maxAge` are derived from the SAME `expiresIn`
 * value, so two drifting parsers would silently desynchronize token and
 * cookie lifetime (review R14).
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
