import { describe, expect, it } from 'vitest';
import {
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
