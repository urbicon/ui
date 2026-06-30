// WebAuthn server-side verification — zero-dependency implementation.
// Implements FIDO2/WebAuthn Level 2 attestation and assertion verification.

import { derToRawEcdsaSignature } from '../ecdsa-der.js';
import { base64UrlDecode, base64UrlEncode } from '../notifications/web-push-crypto.js';
import { type CborValue, decodeCbor } from './cbor.js';

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
   * When true, require the authenticator's User Verification (UV) flag —
   * typically a biometric check or PIN. Default `false`: only User Presence
   * (UP, a tap/touch) is enforced. Turn this on for high-assurance passkey
   * flows; note that it requires an authenticator that supports UV.
   *
   * When enabled, the generated options advertise
   * `authenticatorSelection.userVerification = 'required'` and both
   * `verifyRegistration` and `verifyAssertion` throw `WebAuthnError` if the
   * UV bit (0x04) is not set on the authenticator data flags.
   */
  requireUserVerification?: boolean;
}

export interface ChallengeEntry {
  challenge: string;
  expires: number;
}

/**
 * Storage interface for pending WebAuthn challenges. Implementations may be
 * synchronous (default in-memory Map) or asynchronous (Redis/Prisma/etc).
 * Methods may return plain values or Promises; callers always await the
 * result.
 *
 * **Atomicity:** for remote/shared backends, implement `take` so that the
 * read-and-delete happens in a single round-trip (Redis `GETDEL`, Prisma
 * `delete returning`, etc.). Without it, `consumeChallenge` falls back to
 * `get`+`delete` which can allow a challenge to be consumed twice under a
 * concurrent-request race. The default in-memory store provides `take`.
 */
export interface ChallengeStore {
  get(key: string): ChallengeEntry | undefined | Promise<ChallengeEntry | undefined>;
  set(key: string, entry: ChallengeEntry): void | Promise<void>;
  delete(key: string): void | Promise<void>;
  /** Atomic read-and-delete. Preferred over `get`+`delete` for replay safety. */
  take?(key: string): ChallengeEntry | undefined | Promise<ChallengeEntry | undefined>;
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

// ---- Challenge Management ----

export function generateChallenge(): string {
  // WebAuthn requires cryptographically strong randomness for challenges.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * Default in-memory challenge store factory. Creates a new Map-backed store
 * with a periodic cleanup timer. Consumers that need multi-instance support
 * supply their own `ChallengeStore` implementation via
 * `WebAuthnConfig.challengeStore` instead of this default.
 */
export function createInMemoryChallengeStore(options?: {
  cleanupIntervalMs?: number;
}): ChallengeStore {
  const store = new Map<string, ChallengeEntry>();
  const interval = options?.cleanupIntervalMs ?? 60_000;

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expires) store.delete(key);
    }
  }, interval);
  timer.unref?.();

  return {
    get: (key) => store.get(key),
    set: (key, entry) => void store.set(key, entry),
    delete: (key) => void store.delete(key),
    take: (key) => {
      const entry = store.get(key);
      store.delete(key);
      return entry;
    }
  };
}

// Lazy process-wide default so single-process deployments work without any
// configuration. Multi-instance deployments should provide their own store
// via `WebAuthnConfig.challengeStore` — in that case this default is not
// even instantiated.
let defaultChallengeStore: ChallengeStore | undefined;
function getDefaultChallengeStore(): ChallengeStore {
  if (!defaultChallengeStore) {
    defaultChallengeStore = createInMemoryChallengeStore();
  }
  return defaultChallengeStore;
}

function resolveChallengeStore(config: WebAuthnConfig): ChallengeStore {
  return config.challengeStore ?? getDefaultChallengeStore();
}

// `key` is the challenge-store key — a user id for registration, a per-ceremony
// handle for discoverable authentication (see `generateAuthenticationOptions`).
// Kept generic because both callers route through here.
export async function storeChallenge(
  store: ChallengeStore,
  key: string,
  challenge: string,
  timeoutMs: number = 300_000
): Promise<void> {
  await Promise.resolve(store.set(key, { challenge, expires: Date.now() + timeoutMs }));
}

