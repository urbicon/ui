import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createVerifyEmailHandler } from './verify-email.js';

const event = (body: unknown) => mockPostEvent(body) as unknown as RequestEvent;

describe('createVerifyEmailHandler', () => {
  it('returns 400 when the token is missing', async () => {
    const deps = createMockAuthDeps();
    const res = await createVerifyEmailHandler(deps).POST(event({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the token cannot be claimed (invalid/expired/used)', async () => {
    const deps = createMockAuthDeps({
      user: { consumeVerificationToken: vi.fn().mockResolvedValue(null) }
    });
    const res = await createVerifyEmailHandler(deps).POST(event({ token: 'bad' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 on a successful atomic claim', async () => {
    const deps = createMockAuthDeps({
      user: { consumeVerificationToken: vi.fn().mockResolvedValue(createMockUser()) }
    });
    const res = await createVerifyEmailHandler(deps).POST(event({ token: 'good' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('single-use: a concurrent second verify of the same token is rejected', async () => {
    const consumeVerificationToken = vi
      .fn()
      .mockResolvedValueOnce(createMockUser())
      .mockResolvedValueOnce(null);
    const deps = createMockAuthDeps({ user: { consumeVerificationToken } });
    const handler = createVerifyEmailHandler(deps);

    const [a, b] = await Promise.all([
      handler.POST(event({ token: 'good' })),
      handler.POST(event({ token: 'good' }))
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });

  // Cluster J: verify-email reads the `verifyEmail` rate-limit key.
  it('returns 429 once the verify-email rate limit is exceeded', async () => {
    const deps = createMockAuthDeps({
      config: { rateLimit: { verifyEmail: { windowMs: 60_000, max: 1 } } }
    });
    const handler = createVerifyEmailHandler(deps);
    await handler.POST(event({ token: 'good' }));
    const limited = await handler.POST(event({ token: 'good' }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
