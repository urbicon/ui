import { describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode } from '../notifications/web-push-crypto.js';
import {
  type AuthenticationCredentialJSON,
  type ChallengeEntry,
  type ChallengeStore,
  consumeChallenge,
  createInMemoryChallengeStore,
  generateAuthenticationOptions,
  generateChallenge,
  generateRegistrationOptions,
  storeChallenge,
  verifyAssertion,
  verifyRegistration,
  type WebAuthnConfig,
  WebAuthnError
} from './webauthn.js';

/** base64url-encode (no padding) — clientDataJSON is transported this way. */
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const config: WebAuthnConfig = {
  rpId: 'localhost',
  rpName: 'Test App',
  origin: 'http://localhost:3000'
};

// Per-test stores keep the assertions isolated from module-level state.
function isolatedConfig(store?: ChallengeStore): WebAuthnConfig {
  return { ...config, challengeStore: store ?? createInMemoryChallengeStore() };
}

describe('generateChallenge', () => {
  it('should generate unique base64url challenges', () => {
    const c1 = generateChallenge();
    const c2 = generateChallenge();
    expect(c1).toBeTruthy();
    expect(c2).toBeTruthy();
    expect(c1).not.toBe(c2);
    expect(c1).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('storeChallenge / consumeChallenge', () => {
  it('stores and consumes a challenge', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-1', 'challenge-abc');
    expect(await consumeChallenge(store, 'user-1')).toBe('challenge-abc');
  });

  it('returns null after the challenge has been consumed', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-2', 'challenge-xyz');
    await consumeChallenge(store, 'user-2');
    expect(await consumeChallenge(store, 'user-2')).toBeNull();
  });

  it('returns null for an unknown user', async () => {
    const store = createInMemoryChallengeStore();
    expect(await consumeChallenge(store, 'unknown')).toBeNull();
  });

  it('returns null for an expired challenge', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-3', 'expired', 1); // 1ms timeout
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait
    }
    expect(await consumeChallenge(store, 'user-3')).toBeNull();
  });

  it('supports an asynchronous custom store', async () => {
    const map = new Map<string, ChallengeEntry>();
    const asyncStore: ChallengeStore = {
      get: async (key) => map.get(key),
      set: async (key, entry) => {
        map.set(key, entry);
      },
      delete: async (key) => {
        map.delete(key);
      }
    };

    await storeChallenge(asyncStore, 'async-user', 'c1');
    expect(await consumeChallenge(asyncStore, 'async-user')).toBe('c1');
    expect(await consumeChallenge(asyncStore, 'async-user')).toBeNull();
  });
});

describe('createInMemoryChallengeStore', () => {
  it('round-trips entries via get/set/delete', async () => {
    const store = createInMemoryChallengeStore();
    const entry: ChallengeEntry = { challenge: 'c', expires: Date.now() + 1000 };
    expect(await store.get('k')).toBeUndefined();
    await store.set('k', entry);
    expect(await store.get('k')).toEqual(entry);
    await store.delete('k');
    expect(await store.get('k')).toBeUndefined();
  });
});

describe('generateRegistrationOptions', () => {
  it('should generate valid registration options', async () => {
    const options = await generateRegistrationOptions(isolatedConfig(), {
      id: 'user-1',
      name: 'test@test.com',
      displayName: 'Test User'
    });

    expect(options.rp.id).toBe('localhost');
    expect(options.rp.name).toBe('Test App');
    expect(options.challenge).toBeTruthy();
    expect(options.user.name).toBe('test@test.com');
    expect(options.user.displayName).toBe('Test User');
    expect(options.pubKeyCredParams).toEqual([
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 }
    ]);
    expect(options.attestation).toBe('none');
  });

  it('should include exclude credentials when provided', async () => {
    const options = await generateRegistrationOptions(
      isolatedConfig(),
      { id: 'user-1', name: 'a', displayName: 'A' },
      ['cred-1', 'cred-2']
    );

    expect(options.excludeCredentials).toHaveLength(2);
    expect(options.excludeCredentials?.[0].id).toBe('cred-1');
    expect(options.excludeCredentials?.[0].type).toBe('public-key');
  });

  it('persists the challenge into the configured store', async () => {
    const store = createInMemoryChallengeStore();
    const options = await generateRegistrationOptions(isolatedConfig(store), {
      id: 'user-persist',
      name: 'p',
      displayName: 'P'
    });

    const entry = await store.get('user-persist');
    expect(entry?.challenge).toBe(options.challenge);
  });
});

describe('generateAuthenticationOptions', () => {
  it('should generate valid authentication options', async () => {
    const options = await generateAuthenticationOptions(isolatedConfig(), 'user-1', ['cred-1']);

    expect(options.rpId).toBe('localhost');
    expect(options.challenge).toBeTruthy();
    expect(options.allowCredentials).toHaveLength(1);
    expect(options.allowCredentials?.[0].id).toBe('cred-1');
    expect(options.userVerification).toBe('preferred');
  });

  it('should work with empty credential list', async () => {
    const options = await generateAuthenticationOptions(isolatedConfig(), 'user-1');

    expect(options.allowCredentials).toHaveLength(0);
  });
});

