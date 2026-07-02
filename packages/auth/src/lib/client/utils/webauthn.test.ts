import { describe, expect, it } from 'vitest';
import { base64UrlToBuffer, bufferToBase64Url } from './webauthn.js';

describe('webauthn base64url codecs', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 0xfb, 0xff, 0x7e, 128]);
    const encoded = bufferToBase64Url(bytes.buffer as ArrayBuffer);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(new Uint8Array(base64UrlToBuffer(encoded))).toEqual(bytes);
  });

  it('decodes padded input and matches the platform encoding', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0x7e]);
    expect(bufferToBase64Url(bytes.buffer as ArrayBuffer)).toBe(
      Buffer.from(bytes).toString('base64url')
    );
    expect(new Uint8Array(base64UrlToBuffer(Buffer.from(bytes).toString('base64')))).toEqual(bytes);
  });
});
