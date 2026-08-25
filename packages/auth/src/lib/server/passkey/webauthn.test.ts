import { describe, expect, it, vi } from 'vitest';
import { base64UrlDecode, base64UrlEncode } from '../encoding.js';
import {
  type ChallengeEntry,
  type ChallengeStore,
  consumeChallenge,
  createInMemoryChallengeStore,
  generateChallenge,
  storeChallenge
} from './challenge-store.js';
import { WebAuthnError } from './errors.js';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAssertion,
  verifyRegistration,
  type WebAuthnConfig
} from './webauthn.js';
import {
  buildEs256Assertion,
  cborBytes,
  cborInt,
  concatBytes,
  coseEc2Key
} from './webauthn-test-utils.js';

/**
 * `storeChallenge` with the lifetime a ceremony would give it. Everything below
 * except the expiry tests is about something other than the clock, and
 * `storeChallenge` takes the lifetime as a required argument.
 */
const store5m = (store: ChallengeStore, key: string, challenge: string) =>
  storeChallenge(store, key, challenge, 300_000);

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
    await store5m(store, 'user-1', 'challenge-abc');
    expect(await consumeChallenge(store, 'user-1')).toBe('challenge-abc');
  });

  it('returns null after the challenge has been consumed', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-2', 'challenge-xyz');
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

    await store5m(asyncStore, 'async-user', 'c1');
    expect(await consumeChallenge(asyncStore, 'async-user')).toBe('c1');
    expect(await consumeChallenge(asyncStore, 'async-user')).toBeNull();
  });

  // A failed delete on a valid entry leaves the challenge replayable until its
  // TTL — the one operational failure this function can report. It wrote to bare
  // `console`; the sink now rides on WebAuthnConfig.logger, which
  // createPasskeyHandlers fills from the deps bundle.
  it('reports a failed store.delete through the supplied logger', async () => {
    const map = new Map<string, ChallengeEntry>();
    const brokenDelete: ChallengeStore = {
      get: (key) => map.get(key),
      set: (key, entry) => void map.set(key, entry),
      delete: () => {
        throw new Error('store offline');
      }
    };
    const logger = { warn: vi.fn(), error: vi.fn() };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await store5m(brokenDelete, 'k', 'c1');
    expect(await consumeChallenge(brokenDelete, 'k', logger)).toBe('c1');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('challenge may be replayable until TTL'),
      expect.any(Error)
    );
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
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
    expect(options.userVerification).toBe('required');
  });

  it('should work with empty credential list', async () => {
    const options = await generateAuthenticationOptions(isolatedConfig(), 'user-1');

    expect(options.allowCredentials).toHaveLength(0);
  });
});

