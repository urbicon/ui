/**
 * Byte/string codecs shared across the auth core — JWT (auth.ts), CSRF,
 * WebAuthn, TOTP, Web Push. One canonical copy: this encoding logic is
 * security-relevant (it feeds signatures and key material), and before this
 * module it existed 3-5× in parallel with the dependency arrows pointing the
 * wrong way (CSRF and the passkey stack imported base64url from the Web-Push
 * module — review R14). Everything here is Web-API-only (no `Buffer`).
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Bytes → unpadded base64url. */
export function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * base64url → bytes. Tolerant on input (read side): missing padding is
 * restored and the standard alphabet (`+/`) is accepted alongside `-_`.
 * Throws on undecodable input.
 */
export function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** UTF-8 string → unpadded base64url — the JWT-segment form. */
export function base64UrlEncodeString(text: string): string {
  return base64UrlEncode(textEncoder.encode(text));
}

/** base64url → UTF-8 string — the JWT-segment form. */
export function base64UrlDecodeString(str: string): string {
  return textDecoder.decode(base64UrlDecode(str));
}

/** Concatenate byte arrays into one. */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Coerce a Uint8Array (possibly a subarray view) to a plain ArrayBuffer for
 * the Web Crypto API, whose lib types reject the generic
 * `Uint8Array<ArrayBufferLike>`. Slices by byteOffset/byteLength so views
 * yield exactly their own bytes, never the whole backing buffer.
 */
export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
