import { describe, expect, it } from 'vitest';
import { encodeQr } from './qr-encode';

// The encoder is a from-scratch ISO/IEC 18004 implementation. Its correctness was
// proven out-of-band by round-tripping every case through a real QR decoder (jsQR)
// across all modes / ECC levels / versions. These fixtures pin two of those known-
// good matrices (captured from the verified encoder) plus structural invariants, so
// a regression in placement, ECC, or mask selection fails loudly here.

// "01234567" — the canonical ISO numeric example — at ECC level M (21×21).
const FIXTURE_NUMERIC_M = [
  '111111100011101111111',
  '100000101110001000001',
  '101110100110001011101',
  '101110100101101011101',
  '101110101101101011101',
  '100000100001001000001',
  '111111101010101111111',
  '000000000000000000000',
  '101010100010100010010',
  '110100001011010100010',
  '000110111011011101110',
  '110011010101110110010',
  '001001110111011100001',
  '000000001010001000010',
  '111111100000100010001',
  '100000100010001001011',
  '101110101110101011101',
  '101110100101010101110',
  '101110101101011100101',
  '100000100001110111000',
  '111111101001011100101'
];

// "HTTP://A.CO" (alphanumeric) at ECC level L (21×21).
const FIXTURE_ALNUM_L = [
  '111111101111101111111',
  '100000101101101000001',
  '101110100111001011101',
  '101110100101101011101',
  '101110101000101011101',
  '100000101010001000001',
  '111111101010101111111',
  '000000001111000000000',
  '111001101111111110011',
  '110110000010000010101',
  '100101111110011011010',
  '010110011000100011010',
  '101111110110011001011',
  '000000001111011011011',
  '111111100111110010110',
  '100000101101011111110',
  '101110100011111000001',
  '101110100100000000100',
  '101110101010001000111',
  '100000101010100001101',
  '111111101100001000011'
];

function toRows(mod: boolean[][]): string[] {
  return mod.map((row) => row.map((c) => (c ? '1' : '0')).join(''));
}

describe('encodeQr', () => {
  it('matches the canonical numeric example (01234567, ECC M)', () => {
    expect(toRows(encodeQr('01234567', 'M'))).toEqual(FIXTURE_NUMERIC_M);
  });

  it('matches an alphanumeric fixture (HTTP://A.CO, ECC L)', () => {
    expect(toRows(encodeQr('HTTP://A.CO', 'L'))).toEqual(FIXTURE_ALNUM_L);
  });

  it('sizes the matrix as 4·version + 17', () => {
    // Short data → version 1 → 21 modules.
    expect(encodeQr('HI', 'L').length).toBe(21);
    // A longer byte payload needs a bigger version, still square.
    const big = encodeQr('x'.repeat(200), 'M');
    expect(big.length).toBe(big[0].length);
    expect((big.length - 17) % 4).toBe(0);
  });

  it('places the three finder patterns at the corners', () => {
    const m = encodeQr('finder', 'M');
    const n = m.length;
    // A finder pattern is a 7×7 box: dark ring, light ring, 3×3 dark core.
    const isFinder = (oy: number, ox: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const ring = x === 0 || x === 6 || y === 0 || y === 6;
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          if (m[oy + y][ox + x] !== (ring || core)) return false;
        }
      }
      return true;
    };
    expect(isFinder(0, 0)).toBe(true);
    expect(isFinder(0, n - 7)).toBe(true);
    expect(isFinder(n - 7, 0)).toBe(true);
  });

  it('grows the version with the payload and error-correction level', () => {
    const short = encodeQr('short', 'L').length;
    const longer = encodeQr('x'.repeat(100), 'L').length;
    expect(longer).toBeGreaterThan(short);
    // Higher ECC leaves less room for data, so needs an equal-or-larger version.
    expect(encodeQr('x'.repeat(100), 'H').length).toBeGreaterThanOrEqual(longer);
  });

  it('encodes UTF-8 multibyte content in byte mode without throwing', () => {
    expect(() => encodeQr('Grüße 🎉', 'M')).not.toThrow();
  });

  it('throws when the payload cannot fit the version bound', () => {
    expect(() => encodeQr('x'.repeat(50), 'H', { maxVersion: 1 })).toThrow(/too long/i);
  });

  it('respects a minimum version', () => {
    // "HI" fits version 1, but minVersion forces a larger matrix.
    expect(encodeQr('HI', 'L', { minVersion: 5 }).length).toBe(5 * 4 + 17);
  });
});
