import { createHash, randomBytes } from 'node:crypto';
import { toArrayBuffer } from './encoding.js';
import { timingSafeEqualStrings } from './timing-safe.js';

/**
 * TOTP (RFC 6238) / HOTP (RFC 4226) plus the Base32 (RFC 4648) and otpauth-URI
 * plumbing an authenticator app needs — all zero-dependency over Web Crypto.
 * SHA-1 is the default HMAC: it is the RFC-6238 baseline and the only algorithm
 * Google/Microsoft/etc. authenticators reliably support. The secret is
 * high-entropy, so SHA-1 here is not a weakness; SHA-256/512 are opt-in for apps
 * that handle them.
 */

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ---- Base32 (RFC 4648, unpadded) ------------------------------------------

/** Encode bytes as unpadded Base32 (the form otpauth secrets use). */
export function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    // Keep only the still-unconsumed low bits so `value` never overflows 32 bit.
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/**
 * Decode Base32. Tolerant on input (case-insensitive, ignores spaces and `=`
 * padding) — but throws on a character outside the alphabet so a malformed
 * secret fails loudly rather than silently decoding to garbage.
 */
export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid Base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return new Uint8Array(out);
}

// ---- HOTP / TOTP ----------------------------------------------------------

async function hmac(
  algorithm: TotpAlgorithm,
  key: Uint8Array,
  message: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(message)));
}

/**
 * HOTP (RFC 4226): HMAC over the 8-byte big-endian counter → dynamic
 * truncation → `mod 10^digits`, zero-padded. Operates on raw key bytes.
 */
export async function hotp(
  key: Uint8Array,
  counter: number,
  opts?: { digits?: number; algorithm?: TotpAlgorithm }
): Promise<string> {
  const digits = opts?.digits ?? 6;
  const algorithm = opts?.algorithm ?? 'SHA-1';

  const counterBytes = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = Number(c & 0xffn);
    c >>= 8n;
  }

  const hash = await hmac(algorithm, key, counterBytes);
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/** TOTP (RFC 6238): HOTP with `counter = floor(unixSeconds / period)`. */
export async function totp(
  key: Uint8Array,
  opts?: { timestamp?: number; period?: number; digits?: number; algorithm?: TotpAlgorithm }
): Promise<string> {
  const period = opts?.period ?? 30;
  const timestamp = opts?.timestamp ?? Date.now();
  const counter = Math.floor(timestamp / 1000 / period);
  return hotp(key, counter, { digits: opts?.digits, algorithm: opts?.algorithm });
}

/**
 * Verify a user-supplied code against a Base32 secret, accepting ±`window`
 * periods of clock drift (default ±1). The comparison is timing-safe. Returns
 * `false` for a non-numeric/empty code or any drift-window miss.
 */
export async function verifyTotp(
  secret: string,
  code: string,
  opts?: {
    window?: number;
    period?: number;
    digits?: number;
    algorithm?: TotpAlgorithm;
    timestamp?: number;
  }
): Promise<boolean> {
  const window = opts?.window ?? 1;
  const period = opts?.period ?? 30;
  const digits = opts?.digits ?? 6;
  const algorithm = opts?.algorithm ?? 'SHA-1';
  const timestamp = opts?.timestamp ?? Date.now();

  const normalized = code.replace(/\s/g, '');
  if (normalized.length === 0 || !/^\d+$/.test(normalized)) return false;

  const key = base32Decode(secret);
  const current = Math.floor(timestamp / 1000 / period);
  let valid = false;
  // Check every candidate without an early break: the timing-safe compare plus a
  // full sweep keeps the verify time independent of WHICH window matched.
  for (let w = -window; w <= window; w++) {
    const candidate = await hotp(key, current + w, { digits, algorithm });
    if (timingSafeEqualStrings(candidate, normalized)) valid = true;
  }
  return valid;
}

/** Generate a fresh Base32 TOTP secret (default 160 bit, the RFC-6238 size). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/**
 * Build the `otpauth://totp/...` URI an authenticator app imports (usually via
 * QR). `label` is the account identifier (e.g. the email); `issuer` names the
 * app. The Base32 `secret` is embedded as-is.
 */
export function buildOtpauthUri(opts: {
  issuer: string;
  label: string;
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
}): string {
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    // otpauth spells algorithms without the dash (SHA1/SHA256/SHA512).
    algorithm: (opts.algorithm ?? 'SHA-1').replace('-', ''),
    digits: String(opts.digits ?? 6),
    period: String(opts.period ?? 30)
  });
  const path = `${encodeURIComponent(opts.issuer)}:${encodeURIComponent(opts.label)}`;
  return `otpauth://totp/${path}?${params.toString()}`;
}

// ---- Secret encryption at rest (AES-256-GCM) ------------------------------
//
// The TOTP secret is stored encrypted so a DB leak doesn't hand out working
// second factors. NOTE: the existing AES-GCM in `web-push-crypto.ts` is welded
// to the RFC-8188 push protocol (ECDH + HKDF-derived key, protocol-specific
// nonce/salt) and isn't a reusable "encrypt this string with a key" primitive,
// so this is a small dedicated helper rather than a shared extraction.

/**
 * Derive a 256-bit AES key from the configured key material. `twoFactor.
 * encryptionKey` is expected to be **high-entropy** (e.g. 32 random bytes,
 * base64) — SHA-256 only normalises it to 32 bytes; it is not a password KDF.
 */
async function deriveAesKey(keyMaterial: string): Promise<CryptoKey> {
  const hash = createHash('sha256').update(keyMaterial).digest();
  return crypto.subtle.importKey('raw', toArrayBuffer(hash), 'AES-GCM', false, [
    'encrypt',
    'decrypt'
  ]);
}

/** Encrypt a secret string → `base64(iv):base64(ciphertext)` (AES-256-GCM). */
export async function encryptSecret(plaintext: string, keyMaterial: string): Promise<string> {
  const key = await deriveAesKey(keyMaterial);
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(new TextEncoder().encode(plaintext))
    )
  );
  return `${iv.toString('base64')}:${Buffer.from(ciphertext).toString('base64')}`;
}

/**
 * Decrypt an `encryptSecret` payload. Returns `null` on a malformed payload, a
 * wrong key, or tampering (the GCM auth tag fails) — fail-closed, never throws.
 */
export async function decryptSecret(payload: string, keyMaterial: string): Promise<string | null> {
  const sep = payload.indexOf(':');
  if (sep === -1) return null;
  const ivB64 = payload.slice(0, sep);
  const ctB64 = payload.slice(sep + 1);
  if (!ivB64 || !ctB64) return null;
  try {
    const key = await deriveAesKey(keyMaterial);
    const iv = toArrayBuffer(Buffer.from(ivB64, 'base64'));
    const ct = toArrayBuffer(Buffer.from(ctB64, 'base64'));
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
