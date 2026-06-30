import { describe, expect, it } from 'vitest';
import { derToRawEcdsaSignature } from './ecdsa-der.js';

// Minimal-DER encode a raw r‖s signature — the inverse of the function under
// test. Used to build well-formed inputs that mirror what a real authenticator
// emits (`SEQUENCE { INTEGER r, INTEGER s }`, signed big-endian, minimal).
function rawToDer(raw: Uint8Array): Uint8Array {
  const encodeInt = (bytes: Uint8Array): number[] => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0x00) i++; // strip leading zeros
    let v = Array.from(bytes.subarray(i));
    if (v[0] & 0x80) v = [0x00, ...v]; // keep the integer positive
    return [0x02, v.length, ...v];
  };
  const half = raw.length / 2;
  const body = [...encodeInt(raw.subarray(0, half)), ...encodeInt(raw.subarray(half))];
  return new Uint8Array([0x30, body.length, ...body]);
}

const ZERO32 = new Uint8Array(32);
const ONE32 = (() => {
  const a = new Uint8Array(32);
  a[31] = 1;
  return a;
})();
const HIGHBIT32 = new Uint8Array(32).fill(0xff); // top bit set → needs 0x00 pad
const MIXED = (() => {
  const a = new Uint8Array(32);
  for (let i = 0; i < 32; i++) a[i] = (i * 7 + 3) & 0xff;
  return a;
})();

describe('derToRawEcdsaSignature — round-trips with constructed signatures', () => {
  const cases: [string, Uint8Array, Uint8Array][] = [
    ['both small (left-padded in raw)', ONE32, ONE32],
    ['both high-bit (0x00 sign byte in DER)', HIGHBIT32, HIGHBIT32],
    ['mixed magnitudes', MIXED, HIGHBIT32],
    ['r high-bit, s small', HIGHBIT32, ONE32],
    ['zero r, non-zero s (structurally valid, crypto-invalid)', ZERO32, ONE32]
  ];

  for (const [name, r, s] of cases) {
    it(name, () => {
      const raw = new Uint8Array([...r, ...s]);
      const der = rawToDer(raw);
      const out = derToRawEcdsaSignature(der);
      expect(out).toHaveLength(64);
      expect(out).toEqual(raw);
    });
  }

  it('left-pads a component shorter than the field width', () => {
    // r encodes as a single byte 0x01; the raw output must be 31 zeros + 0x01.
    const raw = new Uint8Array([...ONE32, ...HIGHBIT32]);
    const out = derToRawEcdsaSignature(rawToDer(raw));
    expect(out.subarray(0, 31)).toEqual(new Uint8Array(31));
    expect(out[31]).toBe(1);
  });
});

describe('derToRawEcdsaSignature — agrees with Web Crypto on real signatures', () => {
  it('produces a raw signature Web Crypto verifies for many random signs', async () => {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify'
    ]);

    for (let i = 0; i < 50; i++) {
      const data = crypto.getRandomValues(new Uint8Array(48));
      // crypto.subtle.sign yields raw r‖s on this runtime; re-encode to DER to
      // simulate the authenticator, then convert back and verify the result.
      const raw = new Uint8Array(
        await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, data)
      );
      expect(raw).toHaveLength(64);

      const der = rawToDer(raw);
      const converted = derToRawEcdsaSignature(der);
      expect(converted).toEqual(raw);

      const ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        kp.publicKey,
        converted as BufferSource,
        data as BufferSource
      );
      expect(ok).toBe(true);
    }
  });
});

describe('derToRawEcdsaSignature — rejects malformed / hostile input', () => {
  const reject = (bytes: number[], why: string) =>
    it(why, () => {
      expect(() => derToRawEcdsaSignature(new Uint8Array(bytes))).toThrow(/Invalid ECDSA DER/);
    });

  reject([], 'empty input');
  reject([0x30], 'SEQUENCE tag only, no length');
  reject([0x31, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01], 'wrong outer tag (not SEQUENCE)');
  reject([0x30, 0x06, 0x03, 0x01, 0x01, 0x02, 0x01, 0x01], 'first element is not INTEGER');
  reject([0x30, 0x06, 0x02, 0x01, 0x01, 0x03, 0x01, 0x01], 'second element is not INTEGER');
  reject([0x30, 0x81, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01], 'long-form SEQUENCE length');
  reject([0x30, 0x07, 0x02, 0x81, 0x01, 0x01, 0x02, 0x01, 0x01], 'long-form INTEGER length');
  reject([0x30, 0x05, 0x02, 0x00, 0x02, 0x01, 0x01], 'zero-length INTEGER');
  reject([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01], 'truncated: declared length exceeds buffer');
  reject(
    [0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0xff],
    'extra byte beyond the declared SEQUENCE length'
  );
  reject([0x30, 0x04, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01], 'SEQUENCE length shorter than body');
  reject([0x30, 0x08, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01], 'SEQUENCE length longer than body');
  // Internally inconsistent SEQUENCE: declared length matches the buffer, but a
  // THIRD INTEGER sits after s. Passes the seqLen check; only the final
  // full-consumption assert (offset !== der.length) rejects it.
  reject(
    [0x30, 0x09, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01],
    'third INTEGER inside a consistent-length SEQUENCE'
  );

  it('component wider than the field width (33 non-zero bytes)', () => {
    const big = Array(33).fill(0x7f); // 33 bytes, no leading zero → magnitude > 32
    const body = [0x02, 33, ...big, 0x02, 0x01, 0x01];
    const der = new Uint8Array([0x30, body.length, ...body]);
    expect(() => derToRawEcdsaSignature(der)).toThrow(/exceeds field width/);
  });

  it('INTEGER body overruns a consistent-length SEQUENCE', () => {
    // seqLen=4 matches the 6-byte buffer, but rLen=4 reaches past the end
    // (offset 4 + 4 > 6) — exercises the INTEGER bounds guard, not the seqLen one.
    const der = new Uint8Array([0x30, 0x04, 0x02, 0x04, 0x01, 0x02]);
    expect(() => derToRawEcdsaSignature(der)).toThrow(/runs past end of input/);
  });
});
