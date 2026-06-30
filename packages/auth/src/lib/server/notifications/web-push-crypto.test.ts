import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  buildEncryptedBody,
  createVapidHeaders,
  encryptPayload,
  generateVapidKeys
} from './web-push-crypto.js';

describe('base64url', () => {
  it('should roundtrip encode/decode', () => {
    const original = new Uint8Array([0, 1, 2, 255, 254, 128]);
    const encoded = base64UrlEncode(original);
    const decoded = base64UrlDecode(encoded);
    expect(decoded).toEqual(original);
  });

  it('should produce URL-safe output (no +, /, =)', () => {
    const data = crypto.getRandomValues(new Uint8Array(100));
    const encoded = base64UrlEncode(data);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });
});

describe('generateVapidKeys', () => {
  it('should generate valid P-256 key pair', async () => {
    const keys = await generateVapidKeys();

    expect(keys.publicKey).toBeTruthy();
    expect(keys.privateKey).toBeTruthy();

    // Public key should be 65 bytes (uncompressed P-256)
    const publicRaw = base64UrlDecode(keys.publicKey);
    expect(publicRaw.length).toBe(65);
    expect(publicRaw[0]).toBe(0x04); // uncompressed point marker
  });

  it('should generate unique keys each time', async () => {
    const k1 = await generateVapidKeys();
    const k2 = await generateVapidKeys();
    expect(k1.publicKey).not.toBe(k2.publicKey);
    expect(k1.privateKey).not.toBe(k2.privateKey);
  });
});

describe('createVapidHeaders', () => {
  it('should produce valid VAPID authorization header', async () => {
    const keys = await generateVapidKeys();

    const headers = await createVapidHeaders(
      'https://push.example.com/send/abc123',
      'mailto:admin@example.com',
      keys.publicKey,
      keys.privateKey
    );

    expect(headers.authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    expect(headers['crypto-key']).toMatch(/^p256ecdsa=[\w-]+$/);
  });

  it('should use the endpoint origin as audience', async () => {
    const keys = await generateVapidKeys();

    const headers = await createVapidHeaders(
      'https://fcm.googleapis.com/fcm/send/abc',
      'mailto:test@test.com',
      keys.publicKey,
      keys.privateKey
    );

    // Decode the JWT payload and check audience
    const jwt = headers.authorization.match(/t=([\w-]+\.[\w-]+\.[\w-]+)/)?.[1];
    expect(jwt).toBeTruthy();

    const payloadB64 = jwt!.split('.')[1];
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    expect(payload.aud).toBe('https://fcm.googleapis.com');
    expect(payload.sub).toBe('mailto:test@test.com');
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('signs the VAPID JWT with a cryptographically valid signature', async () => {
    // Regression for the DER-vs-raw mix-up (sibling of Codeberg #38): Web Crypto
    // already returns raw r||s for ECDSA, so a push service verifying the JWT
    // must accept the signature over `header.payload`. The previous code ran a
    // bogus DER→raw conversion on the already-raw bytes, producing a JWT every
    // push service rejected with 401. The format-only assertions above never
    // caught it — this verifies the signature the way a push service does.
    const keys = await generateVapidKeys();
    const headers = await createVapidHeaders(
      'https://push.example.com/send/abc123',
      'mailto:admin@example.com',
      keys.publicKey,
      keys.privateKey
    );

    const jwt = headers.authorization.match(/t=([\w-]+\.[\w-]+\.[\w-]+)/)?.[1];
    expect(jwt).toBeTruthy();
    const [headerB64, payloadB64, signatureB64] = jwt!.split('.');

    const signature = base64UrlDecode(signatureB64);
    expect(signature).toHaveLength(64); // raw r||s for P-256, never DER

    const publicKey = await crypto.subtle.importKey(
      'raw',
      base64UrlDecode(keys.publicKey) as BufferSource,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      signature as BufferSource,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`) as BufferSource
    );
    expect(valid).toBe(true);
  });
});

describe('encryptPayload', () => {
  it('should encrypt a payload with subscriber keys', async () => {
    // Generate a fake subscriber key pair
    const subscriberKeys = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );
    const subscriberPublicRaw = new Uint8Array(
      await crypto.subtle.exportKey('raw', subscriberKeys.publicKey)
    );
    const authSecret = crypto.getRandomValues(new Uint8Array(16));

    const result = await encryptPayload(new TextEncoder().encode('{"title":"Hello"}'), {
      p256dh: base64UrlEncode(subscriberPublicRaw),
      auth: base64UrlEncode(authSecret)
    });

    expect(result.ciphertext.length).toBeGreaterThan(0);
    expect(result.salt.length).toBe(16);
    expect(result.serverPublicKey.length).toBe(65);
    expect(result.serverPublicKey[0]).toBe(0x04);
  });

  it('should produce different ciphertext each time (random salt + ephemeral key)', async () => {
    const subscriberKeys = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );
    const subscriberPublicRaw = new Uint8Array(
      await crypto.subtle.exportKey('raw', subscriberKeys.publicKey)
    );
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const subKeys = {
      p256dh: base64UrlEncode(subscriberPublicRaw),
      auth: base64UrlEncode(authSecret)
    };

    const plaintext = new TextEncoder().encode('test');
    const r1 = await encryptPayload(plaintext, subKeys);
    const r2 = await encryptPayload(plaintext, subKeys);

    expect(base64UrlEncode(r1.ciphertext)).not.toBe(base64UrlEncode(r2.ciphertext));
    expect(base64UrlEncode(r1.salt)).not.toBe(base64UrlEncode(r2.salt));
  });
});

describe('buildEncryptedBody', () => {
  it('should produce correct RFC 8188 header format', () => {
    const salt = new Uint8Array(16).fill(0xaa);
    const serverKey = new Uint8Array(65).fill(0xbb);
    const ciphertext = new Uint8Array([1, 2, 3, 4]);

    const body = buildEncryptedBody(ciphertext, salt, serverKey);

    // Header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
    expect(body.length).toBe(16 + 4 + 1 + 65 + 4);

    // Check salt
    expect(body.slice(0, 16)).toEqual(salt);

    // Check record size (default 4096 = 0x00001000)
    expect(body[16]).toBe(0);
    expect(body[17]).toBe(0);
    expect(body[18]).toBe(0x10);
    expect(body[19]).toBe(0);

    // Check idlen
    expect(body[20]).toBe(65);

    // Check keyid
    expect(body.slice(21, 86)).toEqual(serverKey);

    // Check ciphertext
    expect(body.slice(86)).toEqual(ciphertext);
  });
});
