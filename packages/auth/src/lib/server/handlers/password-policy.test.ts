import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { createMockAuthDeps } from '../test-utils.js';
import { createPasswordPolicyHandler } from './password-policy.js';

const get = (deps: ReturnType<typeof createMockAuthDeps>) =>
  createPasswordPolicyHandler(deps).GET({} as RequestEvent);

describe('createPasswordPolicyHandler', () => {
  it('serves the configured policy so the client gate can match the server check', async () => {
    const deps = createMockAuthDeps({
      config: {
        jwt: { secret: 's' },
        password: { minLength: 12, requireUppercase: true, requireDigit: true }
      }
    });
    const body = await (await get(deps)).json();
    expect(body.policy).toEqual({
      minLength: 12,
      requireUppercase: true,
      requireLowercase: false,
      requireDigit: true,
      requireSpecial: false
    });
  });

  it('serves the defaults when nothing is configured', async () => {
    const deps = createMockAuthDeps({ config: { jwt: { secret: 's' } } });
    const body = await (await get(deps)).json();
    expect(body.policy.minLength).toBe(8);
    expect(body.policy.requireUppercase).toBe(false);
  });

  it('never ships the hashing work factor, whatever else is on config.password', async () => {
    // The endpoint is unauthenticated: everything in the body must be something
    // one failed submit already reveals. `pbkdf2Iterations` is not.
    const deps = createMockAuthDeps({
      config: { jwt: { secret: 's' }, password: { minLength: 9, pbkdf2Iterations: 111_222 } }
    });
    const raw = await (await get(deps)).text();
    expect(raw).not.toContain('pbkdf2');
    expect(raw).not.toContain('111222');
    expect(Object.keys(JSON.parse(raw).policy).sort()).toEqual([
      'minLength',
      'requireDigit',
      'requireLowercase',
      'requireSpecial',
      'requireUppercase'
    ]);
  });

  it('is cacheable — the policy changes with a deployment, not with a request', async () => {
    const deps = createMockAuthDeps({ config: { jwt: { secret: 's' } } });
    expect((await get(deps)).headers.get('Cache-Control')).toBe('public, max-age=300');
  });
});