export async function consumeChallenge(store: ChallengeStore, key: string): Promise<string | null> {
  // Prefer atomic take() when the store provides it — otherwise a concurrent
  // request race can consume the same challenge twice (TOCTOU on get+delete).
  if (store.take) {
    const entry = await Promise.resolve(store.take(key));
    if (!entry) return null;
    if (Date.now() > entry.expires) return null;
    return entry.challenge;
  }
  const entry = await Promise.resolve(store.get(key));
  if (!entry) return null;
  // Expiry check BEFORE delete — a delete failure on a stale entry is
  // harmless (cleanup timer picks it up), and a delete failure on a valid
  // entry still lets this request succeed while logging the problem loudly.
  const expired = Date.now() > entry.expires;
  try {
    await Promise.resolve(store.delete(key));
  } catch (err) {
    console.error(
      '[auth] consumeChallenge: store.delete failed — challenge may be replayable until TTL.',
      err
    );
  }
  if (expired) return null;
  return entry.challenge;
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
      userVerification: config.requireUserVerification ? 'required' : 'preferred'
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
    userVerification: config.requireUserVerification ? 'required' : 'preferred',
    allowCredentials: credentialIds.map((id) => ({
      type: 'public-key',
      id,
      transports: ['internal', 'hybrid']
    }))
  };
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
  const clientDataRaw = base64UrlDecode(credential.response.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataRaw));

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

  // 3. Parse attestation object (CBOR)
  const attestationRaw = base64UrlDecode(credential.response.attestationObject);
  const attestation = decodeCbor(attestationRaw) as Map<CborValue, CborValue>;

  const authDataRaw = attestation.get('authData') as Uint8Array;
  if (!authDataRaw) throw new WebAuthnError('Missing authData in attestation');

  // 4. Parse authenticator data
  const authData = parseAuthenticatorData(authDataRaw);

  // 5. Verify RP ID hash
  const expectedRpIdHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(config.rpId))
  );
  if (!arraysEqual(authData.rpIdHash, expectedRpIdHash)) {
    throw new WebAuthnError('RP ID hash mismatch');
  }

  // 6. Verify user presence flag
  if (!(authData.flags & 0x01)) {
    throw new WebAuthnError('User presence flag not set');
  }

  // 6a. Enforce user verification when the config demands it
  if (config.requireUserVerification && !(authData.flags & 0x04)) {
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
  const clientDataRaw = base64UrlDecode(credential.response.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataRaw));

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
  const authDataRaw = base64UrlDecode(credential.response.authenticatorData);
  const authData = parseAuthenticatorData(authDataRaw);

  // 4. Verify RP ID hash
  const expectedRpIdHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(config.rpId))
  );
  if (!arraysEqual(authData.rpIdHash, expectedRpIdHash)) {
    throw new WebAuthnError('RP ID hash mismatch');
  }

  // 5. Verify user presence
  if (!(authData.flags & 0x01)) {
    throw new WebAuthnError('User presence flag not set');
  }

  // 5a. Enforce user verification when the config demands it
  if (config.requireUserVerification && !(authData.flags & 0x04)) {
    throw new WebAuthnError('User verification required but not performed');
  }

  // 6. Verify signature
  const clientDataHash = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      clientDataRaw.buffer.slice(
        clientDataRaw.byteOffset,
        clientDataRaw.byteOffset + clientDataRaw.byteLength
      ) as ArrayBuffer
    )
  );
  const signedData = concat(authDataRaw, clientDataHash);
  const signatureRaw = base64UrlDecode(credential.response.signature);

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

// ---- Authenticator Data Parser ----

interface AuthenticatorData {
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

function parseAuthenticatorData(data: Uint8Array): AuthenticatorData {
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
    const publicKeyBytes = data.slice(55 + credIdLen);

    // Parse COSE key to extract algorithm
    const coseKey = decodeCbor(publicKeyBytes) as Map<CborValue, CborValue>;
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

async function verifySignature(
  cosePublicKey: Uint8Array,
  alg: number,
  data: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  const coseMap = decodeCbor(cosePublicKey) as Map<CborValue, CborValue>;
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

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

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

  const dataBuf = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  const sigBuf = rawSignature.buffer.slice(
    rawSignature.byteOffset,
    rawSignature.byteOffset + rawSignature.byteLength
  ) as ArrayBuffer;

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

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const dataBuf = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  const sigBuf = signature.buffer.slice(
    signature.byteOffset,
    signature.byteOffset + signature.byteLength
  ) as ArrayBuffer;

  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBuf, dataBuf);
}

// ---- Utilities ----

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

// Constant-time equality. Short-circuits only on length mismatch; for equal
// lengths every byte is compared, so the inner loop runs in O(n) regardless
// of where the first differing byte is. Prevents timing side channels when
// comparing RP-ID hashes / credential IDs.
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function formatAaguid(aaguid: Uint8Array): string {
  const hex = Array.from(aaguid)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class WebAuthnError extends Error {
  // Forward ErrorOptions so callers can chain a `cause` — e.g. wrapping a raw
  // DER-parse error while keeping a clean client-facing message. The handler
  // returns only `message`, so the cause never leaks but stays diagnosable.
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WebAuthnError';
  }
}
