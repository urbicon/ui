// WebAuthn server-side verification — zero-dependency implementation.
// Implements FIDO2/WebAuthn Level 2 attestation and assertion verification.
// This module holds the ceremony API (options generation + registration/
// assertion verification); challenge storage lives in challenge-store.ts and
// the byte-level authData/COSE work in cose.ts.

import { base64UrlDecode, base64UrlEncode, concatBytes, toArrayBuffer } from '../encoding.js';
import { timingSafeEqual } from '../timing-safe.js';
import { type CborValue, decodeCbor } from './cbor.js';
import {
  type ChallengeStore,
  consumeChallenge,
  generateChallenge,
  resolveChallengeStore,
  storeChallenge
} from './challenge-store.js';
import { formatAaguid, parseAuthenticatorData, verifySignature } from './cose.js';
import { WebAuthnError } from './errors.js';

// ---- Types ----

export interface WebAuthnConfig {
  rpId: string;
  rpName: string;
  origin: string;
  challengeTimeout?: number; // ms, default 5 minutes
  /**
   * Optional persistent challenge store (Redis, Prisma, Upstash, etc.)
   * implementing `ChallengeStore`. When omitted, defaults to a process-local
   * in-memory Map — suitable only for single-process deployments.
   */
  challengeStore?: ChallengeStore;
  /**
   * Require the authenticator's User Verification (UV) flag — typically a
   * biometric check or PIN. **Default `true`**: the generated options advertise
   * `userVerification: 'required'`, and both `verifyRegistration` and
   * `verifyAssertion` throw `WebAuthnError` when the UV bit (0x04) is unset on
   * the authenticator data flags. It therefore needs an authenticator that can
   * do UV.
   *
   * An explicit `false` drops both ceremonies to User Presence alone (UP, a
   * tap/touch), which leaves a passkey a pure possession factor. A passkey
   * assertion establishes a session without the TOTP gate (see
   * `createPasskeyHandlers`), so combined with `config.twoFactor` that opt-out
   * makes a passkey login a single-factor login for a TOTP-enrolled user —
   * `createPasskeyHandlers` warns about that pairing at wiring time.
   */
  requireUserVerification?: boolean;
}

export interface PublicKeyCredentialCreationOptionsJSON {
  challenge: string; // base64url
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: 'public-key'; alg: number }[];
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise';
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey?: 'discouraged' | 'preferred' | 'required';
    requireResidentKey?: boolean;
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  excludeCredentials?: { type: 'public-key'; id: string; transports?: string[] }[];
}

export interface PublicKeyCredentialRequestOptionsJSON {
  challenge: string; // base64url
  rpId: string;
  timeout?: number;
  userVerification?: 'required' | 'preferred' | 'discouraged';
  allowCredentials?: { type: 'public-key'; id: string; transports?: string[] }[];
}

export interface RegistrationCredentialJSON {
  id: string;
  rawId: string; // base64url
  type: 'public-key';
  response: {
    clientDataJSON: string; // base64url
    attestationObject: string; // base64url
    transports?: string[];
  };
}

export interface AuthenticationCredentialJSON {
  id: string;
  rawId: string; // base64url
  type: 'public-key';
  response: {
    clientDataJSON: string; // base64url
    authenticatorData: string; // base64url
    signature: string; // base64url
    userHandle?: string; // base64url
  };
}

export interface VerifiedRegistration {
  credentialId: string; // base64url
  publicKey: Uint8Array; // COSE-encoded public key (raw)
  publicKeyAlg: number; // COSE algorithm
  counter: number;
  transports?: string[];
  aaguid: string;
}

export interface VerifiedAssertion {
  credentialId: string;
  newCounter: number;
  userHandle?: string;
}

/**
 * Effective UV requirement — only an explicit `false` opts out. The four
 * ceremony sites (two options builders, two flag checks) read this instead of
 * repeating the polarity, so options and verification cannot disagree.
 */
function userVerificationRequired(config: WebAuthnConfig): boolean {
  return config.requireUserVerification !== false;
}

// ---- Registration Options ----

export async function generateRegistrationOptions(
  config: WebAuthnConfig,
  user: { id: string; name: string; displayName: string },
  existingCredentialIds: string[] = []
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const challenge = generateChallenge();
  await storeChallenge(resolveChallengeStore(config), user.id, challenge, config.challengeTimeout);

  return {
    challenge,
    rp: { id: config.rpId, name: config.rpName },
    user: {
      id: base64UrlEncode(new TextEncoder().encode(user.id)),
      name: user.name,
      displayName: user.displayName
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256 (ECDSA P-256)
      { type: 'public-key', alg: -257 } // RS256 (RSA PKCS#1 v1.5)
    ],
    timeout: config.challengeTimeout ?? 300_000,
    attestation: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      requireResidentKey: false,
      userVerification: userVerificationRequired(config) ? 'required' : 'preferred'
    },
    excludeCredentials: existingCredentialIds.map((id) => ({
      type: 'public-key',
      id,
      transports: ['internal', 'hybrid']
    }))
  };
}