// One ceremony, one lifetime (#294): the `timeout` the browser is given and the
// store entry behind it must come from the same value, set or unset. A stored
// challenge that outlives its browser timeout — or dies before it — leaves the
// verify step with a challenge the client already abandoned.
describe('ceremony lifetime', () => {
  it.each([
    { label: 'default', challengeTimeout: undefined, ms: 300_000 },
    { label: 'configured', challengeTimeout: 61_000, ms: 61_000 }
  ])(
    'registration options and their stored challenge expire together ($label)',
    async ({ challengeTimeout, ms }) => {
      const store = createInMemoryChallengeStore();
      const before = Date.now();
      const options = await generateRegistrationOptions(
        { ...isolatedConfig(store), challengeTimeout },
        { id: 'user-timeout', name: 't', displayName: 'T' }
      );

      expect(options.timeout).toBe(ms);
      const entry = await store.get('user-timeout');
      expect(entry?.expires).toBeGreaterThanOrEqual(before + ms);
      expect(entry?.expires).toBeLessThanOrEqual(Date.now() + ms);
    }
  );

  it.each([
    { label: 'default', challengeTimeout: undefined, ms: 300_000 },
    { label: 'configured', challengeTimeout: 61_000, ms: 61_000 }
  ])(
    'authentication options and their stored challenge expire together ($label)',
    async ({ challengeTimeout, ms }) => {
      const store = createInMemoryChallengeStore();
      const before = Date.now();
      const options = await generateAuthenticationOptions(
        { ...isolatedConfig(store), challengeTimeout },
        'ceremony-1'
      );

      expect(options.timeout).toBe(ms);
      const entry = await store.get('ceremony-1');
      expect(entry?.expires).toBeGreaterThanOrEqual(before + ms);
      expect(entry?.expires).toBeLessThanOrEqual(Date.now() + ms);
    }
  );
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
    await store5m(store, 'user-cd', 'test-challenge');

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
    await store5m(store, 'user-origin', 'test-challenge');

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
    await store5m(store, 'user-xo', 'test-challenge');

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
    await store5m(store, 'user-so', 'test-challenge');
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
    await store5m(store, 'user-abs', 'test-challenge');
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
    await store5m(store, 'user-axo', 'auth-challenge');

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
    await store5m(store, 'user-aso', 'auth-challenge');
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
  it('requires user verification in generated options by default', async () => {
    const regOptions = await generateRegistrationOptions(isolatedConfig(), {
      id: 'u',
      name: 'u@u',
      displayName: 'U'
    });
    expect(regOptions.authenticatorSelection?.userVerification).toBe('required');

    const authOptions = await generateAuthenticationOptions(isolatedConfig(), 'u');
    expect(authOptions.userVerification).toBe('required');
  });

  it('downgrades to `preferred` only on an explicit opt-out', async () => {
    const cfg = { ...isolatedConfig(), requireUserVerification: false };
    const regOptions = await generateRegistrationOptions(cfg, {
      id: 'u',
      name: 'u@u',
      displayName: 'U'
    });
    expect(regOptions.authenticatorSelection?.userVerification).toBe('preferred');

    const authOptions = await generateAuthenticationOptions(cfg, 'u');
    expect(authOptions.userVerification).toBe('preferred');
  });

  it('rejects a UP-only assertion by default', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'ceremony', 'chal-uv');
    const { credential, publicKey } = await buildEs256Assertion(config, {
      challenge: 'chal-uv',
      flags: 0x01 // UP only — a tap, no PIN/biometric
    });

    await expect(
      verifyAssertion(isolatedConfig(store), 'ceremony', credential, publicKey, -7, 0)
    ).rejects.toThrow('User verification required but not performed');
  });

  it('accepts a UP-only assertion when the opt-out is explicit', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'ceremony', 'chal-uv-off');
    const { credential, publicKey } = await buildEs256Assertion(config, {
      challenge: 'chal-uv-off',
      flags: 0x01
    });

    const result = await verifyAssertion(
      { ...isolatedConfig(store), requireUserVerification: false },
      'ceremony',
      credential,
      publicKey,
      -7,
      0
    );
    expect(result.credentialId).toBe('test-cred-id');
  });
});

// ---- ES256 end-to-end assertion (regression for Codeberg #38) ----
//
// The suite above never drove the cryptographic signature step — which is
// exactly why the DER-vs-raw bug shipped undetected. These build a *real*
// ES256 assertion (sign with a fresh P-256 key, DER-encode the signature the
// way a FIDO2 authenticator does) and assert verifyAssertion accepts it.

describe('verifyAssertion — ES256 signature (Codeberg #38 regression)', () => {
  it('accepts a valid DER-encoded ES256 assertion', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'ceremony', 'chal-ok');
    const { credential, publicKey } = await buildEs256Assertion(config, { challenge: 'chal-ok' });

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
    await store5m(store, 'ceremony', 'chal-tamper');
    const { credential, publicKey } = await buildEs256Assertion(config, {
      challenge: 'chal-tamper',
      tamper: true
    });
    await expect(
      verifyAssertion(isolatedConfig(store), 'ceremony', credential, publicKey, -7, 0)
    ).rejects.toThrow('Signature verification failed');
  });

  it('rejects a structurally invalid signature without reaching the crypto step', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'ceremony', 'chal-broken');
    const { credential, publicKey } = await buildEs256Assertion(config, {
      challenge: 'chal-broken',
      breakDer: true
    });
    await expect(
      verifyAssertion(isolatedConfig(store), 'ceremony', credential, publicKey, -7, 0)
    ).rejects.toThrow('Invalid ECDSA signature encoding');
  });
});

