// RFC 8291: Message Encryption for Web Push
// RFC 8292: VAPID (Voluntary Application Server Identification)
// RFC 8188: Encrypted Content-Encoding for HTTP (aes128gcm)
//
// Zero-dependency implementation using Web Crypto API.

const encoder = new TextEncoder();

// TypeScript strict mode requires explicit ArrayBuffer for Web Crypto APIs
function buf(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

// ---- Byte utilities ----

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function uint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value, false);
  return buf;
}

export function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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

  // Web Crypto returns DER-encoded signature, convert to raw r||s (64 bytes)
  const rawSig = derToRaw(signatureRaw);
  const signatureB64 = base64UrlEncode(rawSig);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// Convert DER-encoded ECDSA signature to raw r||s format (64 bytes)
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  const raw = new Uint8Array(64);

  let offset = 2; // skip SEQUENCE tag and length
  // r
  offset++; // skip INTEGER tag (0x02)
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen > 32 ? 0 : 32 - rLen;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;

  // s
  offset++; // skip INTEGER tag (0x02)
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen > 32 ? 32 : 64 - sLen;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
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
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

function createInfo(type: string, clientPublic: Uint8Array, serverPublic: Uint8Array): Uint8Array {
  // "Content-Encoding: <type>\0" + "P-256\0" + client key length (2) + client key + server key length (2) + server key
  const typeEncoded = encoder.encode(`Content-Encoding: ${type}\0`);
  const p256Label = encoder.encode('P-256\0');

  const clientLen = new Uint8Array(2);
  new DataView(clientLen.buffer).setUint16(0, clientPublic.length, false);

  const serverLen = new Uint8Array(2);
  new DataView(serverLen.buffer).setUint16(0, serverPublic.length, false);

  return concat(typeEncoded, p256Label, clientLen, clientPublic, serverLen, serverPublic);
}

export async function encryptPayload(
  plaintext: Uint8Array,
  subscriptionKeys: SubscriptionKeys
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  // Subscriber's keys
  const clientPublicRaw = base64UrlDecode(subscriptionKeys.p256dh);
  const authSecret = base64UrlDecode(subscriptionKeys.auth);

  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    buf(clientPublicRaw),
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
  const ikmInfo = concat(encoder.encode('WebPush: info\0'), clientPublicRaw, serverPublicRaw);
  const ikm = await hkdfDerive(sharedSecret, authSecret, ikmInfo, 32);

  // Derive content encryption key (CEK) and nonce
  const cekInfo = createInfo('aes128gcm', clientPublicRaw, serverPublicRaw);
  const nonceInfo = createInfo('nonce', clientPublicRaw, serverPublicRaw);
  const cek = await hkdfDerive(ikm, salt, cekInfo, 16);
  const nonce = await hkdfDerive(ikm, salt, nonceInfo, 12);

  // Pad plaintext (RFC 8188): payload + 0x02 delimiter
  const paddedPlaintext = concat(plaintext, new Uint8Array([2]));

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, aesKey, buf(paddedPlaintext))
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
  return concat(salt, uint32BE(recordSize), idlen, serverPublicKey, ciphertext);
}
