import { describe, expect, it } from 'vitest';
import { pushKeysEqual } from './push-keys.js';

/**
 * pushKeysEqual is the primitive the R3 key-possession gate rides on: it
 * decides whether a cross-user push-subscription reassign is a legitimate
 * user switch (browser re-sends its keys) or a URL-only takeover attempt.
 * Its three documented properties — decoded-bytes equality, both-fields
 * comparison, fail-closed on garbage — are pinned here directly; a
 * regression to naive string equality or an unshielded decode must fail
 * these, not just survive the integration suites (test-review mutation
 * finding M1).
 */

// The same key material in three encodings. Bytes chosen so the standard
// alphabet needs '+' and '/' where base64url uses '-' and '_'.
const BYTES = new Uint8Array([0xfb, 0xff, 0x7e]);
const URL_UNPADDED = Buffer.from(BYTES).toString('base64url'); // '-_9-'
const STANDARD_PADDED = Buffer.from(BYTES).toString('base64'); // '+/9+'

const VALID = { p256dh: 'cDE', auth: 'YTE' }; // decodable, distinct fields

describe('pushKeysEqual', () => {
  it('returns true for identical valid pairs', () => {
    expect(pushKeysEqual(VALID, { ...VALID })).toBe(true);
  });

  it('compares decoded bytes, not strings: padded and unpadded forms are equal', () => {
    const unpadded = { p256dh: 'cDE', auth: 'YTE' };
    const padded = { p256dh: 'cDE=', auth: 'YTE=' };
    expect(pushKeysEqual(unpadded, padded)).toBe(true);
  });

  it('compares decoded bytes across alphabets: base64 and base64url of the same bytes are equal', () => {
    expect(
      pushKeysEqual(
        { p256dh: URL_UNPADDED, auth: URL_UNPADDED },
        { p256dh: STANDARD_PADDED, auth: STANDARD_PADDED }
      )
    ).toBe(true);
  });

  it('requires BOTH fields to match', () => {
    expect(pushKeysEqual(VALID, { p256dh: VALID.p256dh, auth: 'YTI' })).toBe(false);
    expect(pushKeysEqual(VALID, { p256dh: 'cDI', auth: VALID.auth })).toBe(false);
  });

  it('fails closed (false, no throw) on undecodable input', () => {
    // Invalid characters and an impossible length (len % 4 === 1) both make
    // the decode throw — the gate must land on 'rejected', not a 500.
    expect(pushKeysEqual({ p256dh: '!!!', auth: VALID.auth }, VALID)).toBe(false);
    expect(pushKeysEqual(VALID, { p256dh: VALID.p256dh, auth: '%%%' })).toBe(false);
    expect(pushKeysEqual({ p256dh: 'abcde', auth: VALID.auth }, VALID)).toBe(false);
  });

  it('fails closed on missing fields — the `existing.keys ?? {}` legacy-row shape', () => {
    // prisma.ts passes `existing.keys ?? {}` for rows predating the keys
    // column: base64UrlDecode(undefined) throws inside the shield → false →
    // the row is unreassignable rather than a crash.
    expect(pushKeysEqual({} as { p256dh: string; auth: string }, VALID)).toBe(false);
    expect(pushKeysEqual({ p256dh: VALID.p256dh } as { p256dh: string; auth: string }, VALID)).toBe(
      false
    );
  });
});
