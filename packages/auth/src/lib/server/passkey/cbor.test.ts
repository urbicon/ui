import { describe, expect, it } from 'vitest';
import { type CborValue, decodeCbor } from './cbor.js';

// Helper to create CBOR bytes
function hex(s: string): Uint8Array {
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < s.length; i += 2) {
    bytes[i / 2] = parseInt(s.substring(i, i + 2), 16);
  }
  return bytes;
}

describe('CBOR decoder', () => {
  it('should decode unsigned integers', () => {
    expect(decodeCbor(hex('00'))).toBe(0);
    expect(decodeCbor(hex('01'))).toBe(1);
    expect(decodeCbor(hex('0a'))).toBe(10);
    expect(decodeCbor(hex('17'))).toBe(23);
    expect(decodeCbor(hex('1818'))).toBe(24);
    expect(decodeCbor(hex('1819'))).toBe(25);
    expect(decodeCbor(hex('1864'))).toBe(100);
    expect(decodeCbor(hex('1903e8'))).toBe(1000);
    expect(decodeCbor(hex('1a000f4240'))).toBe(1000000);
  });

  it('should decode negative integers', () => {
    expect(decodeCbor(hex('20'))).toBe(-1);
    expect(decodeCbor(hex('29'))).toBe(-10);
    expect(decodeCbor(hex('3863'))).toBe(-100);
    expect(decodeCbor(hex('3903e7'))).toBe(-1000);
  });

  it('should decode text strings', () => {
    expect(decodeCbor(hex('60'))).toBe('');
    expect(decodeCbor(hex('6161'))).toBe('a');
    expect(decodeCbor(hex('6449455446'))).toBe('IETF');
  });

  it('should decode byte strings', () => {
    const result = decodeCbor(hex('4401020304')) as Uint8Array;
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(4);
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it('should decode arrays', () => {
    expect(decodeCbor(hex('80'))).toEqual([]);
    expect(decodeCbor(hex('83010203'))).toEqual([1, 2, 3]);
  });

  it('should decode nested arrays', () => {
    // [1, [2, 3], [4, 5]]
    expect(decodeCbor(hex('8301820203820405'))).toEqual([1, [2, 3], [4, 5]]);
  });

  it('should decode maps', () => {
    // {1: 2, 3: 4}
    const result = decodeCbor(hex('a201020304')) as Map<CborValue, CborValue>;
    expect(result).toBeInstanceOf(Map);
    expect(result.get(1)).toBe(2);
    expect(result.get(3)).toBe(4);
  });

  it('should decode string-keyed maps', () => {
    // {"a": 1, "b": 2}
    const result = decodeCbor(hex('a26161016162' + '02')) as Map<CborValue, CborValue>;
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
  });

  it('should decode booleans and null', () => {
    expect(decodeCbor(hex('f4'))).toBe(false);
    expect(decodeCbor(hex('f5'))).toBe(true);
    expect(decodeCbor(hex('f6'))).toBe(null);
  });

  it('should decode floats', () => {
    // Half-precision 0.0
    expect(decodeCbor(hex('f90000'))).toBe(0);
    // Double-precision 1.1
    const d = decodeCbor(hex('fb3ff199999999999a')) as number;
    expect(d).toBeCloseTo(1.1, 10);
  });

  it('rejects a byte string whose declared length runs past the buffer', () => {
    // 0x44 = byte string, length 4 — but only 2 bytes follow. `slice` would
    // silently return a 2-byte array; the decoder must throw instead.
    expect(() => decodeCbor(hex('440102'))).toThrow(/exceeds available data/);
  });

  it('rejects a text string whose declared length runs past the buffer', () => {
    // 0x64 = text string, length 4 — only 1 byte follows.
    expect(() => decodeCbor(hex('6461'))).toThrow(/exceeds available data/);
  });

  it('rejects a length argument that requires a bigint (≥ 2^32)', () => {
    // 0x5b = byte string with an 8-byte length; 0x00000001_00000000 = 2^32.
    expect(() => decodeCbor(hex('5b0000000100000000'))).toThrow(/exceeds supported range/);
  });

  it('should decode a COSE-like map (WebAuthn key format)', () => {
    // Simulated COSE key: {1: 2, 3: -7, -1: 1, -2: <32 bytes>, -3: <32 bytes>}
    // kty=EC2, alg=ES256, crv=P-256
    const x = new Uint8Array(32).fill(0xaa);
    const y = new Uint8Array(32).fill(0xbb);

    // Build CBOR manually: map with 5 entries
    const parts: number[] = [
      0xa5, // map(5)
      0x01,
      0x02, // 1: 2 (kty: EC2)
      0x03,
      0x26, // 3: -7 (alg: ES256)
      0x20,
      0x01, // -1: 1 (crv: P-256)
      0x21,
      0x58,
      0x20,
      ...x, // -2: bytes(32)
      0x22,
      0x58,
      0x20,
      ...y // -3: bytes(32)
    ];

    const result = decodeCbor(new Uint8Array(parts)) as Map<CborValue, CborValue>;
    expect(result.get(1)).toBe(2); // kty
    expect(result.get(3)).toBe(-7); // alg
    expect(result.get(-1)).toBe(1); // crv
    expect((result.get(-2) as Uint8Array).length).toBe(32);
    expect((result.get(-3) as Uint8Array).length).toBe(32);
  });
});
