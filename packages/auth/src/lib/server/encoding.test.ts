import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlDecodeString,
  base64UrlEncode,
  base64UrlEncodeString,
  concatBytes,
  toArrayBuffer
} from './encoding.js';

describe('base64url (bytes)', () => {
  it('round-trips bytes and emits the unpadded url alphabet', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0x7e, 0x00, 0x41]);
    const encoded = base64UrlEncode(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(base64UrlDecode(encoded)).toEqual(bytes);
  });

  it('matches the platform base64url encoding byte for byte', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0x7e]);
    expect(base64UrlEncode(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
  });

  it('decodes tolerantly: padded input and the standard alphabet', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0x7e]);
    expect(base64UrlDecode(Buffer.from(bytes).toString('base64'))).toEqual(bytes); // '+/9+' padded
    expect(base64UrlDecode(Buffer.from(bytes).toString('base64url'))).toEqual(bytes);
  });

  it('throws on undecodable input', () => {
    expect(() => base64UrlDecode('!!!')).toThrow();
    expect(() => base64UrlDecode('abcde')).toThrow(); // len % 4 === 1 is impossible
  });
});

describe('base64url (UTF-8 string form)', () => {
  it('round-trips multi-byte text — the JWT-segment form', () => {
    const text = '{"email":"grüße@exämple.test","note":"日本語 🚀"}';
    expect(base64UrlDecodeString(base64UrlEncodeString(text))).toBe(text);
  });

  it('is byte-identical to the Buffer-based encoding it replaced (existing JWTs must keep verifying)', () => {
    const text = '{"sub":"user-1","exp":1234567890,"role":"ädmin"}';
    expect(base64UrlEncodeString(text)).toBe(Buffer.from(text).toString('base64url'));
    expect(base64UrlDecodeString(Buffer.from(text).toString('base64url'))).toBe(text);
  });
});

describe('concatBytes', () => {
  it('concatenates in order, tolerating empty arrays', () => {
    expect(concatBytes(new Uint8Array([1, 2]), new Uint8Array([]), new Uint8Array([3]))).toEqual(
      new Uint8Array([1, 2, 3])
    );
    expect(concatBytes()).toEqual(new Uint8Array(0));
  });
});

describe('toArrayBuffer', () => {
  it('slices a subarray view to exactly its own bytes, not the backing buffer', () => {
    const backing = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const view = backing.subarray(2, 5); // [3, 4, 5]
    const ab = toArrayBuffer(view);
    expect(ab.byteLength).toBe(3);
    expect(new Uint8Array(ab)).toEqual(new Uint8Array([3, 4, 5]));
  });
});
