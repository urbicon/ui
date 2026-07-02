/**
 * Shared user-agent-side Web Push decryption for tests (RFC 8291 §3.4 +
 * RFC 8188 §2). Deliberately implemented WITHOUT importing any derivation
 * code from `web-push-crypto.ts` — a decrypt test that shares the module's
 * HKDF info strings is circular, which is exactly how the aesgcm/aes128gcm
 * context mix-up survived the original format-only assertions. Test-only
 * fixture in the spirit of `../test-utils.ts`.
 */

export interface TestUserAgent {
  privateKey: CryptoKey;
  publicRaw: Uint8Array;
  authSecret: Uint8Array;
}

/** Generate the subscriber ("browser") side of a push subscription. */
export async function makeTestUserAgent(): Promise<TestUserAgent> {
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits'
  ]);
  return {
    privateKey: keys.privateKey,
    publicRaw: new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey)),
    authSecret: crypto.getRandomValues(new Uint8Array(16))
  };
}

/** Split an RFC 8188 aes128gcm body into its header fields and ciphertext. */
export function parseAes128gcmBody(body: Uint8Array): {
  salt: Uint8Array;
  recordSize: number;
  serverPublicKey: Uint8Array;
  ciphertext: Uint8Array;
} {
  if (body.length < 21) throw new Error(`aes128gcm body too short: ${body.length} bytes`);
  const salt = body.slice(0, 16);
  const recordSize = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0, false);
  const idlen = body[20];
  if (body.length < 21 + idlen) throw new Error('aes128gcm keyid truncated');
  const serverPublicKey = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  return { salt, recordSize, serverPublicKey, ciphertext };
}

async function hkdf(
  keyMaterial: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: salt as BufferSource,
        info: info as BufferSource
      },
      await crypto.subtle.importKey('raw', keyMaterial as BufferSource, 'HKDF', false, [
        'deriveBits'
      ]),
      length * 8
    )
  );
}

/**
 * Decrypt a single-record aes128gcm payload the way a conforming browser
 * does. Throws on any derivation mismatch (the AES-GCM tag check) or a
 * missing RFC 8188 padding delimiter — a failure here means a real browser
 * could not display the push message.
 */
export async function decryptWebPushPayload(
  parts: { ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array },
  ua: TestUserAgent
): Promise<string> {
  const asPublicKey = await crypto.subtle.importKey(
    'raw',
    parts.serverPublicKey as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: asPublicKey }, ua.privateKey, 256)
  );

  const te = new TextEncoder();
  const ikmInfo = new Uint8Array([
    ...te.encode('WebPush: info\0'),
    ...ua.publicRaw,
    ...parts.serverPublicKey
  ]);
  const ikm = await hkdf(ecdhSecret, ua.authSecret, ikmInfo, 32);
  const cek = await hkdf(ikm, parts.salt, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, parts.salt, te.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, [
    'decrypt'
  ]);
  const padded = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource },
      aesKey,
      parts.ciphertext as BufferSource
    )
  );

  // RFC 8188 §2: strip trailing 0x00 padding, then the final record's 0x02
  // delimiter, to recover the plaintext.
  let end = padded.length;
  while (end > 0 && padded[end - 1] === 0) end--;
  if (end === 0 || padded[end - 1] !== 2) {
    throw new Error('aes128gcm record is missing its 0x02 padding delimiter');
  }
  return new TextDecoder().decode(padded.slice(0, end - 1));
}