describe('verifyAssertion — RP binding (rpIdHash, WebAuthn §7.2 step 15)', () => {
  it('rejects an assertion whose authenticator data was minted for a different RP', async () => {
    // Test-review mutation finding: the mismatch branch had no negative test —
    // deleting the check kept 840 green.
    const store = createInMemoryChallengeStore();
    await store5m(store, 'ceremony', 'chal-rp');
    const { credential, publicKey } = await buildEs256Assertion(config, {
      challenge: 'chal-rp',
      rpId: 'evil.example'
    });
    await expect(
      verifyAssertion(isolatedConfig(store), 'ceremony', credential, publicKey, -7, 0)
    ).rejects.toThrow('RP ID hash mismatch');
  });
});

/** COSE_Key for an RSA / RS256 public key: {1:3, 3:-257, -1:n, -2:e}. */
function coseRsaKey(n: Uint8Array, e: Uint8Array): Uint8Array {
  const entries = [
    [...cborInt(1), ...cborInt(3)],
    [...cborInt(3), ...cborInt(-257)],
    [...cborInt(-1), ...cborBytes(n)],
    [...cborInt(-2), ...cborBytes(e)]
  ];
  return new Uint8Array([0xa0 | entries.length, ...entries.flat()]);
}

// A corrupt/forged stored public key (structurally valid COSE, but unimportable)
// must surface as a WebAuthnError → 400, not an unhandled DOMException → 500.
// Registration stores COSE bytes without importing them, so such a key reaches
// verifyAssertion.
describe('verifyAssertion — rejects an unimportable stored key with a clean 400', () => {
  it('ES256 key whose point is not on P-256 (real importKey rejection)', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'ceremony', 'chal-offcurve');
    // Valid ceremony fields (so the flow reaches the key import); the signature
    // is never examined because importKey rejects the off-curve point first.
    const { credential } = await buildEs256Assertion(config, { challenge: 'chal-offcurve' });
    const offCurveKey = coseEc2Key(new Uint8Array(32).fill(0x02), new Uint8Array(32).fill(0x02));
    await expect(
      verifyAssertion(isolatedConfig(store), 'ceremony', credential, offCurveKey, -7, 0)
    ).rejects.toThrow('Invalid ES256 public key');
  });

  it('RS256 key that importKey rejects', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'ceremony', 'chal-badrsa');
    const { credential } = await buildEs256Assertion(config, { challenge: 'chal-badrsa' });
    // n and e are present so the COSE guard passes and the flow reaches
    // importKey. No mainstream runtime (Node and Bun both confirmed) eagerly
    // rejects a structurally-valid-but-bogus RSA JWK — they defer validation to
    // verify() — so force the importKey rejection a stricter implementation
    // would raise, and assert verifyRS256 maps it to a clean 400.
    const rsaKey = coseRsaKey(new Uint8Array(256).fill(0xc0), new Uint8Array([0x01, 0x00, 0x01]));
    const spy = vi
      .spyOn(crypto.subtle, 'importKey')
      .mockRejectedValue(new DOMException('off-curve / bad key', 'DataError'));
    try {
      await expect(
        verifyAssertion(isolatedConfig(store), 'ceremony', credential, rsaKey, -257, 0)
      ).rejects.toThrow('Invalid RS256 public key');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('hostile-input hardening (R9)', () => {
  const b64u = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const validClientData = () =>
    btoa(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: 'test-challenge',
        origin: 'http://localhost:3000'
      })
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  it('rejects a non-JSON clientDataJSON as a WebAuthnError, not a SyntaxError', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-mal', 'test-challenge');

    try {
      await verifyRegistration(isolatedConfig(store), 'user-mal', {
        id: 'test',
        rawId: 'test',
        type: 'public-key',
        response: {
          clientDataJSON: b64u(new TextEncoder().encode('not json {{{')),
          attestationObject: b64u(new Uint8Array([0xa0]))
        }
      });
      expect.fail('Should have thrown');
    } catch (err) {
      // The raw SyntaxError previously escaped the WebAuthnError-only catch in
      // the handlers and surfaced as a 500.
      expect(err).toBeInstanceOf(WebAuthnError);
      expect((err as WebAuthnError).message).toContain('Malformed clientDataJSON');
    }
  });

  it('rejects malformed attestation CBOR as a WebAuthnError', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-cbor', 'test-challenge');

    try {
      await verifyRegistration(isolatedConfig(store), 'user-cbor', {
        id: 'test',
        rawId: 'test',
        type: 'public-key',
        // 0xff = unsupported CBOR — previously a plain Error → 500.
        response: {
          clientDataJSON: validClientData(),
          attestationObject: b64u(new Uint8Array([0xff]))
        }
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WebAuthnError);
      expect((err as WebAuthnError).message).toContain('Malformed attestation object');
    }
  });

  it('rejects an attestation object with trailing bytes', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-trail', 'test-challenge');

    try {
      await verifyRegistration(isolatedConfig(store), 'user-trail', {
        id: 'test',
        rawId: 'test',
        type: 'public-key',
        // 0xa0 = valid empty map, then one smuggled trailing byte.
        response: {
          clientDataJSON: validClientData(),
          attestationObject: b64u(new Uint8Array([0xa0, 0x00]))
        }
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WebAuthnError);
      expect((err as WebAuthnError).message).toContain('Malformed attestation object');
    }
  });

  it('rejects undecodable base64url credential fields as WebAuthnError, never a raw 500', async () => {
    // Silent-failure review (package 3): these four decodes ran OUTSIDE any
    // try/catch — 'aaaaa' (len % 4 === 1) or '!!!' threw a raw
    // InvalidCharacterError that the handlers rethrow as a 500, skipping the
    // onLoginFailed audit hook for exactly the hostile-probe case.
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-reg', 'test-challenge');
    await expect(
      verifyRegistration(isolatedConfig(store), 'user-reg', {
        id: 'x',
        rawId: 'x',
        type: 'public-key',
        response: { clientDataJSON: 'aaaaa', attestationObject: validClientData() }
      })
    ).rejects.toThrow('Malformed clientDataJSON');

    const store2 = createInMemoryChallengeStore();
    await store5m(store2, 'user-reg', 'test-challenge');
    await expect(
      verifyRegistration(isolatedConfig(store2), 'user-reg', {
        id: 'x',
        rawId: 'x',
        type: 'public-key',
        response: { clientDataJSON: validClientData(), attestationObject: '!!!' }
      })
    ).rejects.toThrow('Malformed attestationObject');

    const store3 = createInMemoryChallengeStore();
    await store5m(store3, 'ceremony', 'chal-mal');
    const es = await buildEs256Assertion(config, { challenge: 'chal-mal' });
    await expect(
      verifyAssertion(
        isolatedConfig(store3),
        'ceremony',
        {
          ...es.credential,
          response: { ...es.credential.response, authenticatorData: 'aaaaa' }
        },
        es.publicKey,
        -7,
        0
      )
    ).rejects.toThrow('Malformed authenticatorData');

    const store4 = createInMemoryChallengeStore();
    await store5m(store4, 'ceremony', 'chal-mal2');
    const es2 = await buildEs256Assertion(config, { challenge: 'chal-mal2' });
    await expect(
      verifyAssertion(
        isolatedConfig(store4),
        'ceremony',
        {
          ...es2.credential,
          response: { ...es2.credential.response, signature: '!!!' }
        },
        es2.publicKey,
        -7,
        0
      )
    ).rejects.toThrow('Malformed signature');
  });

  it('rejects a body missing the response object entirely as WebAuthnError, not a TypeError', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-reg', 'test-challenge');
    await expect(
      verifyRegistration(isolatedConfig(store), 'user-reg', {
        id: 'x',
        rawId: 'x',
        type: 'public-key'
      } as never)
    ).rejects.toThrow('Malformed clientDataJSON');
  });
});

