// WebAuthn ceremony fixtures: a real, signed ES256 assertion built the way a
// FIDO2 authenticator emits one (COSE EC2 key, DER signature, authData flag
// byte). Shared by the unit tests of `verifyAssertion` and by the handler tests
// that drive a complete options→verify login, so both sides mint their
// credentials from one implementation.
//
// Test-only — never imported by published entry points.

import { base64UrlDecode, base64UrlEncode } from '../encoding.js';
import type { AuthenticationCredentialJSON, WebAuthnConfig } from './webauthn.js';

/** base64url-encode a string (no padding) — clientDataJSON travels this way. */
export const b64url = (s: string) =>
  btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Minimal CBOR encoder — just enough for a COSE public key. */
export function cborInt(n: number): number[] {
  if (n >= 0) {
    if (n < 24) return [n];
    if (n < 0x100) return [0x18, n];
    return [0x19, (n >> 8) & 0xff, n & 0xff];
  }
  const v = -1 - n;
  if (v < 24) return [0x20 | v];
  if (v < 0x100) return [0x38, v];
  return [0x39, (v >> 8) & 0xff, v & 0xff];
}

export function cborBytes(b: Uint8Array): number[] {
  const len = b.length;
  const head = len < 24 ? [0x40 | len] : len < 0x100 ? [0x58, len] : [0x59, len >> 8, len & 0xff];
  return [...head, ...Array.from(b)];
}

/** COSE_Key for an EC2 / P-256 / ES256 public key: {1:2, 3:-7, -1:1, -2:x, -3:y}. */
export function coseEc2Key(x: Uint8Array, y: Uint8Array): Uint8Array {
  const entries = [
    [...cborInt(1), ...cborInt(2)],
    [...cborInt(3), ...cborInt(-7)],
    [...cborInt(-1), ...cborInt(1)],
    [...cborInt(-2), ...cborBytes(x)],
    [...cborInt(-3), ...cborBytes(y)]
  ];
  return new Uint8Array([0xa0 | entries.length, ...entries.flat()]);
}

/** raw r‖s (64 bytes) → minimal ASN.1 DER, the form a FIDO2 authenticator emits. */
export function rawToDer(raw: Uint8Array): Uint8Array {
  const enc = (bytes: Uint8Array): number[] => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++;
    let v = Array.from(bytes.subarray(i));
    if (v[0] & 0x80) v = [0, ...v];
    return [0x02, v.length, ...v];
  };
  const body = [...enc(raw.subarray(0, 32)), ...enc(raw.subarray(32))];
  return new Uint8Array([0x30, body.length, ...body]);
}

export function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

export interface Es256AssertionOptions {
  challenge: string;
  signCount?: number;
  /** Sign over corrupted data → valid DER but a cryptographically wrong signature. */
  tamper?: boolean;
  /** Emit structurally broken DER bytes. */
  breakDer?: boolean;
  /** Mint the authenticator data for a different RP (rpIdHash mismatch case). */
  rpId?: string;
  /** authData flag byte; defaults to UP|UV (0x05), what a UV-capable authenticator emits. */
  flags?: number;
  /** Credential id echoed in the credential JSON. */
  credentialId?: string;
}

/** Assemble a complete, signed ES256 assertion + the matching stored COSE key. */
export async function buildEs256Assertion(
  config: Pick<WebAuthnConfig, 'rpId' | 'origin'>,
  opts: Es256AssertionOptions
): Promise<{ credential: AuthenticationCredentialJSON; publicKey: Uint8Array }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify'
  ]);
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const publicKey = coseEc2Key(base64UrlDecode(jwk.x ?? ''), base64UrlDecode(jwk.y ?? ''));

  const clientDataBytes = new TextEncoder().encode(
    JSON.stringify({ type: 'webauthn.get', challenge: opts.challenge, origin: config.origin })
  );
  const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes));

  // Assertion authenticatorData: rpIdHash(32) ‖ flags(1) ‖ signCount(4).
  const rpIdHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(opts.rpId ?? config.rpId))
  );
  const tail = new Uint8Array(5);
  tail[0] = opts.flags ?? 0x05;
  new DataView(tail.buffer).setUint32(1, opts.signCount ?? 1, false);
  const authData = concatBytes(rpIdHash, tail);

  const signedData = concatBytes(authData, clientDataHash);
  const toSign = signedData.slice();
  if (opts.tamper) toSign[0] ^= 0xff; // verifier reconstructs the untampered data
  const rawSig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, toSign)
  );
  let der = rawToDer(rawSig);
  if (opts.breakDer) der = der.subarray(0, 4); // truncated → unparseable

  const credentialId = opts.credentialId ?? 'test-cred-id';
  return {
    credential: {
      id: credentialId,
      rawId: b64url(credentialId),
      type: 'public-key',
      response: {
        clientDataJSON: base64UrlEncode(clientDataBytes),
        authenticatorData: base64UrlEncode(authData),
        signature: base64UrlEncode(der)
      }
    },
    publicKey
  };
}
