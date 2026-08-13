// Authenticator-data parsing and COSE-key signature verification (ES256 /
// RS256) — the byte-level half of WebAuthn verification, consumed by the
// ceremony functions in webauthn.ts. Split out of the former webauthn.ts
// god-file.

import { derToRawEcdsaSignature } from '../ecdsa-der.js';
import { base64UrlEncode, toArrayBuffer } from '../encoding.js';
import { type CborValue, decodeCborFirst } from './cbor.js';
import { WebAuthnError } from './errors.js';

export interface AuthenticatorData {
  rpIdHash: Uint8Array;
  flags: number;
  signCount: number;
  attestedCredentialData?: {
    aaguid: Uint8Array;
    credentialId: Uint8Array;
    publicKey: Uint8Array;
    publicKeyAlg: number;
  };
}

export function parseAuthenticatorData(data: Uint8Array): AuthenticatorData {
  if (data.length < 37) throw new WebAuthnError('AuthData too short');

  const rpIdHash = data.slice(0, 32);
  const flags = data[32];
  const signCount = new DataView(data.buffer, data.byteOffset + 33, 4).getUint32(0, false);

  let attestedCredentialData: AuthenticatorData['attestedCredentialData'];

  // Bit 6 (AT) — attested credential data present
  if (flags & 0x40) {
    if (data.length < 55) throw new WebAuthnError('AuthData too short for attested credential');

    const aaguid = data.slice(37, 53);
    const credIdLen = new DataView(data.buffer, data.byteOffset + 53, 2).getUint16(0, false);
    // WebAuthn L2 §6.5.2 caps credentialId at 1023 bytes. Enforce it, and make
    // sure the declared length actually fits — `slice` would otherwise silently
    // return a short array and feed truncated bytes downstream.
    if (credIdLen > 1023) {
      throw new WebAuthnError('Credential ID exceeds maximum length (1023 bytes)');
    }
    if (55 + credIdLen > data.length) {
      throw new WebAuthnError('AuthData too short for declared credential ID length');
    }
    const credentialId = data.slice(55, 55 + credIdLen);

    // The COSE key is followed by extension data when the ED flag (0x80) is
    // set, so slice EXACTLY the bytes the first CBOR item consumed — storing
    // the tail would persist extension bytes inside the public key.
    const remainder = data.slice(55 + credIdLen);
    // Wrap the decode like the top-level attestation parse: the COSE bytes are
    // attacker-supplied via authenticatorData, so a parse failure (truncated,
    // duplicate keys, depth) must be a clean WebAuthnError (→ 400 + the
    // onLoginFailed audit hook), never a raw CBOR error the handlers rethrow
    // as a 500.
    let coseValue: CborValue;
    let bytesConsumed: number;
    try {
      ({ value: coseValue, bytesConsumed } = decodeCborFirst(remainder));
    } catch (err) {
      throw new WebAuthnError('Malformed COSE public key', { cause: err });
    }
    if (!(coseValue instanceof Map)) {
      throw new WebAuthnError('Malformed COSE public key: expected a CBOR map');
    }
    const coseKey = coseValue as Map<CborValue, CborValue>;
    const publicKeyBytes = remainder.slice(0, bytesConsumed);
    const alg = (coseKey.get(3) as number) ?? -7; // Default ES256

    attestedCredentialData = {
      aaguid,
      credentialId,
      publicKey: publicKeyBytes,
      publicKeyAlg: alg
    };
  }

  return { rpIdHash, flags, signCount, attestedCredentialData };
}

// ---- COSE Key → CryptoKey ----