// ---- Authentication Options ----

/**
 * Generate WebAuthn authentication (assertion) options and persist the
 * challenge under `challengeKey`.
 *
 * `challengeKey` is the key the challenge is stored under — **not** necessarily
 * a user id. Discoverable ("usernameless") login has no known user at this
 * step (the authenticator only reveals the credential at verify time), so the
 * caller must pass a fresh per-ceremony handle and convey it to the verify step
 * — the bundled handler does this via an HttpOnly cookie. `verifyAssertion`
 * must later be called with the **same** key. Keying by a real user id only
 * works for the email-first flow and silently breaks discoverable login
 * (Finding M4): the challenge ends up unfindable at verify time.
 */
export async function generateAuthenticationOptions(
  config: WebAuthnConfig,
  challengeKey: string,
  credentialIds: string[] = []
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const challenge = generateChallenge();
  await storeChallenge(
    resolveChallengeStore(config),
    challengeKey,
    challenge,
    config.challengeTimeout
  );

  return {
    challenge,
    rpId: config.rpId,
    timeout: config.challengeTimeout ?? 300_000,
    userVerification: userVerificationRequired(config) ? 'required' : 'preferred',
    allowCredentials: credentialIds.map((id) => ({
      type: 'public-key',
      id,
      transports: ['internal', 'hybrid']
    }))
  };
}

// Parse the (attacker-supplied) clientDataJSON bytes. A malformed body must
// reject as a WebAuthnError (→ clean 400 in the handlers), not leak the raw
// SyntaxError into a 500 — same doctrine as the COSE/DER error paths.
function parseClientDataJson(raw: Uint8Array): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch (err) {
    throw new WebAuthnError('Malformed clientDataJSON', { cause: err });
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new WebAuthnError('Malformed clientDataJSON: expected an object');
  }
  return parsed as Record<string, unknown>;
}

// ---- Registration Verification ----

export async function verifyRegistration(
  config: WebAuthnConfig,
  userId: string,
  credential: RegistrationCredentialJSON
): Promise<VerifiedRegistration> {
  // 1. Verify challenge
  const expectedChallenge = await consumeChallenge(resolveChallengeStore(config), userId);
  if (!expectedChallenge) {
    throw new WebAuthnError('Challenge expired or not found');
  }

  // 2. Parse and verify clientDataJSON
  const clientDataRaw = decodeField(credential.response?.clientDataJSON, 'clientDataJSON');
  const clientData = parseClientDataJson(clientDataRaw);

  if (clientData.type !== 'webauthn.create') {
    throw new WebAuthnError('Invalid clientData type');
  }
  if (clientData.challenge !== expectedChallenge) {
    throw new WebAuthnError('Challenge mismatch');
  }
  if (clientData.origin !== config.origin) {
    throw new WebAuthnError(`Origin mismatch: expected ${config.origin}, got ${clientData.origin}`);
  }
  // Defense-in-depth: reject ceremonies performed in a cross-origin context
  // (e.g. an embedded <iframe>). `crossOrigin` is optional in clientDataJSON,
  // so only an explicit `true` is rejected — absence means same-origin.
  if (clientData.crossOrigin === true) {
    throw new WebAuthnError('Cross-origin registration rejected');
  }

  // 3. Parse attestation object (CBOR). Both parse failures and a non-map
  // top-level are attacker-suppliable input, so they must surface as a clean
  // WebAuthnError (→ 400), not as a raw parse error the handler rethrows as a
  // 500 — the same doctrine the COSE/DER paths below already follow.
  const attestationRaw = decodeField(credential.response?.attestationObject, 'attestationObject');
  let attestation: Map<CborValue, CborValue>;
  try {
    const decoded = decodeCbor(attestationRaw);
    if (!(decoded instanceof Map)) {
      throw new Error('attestation object is not a CBOR map');
    }
    attestation = decoded;
  } catch (err) {
    throw new WebAuthnError('Malformed attestation object', { cause: err });
  }

  const authDataRaw = attestation.get('authData') as Uint8Array;
  if (!authDataRaw) throw new WebAuthnError('Missing authData in attestation');

  // 4. Parse authenticator data
  const authData = parseAuthenticatorData(authDataRaw);

  // 5. Verify RP ID hash
  const expectedRpIdHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(config.rpId))
  );
  if (!timingSafeEqual(authData.rpIdHash, expectedRpIdHash)) {
    throw new WebAuthnError('RP ID hash mismatch');
  }

  // 6. Verify user presence flag
  if (!(authData.flags & 0x01)) {
    throw new WebAuthnError('User presence flag not set');
  }

  // 6a. Enforce user verification unless the config opted out
  if (userVerificationRequired(config) && !(authData.flags & 0x04)) {
    throw new WebAuthnError('User verification required but not performed');
  }

  // 7. Extract credential data
  if (!authData.attestedCredentialData) {
    throw new WebAuthnError('No attested credential data');
  }

  const { credentialId, publicKey, publicKeyAlg, aaguid } = authData.attestedCredentialData;

  return {
    credentialId: base64UrlEncode(credentialId),
    publicKey,
    publicKeyAlg,
    counter: authData.signCount,
    transports: credential.response.transports,
    aaguid: formatAaguid(aaguid)
  };
}