// ---- Registration happy path + exact COSE slicing (R9) ----
//
// Mutation-test finding: every prior verifyRegistration test failed at a gate
// BEFORE the attested-credential-data branch, so the exact-slicing fix (and
// the ED-flag tolerance it exists for) was entirely unguarded — reverting
// decodeCborFirst to strict decodeCbor would reject every credProtect-style
// authenticator with a 400 and stay green.

describe('verifyRegistration — attested credential data (exact COSE slicing)', () => {
  const cborText = (s: string): number[] => {
    const b = new TextEncoder().encode(s);
    return [0x60 | b.length, ...Array.from(b)];
  };
  /** attestationObject {fmt:'none', attStmt:{}, authData: <bytes>}. */
  const noneAttestation = (authData: Uint8Array): Uint8Array =>
    new Uint8Array([
      0xa3,
      ...cborText('fmt'),
      ...cborText('none'),
      ...cborText('attStmt'),
      0xa0,
      ...cborText('authData'),
      ...cborBytes(authData)
    ]);

  const b64uStr = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  async function buildRegistrationAuthData(extensions?: Uint8Array, rpId?: string, uv = true) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign'
    ]);
    const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    const coseKey = coseEc2Key(base64UrlDecode(jwk.x ?? ''), base64UrlDecode(jwk.y ?? ''));

    const rpIdHash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId ?? config.rpId))
    );
    const head = new Uint8Array(5);
    head[0] = 0x41 | (uv ? 0x04 : 0) | (extensions ? 0x80 : 0); // UP | AT (| UV) (| ED)
    new DataView(head.buffer).setUint32(1, 7, false);
    const aaguid = new Uint8Array(16).fill(0xab);
    const credId = new TextEncoder().encode('reg-cred-1');
    // Layout per WebAuthn §6.5.2: rpIdHash ‖ flags ‖ signCount ‖ aaguid(16) ‖
    // credIdLen(2 BE) ‖ credId ‖ COSE key ‖ [extensions].
    const authData = concatBytes(
      rpIdHash,
      head,
      aaguid,
      new Uint8Array([0, credId.length]),
      credId,
      coseKey,
      extensions ?? new Uint8Array(0)
    );
    return { coseKey, credId, authData };
  }

  async function verify(
    store: ChallengeStore,
    attestationObject: Uint8Array,
    cfg?: Partial<WebAuthnConfig>
  ) {
    return verifyRegistration({ ...isolatedConfig(store), ...cfg }, 'user-reg', {
      id: 'reg-cred-1',
      rawId: 'reg-cred-1',
      type: 'public-key',
      response: {
        clientDataJSON: b64uStr(
          JSON.stringify({
            type: 'webauthn.create',
            challenge: 'reg-challenge',
            origin: config.origin
          })
        ),
        attestationObject: b64uStr(String.fromCharCode(...attestationObject)),
        transports: ['internal']
      }
    });
  }

  it('extracts the credential and slices the COSE key byte-exactly past extension data (ED)', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-reg', 'reg-challenge');
    // {credProtect: 2} — the classic authenticator extension following the key.
    const ext = new Uint8Array([0xa1, ...cborText('credProtect'), 0x02]);
    const { coseKey, credId, authData } = await buildRegistrationAuthData(ext);

    const result = await verify(store, noneAttestation(authData));

    expect(result.credentialId).toBe(base64UrlEncode(credId));
    expect(result.publicKeyAlg).toBe(-7);
    expect(result.counter).toBe(7);
    // THE pin: the stored key is exactly the COSE key — extension bytes are
    // not persisted inside it (and strict full-consume parsing would have
    // rejected this registration outright).
    expect(result.publicKey).toEqual(coseKey);
  });

  it('verifies a plain registration without extensions identically', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-reg', 'reg-challenge');
    const { coseKey, authData } = await buildRegistrationAuthData();

    const result = await verify(store, noneAttestation(authData));
    expect(result.publicKey).toEqual(coseKey);
  });

  it('rejects authenticator data minted for a different RP (rpIdHash mismatch)', async () => {
    // WebAuthn §7.1 step 13, the RP-binding check. Test-review mutation
    // finding: making this check vacuous kept the whole suite green — a
    // credential minted for evil.example must not register here.
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-reg', 'reg-challenge');
    const { authData } = await buildRegistrationAuthData(undefined, 'evil.example');

    await expect(verify(store, noneAttestation(authData))).rejects.toThrow('RP ID hash mismatch');
  });

  it('rejects a registration whose authenticator only proved user presence', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-reg', 'reg-challenge');
    const { authData } = await buildRegistrationAuthData(undefined, undefined, false);

    await expect(verify(store, noneAttestation(authData))).rejects.toThrow(
      'User verification required but not performed'
    );
  });

  it('registers a UP-only authenticator when the opt-out is explicit', async () => {
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-reg', 'reg-challenge');
    const { coseKey, authData } = await buildRegistrationAuthData(undefined, undefined, false);

    const result = await verify(store, noneAttestation(authData), {
      requireUserVerification: false
    });
    expect(result.publicKey).toEqual(coseKey);
  });
});

