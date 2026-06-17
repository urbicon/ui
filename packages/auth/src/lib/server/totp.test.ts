import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  hotp,
  totp,
  verifyTotp
} from './totp.js';

// The shared RFC test seed: ASCII "12345678901234567890" (20 bytes).
const SEED = new TextEncoder().encode('12345678901234567890');
const SEED_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('Base32 (RFC 4648)', () => {
  it('encodes the RFC seed to the known Base32 string', () => {
    expect(base32Encode(SEED)).toBe(SEED_BASE32);
  });

  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 64, 7]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('decodes case-insensitively and ignores spaces/padding', () => {
    expect(base32Decode('gezd gnbv===')).toEqual(base32Decode('GEZDGNBV'));
  });

  it('throws on an out-of-alphabet character', () => {
    expect(() => base32Decode('GEZD1')).toThrow();
  });
});

describe('HOTP (RFC 4226 Appendix D test vectors)', () => {
  const expected = [
    '755224',
    '287082',
    '359152',
    '969429',
    '338314',
    '254676',
    '287922',
    '162583',
    '399871',
    '520489'
  ];
  it.each(expected.map((v, i) => [i, v]))('counter %i → %s', async (counter, value) => {
    expect(await hotp(SEED, counter as number)).toBe(value);
  });
});

describe('TOTP (RFC 6238 Appendix B test vectors, SHA-1, 8 digits)', () => {
  const vectors: Array<[number, string]> = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130']
  ];
  it.each(vectors)('T=%i → %s', async (seconds, value) => {
    expect(await totp(SEED, { timestamp: seconds * 1000, digits: 8, algorithm: 'SHA-1' })).toBe(
      value
    );
  });
});

describe('verifyTotp', () => {
  const at = 1111111111 * 1000; // RFC vector instant

  it('accepts the exact current code', async () => {
    expect(await verifyTotp(SEED_BASE32, '14050471', { timestamp: at, digits: 8 })).toBe(true);
  });

  it('accepts a code from the previous/next period within the window', async () => {
    const prev = await totp(SEED, { timestamp: at - 30_000, digits: 8 });
    const next = await totp(SEED, { timestamp: at + 30_000, digits: 8 });
    expect(await verifyTotp(SEED_BASE32, prev, { timestamp: at, digits: 8, window: 1 })).toBe(true);
    expect(await verifyTotp(SEED_BASE32, next, { timestamp: at, digits: 8, window: 1 })).toBe(true);
  });

  it('rejects a code outside the window', async () => {
    const old = await totp(SEED, { timestamp: at - 120_000, digits: 8 });
    expect(await verifyTotp(SEED_BASE32, old, { timestamp: at, digits: 8, window: 1 })).toBe(false);
  });

  it('rejects an empty or non-numeric code', async () => {
    expect(await verifyTotp(SEED_BASE32, '', { timestamp: at, digits: 8 })).toBe(false);
    expect(await verifyTotp(SEED_BASE32, 'abcdef', { timestamp: at, digits: 8 })).toBe(false);
  });
});

describe('generateTotpSecret', () => {
  it('produces a decodable 160-bit Base32 secret by default', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(secret)).toHaveLength(20);
  });

  it('generates unique secrets', () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe('buildOtpauthUri', () => {
  it('builds a spec-shaped otpauth URI with issuer-prefixed label', () => {
    const uri = buildOtpauthUri({ issuer: 'Urbicon', label: 'aya@test.com', secret: SEED_BASE32 });
    expect(uri.startsWith('otpauth://totp/Urbicon:aya%40test.com?')).toBe(true);
    expect(uri).toContain(`secret=${SEED_BASE32}`);
    expect(uri).toContain('issuer=Urbicon');
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});

describe('secret encryption (AES-256-GCM)', () => {
  const KEY = 'a-high-entropy-encryption-key-0123456789';

  it('round-trips a secret', async () => {
    const enc = await encryptSecret(SEED_BASE32, KEY);
    expect(enc).not.toContain(SEED_BASE32); // not stored in the clear
    expect(enc).toMatch(/^[^:]+:[^:]+$/); // iv:ciphertext
    expect(await decryptSecret(enc, KEY)).toBe(SEED_BASE32);
  });

  it('uses a fresh IV each time (distinct ciphertexts for the same input)', async () => {
    expect(await encryptSecret(SEED_BASE32, KEY)).not.toBe(await encryptSecret(SEED_BASE32, KEY));
  });

  it('returns null for the wrong key (GCM auth failure), never throws', async () => {
    const enc = await encryptSecret(SEED_BASE32, KEY);
    expect(await decryptSecret(enc, 'a-different-key')).toBeNull();
  });

  it('returns null for a tampered or malformed payload', async () => {
    const enc = await encryptSecret(SEED_BASE32, KEY);
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'B' : 'A');
    expect(await decryptSecret(tampered, KEY)).toBeNull();
    expect(await decryptSecret('not-a-valid-payload', KEY)).toBeNull();
  });
});