// ---- Assertion Verification ----

/**
 * Verify a WebAuthn assertion. `challengeKey` must match the key
 * `generateAuthenticationOptions` stored the challenge under (a per-ceremony
 * handle for discoverable login — see that function). It is used **only** to
 * look up the pending challenge; the asserting user is identified by the
 * stored credential the caller looked up, never by this key.
 */
export async function verifyAssertion(
  config: WebAuthnConfig,
  challengeKey: string,
  credential: AuthenticationCredentialJSON,
  storedPublicKey: Uint8Array,
  storedAlg: number,
  storedCounter: number
): Promise<VerifiedAssertion> {
  // 1. Verify challenge
  const expectedChallenge = await consumeChallenge(resolveChallengeStore(config), challengeKey);
  if (!expectedChallenge) {
    throw new WebAuthnError('Challenge expired or not found');
  }

  // 2. Parse and verify clientDataJSON
  const clientDataRaw = decodeField(credential.response?.clientDataJSON, 'clientDataJSON');
  const clientData = parseClientDataJson(clientDataRaw);

  if (clientData.type !== 'webauthn.get') {
    throw new WebAuthnError('Invalid clientData type');
  }
  if (clientData.challenge !== expectedChallenge) {
    throw new WebAuthnError('Challenge mismatch');
  }
  if (clientData.origin !== config.origin) {
    throw new WebAuthnError('Origin mismatch');
  }
  // Defense-in-depth: reject a cross-origin assertion (e.g. from an <iframe>).
  // Only an explicit `true` is rejected — `crossOrigin` is optional in
  // clientDataJSON and its absence means same-origin.
  if (clientData.crossOrigin === true) {
    throw new WebAuthnError('Cross-origin assertion rejected');
  }

  // 3. Parse authenticator data
  const authDataRaw = decodeField(credential.response?.authenticatorData, 'authenticatorData');
  const authData = parseAuthenticatorData(authDataRaw);

  // 4. Verify RP ID hash
  const expectedRpIdHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(config.rpId))
  );
  if (!timingSafeEqual(authData.rpIdHash, expectedRpIdHash)) {
    throw new WebAuthnError('RP ID hash mismatch');
  }

  // 5. Verify user presence
  if (!(authData.flags & 0x01)) {
    throw new WebAuthnError('User presence flag not set');
  }

  // 5a. Enforce user verification unless the config opted out
  if (userVerificationRequired(config) && !(authData.flags & 0x04)) {
    throw new WebAuthnError('User verification required but not performed');
  }

  // 6. Verify signature
  const clientDataHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', toArrayBuffer(clientDataRaw))
  );
  const signedData = concatBytes(authDataRaw, clientDataHash);
  const signatureRaw = decodeField(credential.response?.signature, 'signature');

  const valid = await verifySignature(storedPublicKey, storedAlg, signedData, signatureRaw);
  if (!valid) {
    throw new WebAuthnError('Signature verification failed');
  }

  // 7. Verify counter (protection against cloned authenticators)
  if (authData.signCount > 0 && storedCounter > 0 && authData.signCount <= storedCounter) {
    throw new WebAuthnError('Counter did not increase — possible cloned authenticator');
  }

  return {
    credentialId: credential.id,
    newCounter: authData.signCount,
    userHandle: credential.response.userHandle
  };
}

// ---- Utilities ----

/**
 * Decode an attacker-supplied base64url credential field. Every decode of
 * client-sent material must surface as a clean WebAuthnError (→ 400 + the
 * onLoginFailed audit hook), never as a raw InvalidCharacterError the
 * handlers rethrow into a 500 — the same doctrine the JSON/CBOR/DER parse
 * paths follow (silent-failure review, package 3). Accepts `unknown` so a
 * body missing the field (or the whole `response` object) fails the same
 * clean way instead of a TypeError.
 */
function decodeField(value: unknown, label: string): Uint8Array {
  if (typeof value !== 'string') {
    throw new WebAuthnError(`Malformed ${label}`);
  }
  try {
    return base64UrlDecode(value);
  } catch (err) {
    throw new WebAuthnError(`Malformed ${label}`, { cause: err });
  }
}
