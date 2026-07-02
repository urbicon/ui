// RFC 8291: Message Encryption for Web Push
// RFC 8292: VAPID (Voluntary Application Server Identification)
// RFC 8188: Encrypted Content-Encoding for HTTP (aes128gcm)
//
// Zero-dependency implementation using Web Crypto API.

import { base64UrlDecode, base64UrlEncode, concatBytes, toArrayBuffer } from '../encoding.js';

const encoder = new TextEncoder();

function uint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value, false);
  return buf;
}

// ---- VAPID (RFC 8292) ----

export interface VapidKeys {
  publicKey: string; // base64url-encoded uncompressed P-256 public key (65 bytes)
  privateKey: string; // base64url-encoded P-256 private key (32 bytes)
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign'
  ]);

  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  // A P-256 private key always exports a `d` component; guard rather than assert
  // so a malformed export fails loudly instead of yielding an undefined key.
  if (!privateJwk.d) {
    throw new Error('Exported VAPID private key is missing its `d` component.');
  }

  return {
    publicKey: base64UrlEncode(publicRaw),
    privateKey: privateJwk.d
  };
}

async function importVapidPrivateKey(
  privateKeyB64: string,
  publicKeyB64: string
): Promise<CryptoKey> {
  const publicRaw = base64UrlDecode(publicKeyB64);

  // Extract x and y from uncompressed public key (0x04 || x || y)
  const x = base64UrlEncode(publicRaw.slice(1, 33));
  const y = base64UrlEncode(publicRaw.slice(33, 65));

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d: privateKeyB64
  };

  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign'
  ]);
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKey: CryptoKey,
  expSeconds: number = 12 * 60 * 60
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + expSeconds,
    sub: subject
  };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);

  const signatureRaw = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, signingInput)
  );

  // The W3C Web Crypto API returns the ECDSA signature already in raw r||s form
  // (IEEE P1363, 64 bytes for P-256) — exactly what a VAPID JWS signature needs
  // (RFC 7518 §3.4). It is NOT DER here: running a DER→raw conversion would
  // reinterpret the raw bytes as ASN.1 and silently corrupt the signature, so
  // every push service would reject the JWT with 401. Use the bytes as-is.
  const signatureB64 = base64UrlEncode(signatureRaw);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export async function createVapidHeaders(
  endpoint: string,
  vapidSubject: string,
  publicKeyB64: string,
  privateKeyB64: string
): Promise<{ authorization: string; 'crypto-key': string }> {
  const audience = new URL(endpoint).origin;
  const privateKey = await importVapidPrivateKey(privateKeyB64, publicKeyB64);
  const jwt = await createVapidJwt(audience, vapidSubject, privateKey);

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyB64}`,
    'crypto-key': `p256ecdsa=${publicKeyB64}`
  };
}

// ---- Payload Encryption (RFC 8291 + RFC 8188) ----

export interface SubscriptionKeys {
  p256dh: string; // base64url: subscriber's ECDH public key
  auth: string; // base64url: subscriber's auth secret (16 bytes)
}

async function hkdfDerive(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(ikm), 'HKDF', false, [
    'deriveBits'
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toArrayBuffer(salt), info: toArrayBuffer(info) },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

// RFC 8188 §2.2: for aes128gcm the CEK/nonce HKDF info values are the plain
// ASCII labels below — nothing else. The ECDH public keys feed ONLY the
// RFC 8291 IKM derivation (see `encryptPayload`). The retired `aesgcm` draft
// appended a "P-256\0" label plus length-prefixed keys here; mixing that
// context into aes128gcm derives a CEK/nonce no conforming browser can
// reproduce, so every payload is undecryptable end to end. Guarded by the
// decrypt-roundtrip test in web-push-crypto.test.ts.
const CEK_INFO = encoder.encode('Content-Encoding: aes128gcm\0');
const NONCE_INFO = encoder.encode('Content-Encoding: nonce\0');

export async function encryptPayload(
  plaintext: Uint8Array,
  subscriptionKeys: SubscriptionKeys
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  // Subscriber's keys
  const clientPublicRaw = base64UrlDecode(subscriptionKeys.p256dh);
  const authSecret = base64UrlDecode(subscriptionKeys.auth);

  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(clientPublicRaw),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const serverPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey },
      serverKeyPair.privateKey,
      256
    )
  );

  // Random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // RFC 8291: IKM = HKDF(auth_secret, shared_secret, "WebPush: info\0" || client_public || server_public, 32)
  const ikmInfo = concatBytes(encoder.encode('WebPush: info\0'), clientPublicRaw, serverPublicRaw);
  const ikm = await hkdfDerive(sharedSecret, authSecret, ikmInfo, 32);

  // Derive content encryption key (CEK) and nonce
  const cek = await hkdfDerive(ikm, salt, CEK_INFO, 16);
  const nonce = await hkdfDerive(ikm, salt, NONCE_INFO, 12);

  // Pad plaintext (RFC 8188): payload + 0x02 delimiter
  const paddedPlaintext = concatBytes(plaintext, new Uint8Array([2]));

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', toArrayBuffer(cek), 'AES-GCM', false, [
    'encrypt'
  ]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(nonce) },
      aesKey,
      toArrayBuffer(paddedPlaintext)
    )
  );

  return { ciphertext: encrypted, salt, serverPublicKey: serverPublicRaw };
}

// Build the aes128gcm Content-Encoding body (RFC 8188)
export function buildEncryptedBody(
  ciphertext: Uint8Array,
  salt: Uint8Array,
  serverPublicKey: Uint8Array,
  recordSize: number = 4096
): Uint8Array {
  // Header: salt (16) || rs (4) || idlen (1) || keyid (65)
  const idlen = new Uint8Array([serverPublicKey.length]);
  return concatBytes(salt, uint32BE(recordSize), idlen, serverPublicKey, ciphertext);
}