describe('malformed COSE key inside authenticatorData (silent-failure review)', () => {
  it('rejects a duplicate-key COSE blob as a WebAuthnError, not a raw CBOR 500', async () => {
    // The inner COSE decode was the one unwrapped parse left after R9 — the
    // new duplicate-key throw would otherwise escape the handlers' WebAuthnError
    // catch as a 500 and skip the onLoginFailed audit hook.
    const store = createInMemoryChallengeStore();
    await store5m(store, 'user-reg', 'reg-challenge');

    const rpIdHash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(config.rpId))
    );
    const head = new Uint8Array(5);
    head[0] = 0x41; // UP | AT
    const credId = new TextEncoder().encode('reg-cred-1');
    // Map(2) with the key 1 twice — rejected by the hardened decoder.
    const dupKeyCose = new Uint8Array([0xa2, 0x01, 0x02, 0x01, 0x03]);
    const authData = concatBytes(
      rpIdHash,
      head,
      new Uint8Array(16).fill(0xab),
      new Uint8Array([0, credId.length]),
      credId,
      dupKeyCose
    );

    const b64uStr = (s: string) =>
      btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const cborText = (t: string): number[] => {
      const b = new TextEncoder().encode(t);
      return [0x60 | b.length, ...Array.from(b)];
    };
    const attestation = new Uint8Array([
      0xa3,
      ...cborText('fmt'),
      ...cborText('none'),
      ...cborText('attStmt'),
      0xa0,
      ...cborText('authData'),
      ...cborBytes(authData)
    ]);

    try {
      await verifyRegistration(isolatedConfig(store), 'user-reg', {
        id: 'reg-cred-1',
        rawId: 'reg-cred-1',
        type: 'public-key',
        response: {
          clientDataJSON: b64uStr(
            JSON.stringify({
              type: 'webauthn.create',
              challenge: 'reg-challenge',
              origin: config.origin
            })
          ),
          attestationObject: b64uStr(String.fromCharCode(...attestation))
        }
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WebAuthnError);
      expect((err as WebAuthnError).message).toContain('Malformed COSE public key');
    }
  });
});