describe('verifyRegistration', () => {
  it('should reject with expired/missing challenge', async () => {
    try {
      await verifyRegistration(isolatedConfig(), 'user-missing', {
        id: 'test',
        rawId: 'test',
        type: 'public-key',
        response: {
          clientDataJSON: btoa('{}'),
          attestationObject: btoa('{}')
        }
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WebAuthnError);
      expect((err as WebAuthnError).message).toContain('Challenge expired');
    }
  });

  it('should reject with wrong clientData type', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-cd', 'test-challenge');

    const clientData = JSON.stringify({
      type: 'webauthn.get', // wrong — should be webauthn.create
      challenge: 'test-challenge',
      origin: 'http://localhost:3000'
    });

    try {
      await verifyRegistration(isolatedConfig(store), 'user-cd', {
        id: 'test',
        rawId: 'test',
        type: 'public-key',
        response: {
          clientDataJSON: btoa(clientData)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, ''),
          attestationObject: btoa('{}')
        }
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WebAuthnError);
      expect((err as WebAuthnError).message).toContain('Invalid clientData type');
    }
  });

  it('should reject with origin mismatch', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-origin', 'test-challenge');

    const clientData = JSON.stringify({
      type: 'webauthn.create',
      challenge: 'test-challenge',
      origin: 'http://evil.com'
    });

    try {
      await verifyRegistration(isolatedConfig(store), 'user-origin', {
        id: 'test',
        rawId: 'test',
        type: 'public-key',
        response: {
          clientDataJSON: btoa(clientData)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, ''),
          attestationObject: btoa('{}')
        }
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WebAuthnError);
      expect((err as WebAuthnError).message).toContain('Origin mismatch');
    }
  });

  it('rejects a cross-origin registration even when the origin matches', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-xo', 'test-challenge');

    const clientData = JSON.stringify({
      type: 'webauthn.create',
      challenge: 'test-challenge',
      origin: 'http://localhost:3000',
      crossOrigin: true // performed inside an <iframe> — must be rejected
    });

    try {
      await verifyRegistration(isolatedConfig(store), 'user-xo', {
        id: 'test',
        rawId: 'test',
        type: 'public-key',
        response: { clientDataJSON: b64url(clientData), attestationObject: btoa('{}') }
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WebAuthnError);
      expect((err as WebAuthnError).message).toContain('Cross-origin');
    }
  });

  it('does NOT reject when crossOrigin is false (passes the gate, fails downstream)', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-so', 'test-challenge');
    const clientData = JSON.stringify({
      type: 'webauthn.create',
      challenge: 'test-challenge',
      origin: 'http://localhost:3000',
      crossOrigin: false
    });
    try {
      await verifyRegistration(isolatedConfig(store), 'user-so', {
        id: 'test',
        rawId: 'test',
        type: 'public-key',
        response: { clientDataJSON: b64url(clientData), attestationObject: btoa('{}') }
      });
      expect.fail('Should have thrown downstream (attestation parsing)');
    } catch (err) {
      // It got PAST the cross-origin gate and failed later — proving the gate
      // fires only on an explicit `true`. (Guards against a future truthy/!==
      // refactor that would break every real same-origin login.)
      expect((err as Error).message).not.toContain('Cross-origin');
    }
  });

  it('does NOT reject when crossOrigin is absent (standard same-origin client)', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-abs', 'test-challenge');
    const clientData = JSON.stringify({
      type: 'webauthn.create',
      challenge: 'test-challenge',
      origin: 'http://localhost:3000'
      // crossOrigin omitted — the common case
    });
    try {
      await verifyRegistration(isolatedConfig(store), 'user-abs', {
        id: 'test',
        rawId: 'test',
        type: 'public-key',
        response: { clientDataJSON: b64url(clientData), attestationObject: btoa('{}') }
      });
      expect.fail('Should have thrown downstream (attestation parsing)');
    } catch (err) {
      expect((err as Error).message).not.toContain('Cross-origin');
    }
  });
});

describe('verifyAssertion — cross-origin', () => {
  it('rejects a cross-origin assertion even when the origin matches', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-axo', 'auth-challenge');

    const clientData = JSON.stringify({
      type: 'webauthn.get',
      challenge: 'auth-challenge',
      origin: 'http://localhost:3000',
      crossOrigin: true
    });

    try {
      await verifyAssertion(
        isolatedConfig(store),
        'user-axo',
        {
          id: 'cred',
          rawId: 'cred',
          type: 'public-key',
          // authenticatorData/signature are never reached — the cross-origin
          // gate fires before signature verification.
          response: { clientDataJSON: b64url(clientData), authenticatorData: 'AA', signature: 'AA' }
        },
        new Uint8Array(0),
        -7,
        0
      );
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WebAuthnError);
      expect((err as WebAuthnError).message).toContain('Cross-origin');
    }
  });

  it('does NOT reject when crossOrigin is false (passes the gate, fails downstream)', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'user-aso', 'auth-challenge');
    const clientData = JSON.stringify({
      type: 'webauthn.get',
      challenge: 'auth-challenge',
      origin: 'http://localhost:3000',
      crossOrigin: false
    });
    try {
      await verifyAssertion(
        isolatedConfig(store),
        'user-aso',
        {
          id: 'cred',
          rawId: 'cred',
          type: 'public-key',
          response: { clientDataJSON: b64url(clientData), authenticatorData: 'AA', signature: 'AA' }
        },
        new Uint8Array(0),
        -7,
        0
      );
      expect.fail('Should have thrown downstream (authenticator-data parsing)');
    } catch (err) {
      // Past the cross-origin gate → fails at authData parsing instead.
      expect((err as Error).message).not.toContain('Cross-origin');
    }
  });
});