export async function verifySignature(
  cosePublicKey: Uint8Array,
  alg: number,
  data: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  // Read tolerant: keys stored before the exact-slicing fix in
  // parseAuthenticatorData may carry trailing extension bytes, so re-reads
  // take the first CBOR item rather than demanding full consumption. New
  // writes are exact (write strict).
  let coseValue: CborValue;
  try {
    ({ value: coseValue } = decodeCborFirst(cosePublicKey));
  } catch (err) {
    throw new WebAuthnError('Malformed stored COSE public key', { cause: err });
  }
  if (!(coseValue instanceof Map)) {
    throw new WebAuthnError('Malformed stored COSE public key');
  }
  const coseMap = coseValue as Map<CborValue, CborValue>;
  const kty = coseMap.get(1) as number;

  if (alg === -7 && kty === 2) {
    // ES256 (ECDSA P-256 with SHA-256)
    return verifyES256(coseMap, data, signature);
  }

  if (alg === -257 && kty === 3) {
    // RS256 (RSASSA-PKCS1-v1_5 with SHA-256)
    return verifyRS256(coseMap, data, signature);
  }

  throw new WebAuthnError(`Unsupported algorithm: alg=${alg}, kty=${kty}`);
}

async function verifyES256(
  coseMap: Map<CborValue, CborValue>,
  data: Uint8Array,
  derSignature: Uint8Array
): Promise<boolean> {
  // COSE EC2 curve identifier (label -1). For ES256 it MUST be P-256 (crv = 1).
  // Without this check the curve is implied solely by `alg`, and a key on a
  // different curve whose coordinates happen to be 32 bytes would reach
  // importKey and surface as an opaque 500 instead of a clean rejection.
  const crv = coseMap.get(-1) as number;
  if (crv !== 1) {
    throw new WebAuthnError('Invalid ES256 COSE key: expected P-256 curve');
  }

  const x = coseMap.get(-2) as Uint8Array;
  const y = coseMap.get(-3) as Uint8Array;
  if (!x || !y || x.length !== 32 || y.length !== 32) {
    throw new WebAuthnError('Invalid ES256 COSE key');
  }

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(x),
    y: base64UrlEncode(y)
  };

  // importKey rejects (DataError) for a structurally-valid JWK whose point is
  // not on P-256 — a corrupt or forged stored credential. Registration stores
  // the COSE bytes without importing them, so such a key can reach here; treat
  // it as a clean 400 (WebAuthnError → handler) rather than an opaque 500.
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify'
    ]);
  } catch (err) {
    throw new WebAuthnError('Invalid ES256 public key', { cause: err });
  }

  // WebAuthn/FIDO2 authenticators emit the ECDSA signature as ASN.1 DER, but
  // Web Crypto's ECDSA verify accepts ONLY the raw r‖s (IEEE P1363) form — 64
  // bytes for P-256. Without this conversion verify() always returns false, so
  // every ES256 passkey login (Touch ID, Face ID, Windows Hello, …) fails.
  let rawSignature: Uint8Array;
  try {
    rawSignature = derToRawEcdsaSignature(derSignature);
  } catch (err) {
    // A conformant authenticator never emits malformed DER. Surface a
    // structurally invalid signature as a clean assertion failure (the handler
    // maps WebAuthnError → 400), never an opaque 500, and never hand the raw
    // bytes to crypto.subtle.verify. Chain the parser error as `cause` so the
    // structural reason stays diagnosable server-side without leaking to the
    // client.
    throw new WebAuthnError('Invalid ECDSA signature encoding', { cause: err });
  }

  const dataBuf = toArrayBuffer(data);
  const sigBuf = toArrayBuffer(rawSignature);

  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sigBuf, dataBuf);
}

async function verifyRS256(
  coseMap: Map<CborValue, CborValue>,
  data: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  const n = coseMap.get(-1) as Uint8Array;
  const e = coseMap.get(-2) as Uint8Array;
  if (!n || !e) {
    throw new WebAuthnError('Invalid RS256 COSE key');
  }

  const jwk: JsonWebKey = {
    kty: 'RSA',
    n: base64UrlEncode(n),
    e: base64UrlEncode(e)
  };

  // A corrupt stored RSA key (bad modulus/exponent) makes importKey reject
  // (DataError); surface it as a clean 400 rather than an opaque 500, matching
  // the ES256 path.
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  } catch (err) {
    throw new WebAuthnError('Invalid RS256 public key', { cause: err });
  }

  const dataBuf = toArrayBuffer(data);
  const sigBuf = toArrayBuffer(signature);

  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBuf, dataBuf);
}

export function formatAaguid(aaguid: Uint8Array): string {
  const hex = Array.from(aaguid)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