describe('WebAuthnError', () => {
  it('should have correct name and message', () => {
    const err = new WebAuthnError('test error');
    expect(err.name).toBe('WebAuthnError');
    expect(err.message).toBe('test error');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('requireUserVerification', () => {
  it('defaults to `preferred` user verification in generated options', async () => {
    const regOptions = await generateRegistrationOptions(isolatedConfig(), {
      id: 'u',
      name: 'u@u',
      displayName: 'U'
    });
    expect(regOptions.authenticatorSelection?.userVerification).toBe('preferred');

    const authOptions = await generateAuthenticationOptions(isolatedConfig(), 'u');
    expect(authOptions.userVerification).toBe('preferred');
  });

  it('upgrades to `required` when requireUserVerification is on', async () => {
    const cfg = { ...isolatedConfig(), requireUserVerification: true };
    const regOptions = await generateRegistrationOptions(cfg, {
      id: 'u',
      name: 'u@u',
      displayName: 'U'
    });
    expect(regOptions.authenticatorSelection?.userVerification).toBe('required');

    const authOptions = await generateAuthenticationOptions(cfg, 'u');
    expect(authOptions.userVerification).toBe('required');
  });
});

// ---- ES256 end-to-end assertion (regression for Codeberg #38) ----
//
// The suite above never drove the cryptographic signature step — which is
// exactly why the DER-vs-raw bug shipped undetected. These build a *real*
// ES256 assertion (sign with a fresh P-256 key, DER-encode the signature the
// way a FIDO2 authenticator does) and assert verifyAssertion accepts it.

/** Minimal CBOR encoder — just enough for a COSE EC2 public key. */
function cborInt(n: number): number[] {
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
function cborBytes(b: Uint8Array): number[] {
  const len = b.length;
  const head = len < 24 ? [0x40 | len] : len < 0x100 ? [0x58, len] : [0x59, len >> 8, len & 0xff];
  return [...head, ...Array.from(b)];
}
/** COSE_Key for an EC2 / P-256 / ES256 public key: {1:2, 3:-7, -1:1, -2:x, -3:y}. */
function coseEc2Key(x: Uint8Array, y: Uint8Array): Uint8Array {
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
function rawToDer(raw: Uint8Array): Uint8Array {
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

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

/** Assemble a complete, signed ES256 assertion + the matching stored COSE key. */
async function buildEs256Assertion(opts: {
  challenge: string;
  signCount?: number;
  /** Sign over corrupted data → valid DER but a cryptographically wrong signature. */
  tamper?: boolean;
  /** Emit structurally broken DER bytes. */
  breakDer?: boolean;
}): Promise<{ credential: AuthenticationCredentialJSON; publicKey: Uint8Array }> {
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

  // Assertion authenticatorData: rpIdHash(32) ‖ flags(1) ‖ signCount(4). UP+UV set.
  const rpIdHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(config.rpId))
  );
  const tail = new Uint8Array(5);
  tail[0] = 0x05;
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

  return {
    credential: {
      id: 'test-cred-id',
      rawId: b64url('test-cred-id'),
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

describe('verifyAssertion — ES256 signature (Codeberg #38 regression)', () => {
  it('accepts a valid DER-encoded ES256 assertion', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'ceremony', 'chal-ok');
    const { credential, publicKey } = await buildEs256Assertion({ challenge: 'chal-ok' });

    const result = await verifyAssertion(
      isolatedConfig(store),
      'ceremony',
      credential,
      publicKey,
      -7,
      0
    );
    expect(result.credentialId).toBe('test-cred-id');
    expect(result.newCounter).toBe(1);
  });

  it('rejects a cryptographically wrong (but well-formed) signature', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'ceremony', 'chal-tamper');
    const { credential, publicKey } = await buildEs256Assertion({
      challenge: 'chal-tamper',
      tamper: true
    });
    await expect(
      verifyAssertion(isolatedConfig(store), 'ceremony', credential, publicKey, -7, 0)
    ).rejects.toThrow('Signature verification failed');
  });

  it('rejects a structurally invalid signature without reaching the crypto step', async () => {
    const store = createInMemoryChallengeStore();
    await storeChallenge(store, 'ceremony', 'chal-broken');
    const { credential, publicKey } = await buildEs256Assertion({
      challenge: 'chal-broken',
      breakDer: true
    });
    await expect(
      verifyAssertion(isolatedConfig(store), 'ceremony', credential, publicKey, -7, 0)
    ).rejects.toThrow('Invalid ECDSA signature encoding');
  });
});
