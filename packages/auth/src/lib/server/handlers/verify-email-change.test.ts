import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createVerifyEmailHandler } from './verify-email.js';
import { createVerifyEmailChangeHandler } from './verify-email-change.js';

const event = (body: unknown) => mockPostEvent(body) as unknown as RequestEvent;

describe('createVerifyEmailChangeHandler', () => {
  it('returns 400 when the token is missing', async () => {
    const deps = createMockAuthDeps();
    const res = await createVerifyEmailChangeHandler(deps).POST(event({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the token is invalid / expired / the target is taken', async () => {
    const deps = createMockAuthDeps({
      user: { consumeEmailChangeToken: vi.fn().mockResolvedValue(null) }
    });
    const res = await createVerifyEmailChangeHandler(deps).POST(event({ token: 'whatever' }));
    expect(res.status).toBe(400);
  });

  it('confirms the change and fires onEmailChanged with the new address (no session required)', async () => {
    const onEmailChanged = vi.fn();
    // The claim returns the post-swap user — email is now the new address.
    const swapped = createMockUser({ id: 'user-1', email: 'new@test.com', emailVerified: true });
    const deps = createMockAuthDeps({
      config: { hooks: { onEmailChanged } },
      user: { consumeEmailChangeToken: vi.fn().mockResolvedValue(swapped) }
    });

    const res = await createVerifyEmailChangeHandler(deps).POST(event({ token: 'good-token' }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(deps.repos.user.consumeEmailChangeToken).toHaveBeenCalledWith(expect.any(String));
    expect(onEmailChanged).toHaveBeenCalledWith('user-1', 'new@test.com');
  });
});

describe('verify-email limiter bucket', () => {
  // The comment claimed the bucket was shared; `makeRateLimiter` allocated a
  // fresh in-memory Map per call, so a configured `verifyEmail.max: 3` bought 3
  // requests at EACH endpoint — measured 6 accepted for a configured max of 3.
  it('is one budget across verify-email and verify-email-change', async () => {
    const deps = createMockAuthDeps({
      config: { rateLimit: { verifyEmail: { windowMs: 60_000, max: 3 } } }
    });
    const verifyEmail = createVerifyEmailHandler(deps);
    const verifyChange = createVerifyEmailChangeHandler(deps);

    const codes: number[] = [];
    for (let i = 0; i < 3; i++) codes.push((await verifyEmail.POST(event({ token: 'x' }))).status);
    for (let i = 0; i < 3; i++) codes.push((await verifyChange.POST(event({ token: 'x' }))).status);

    expect(codes.filter((c) => c !== 429)).toHaveLength(3);
    expect(codes.slice(3)).toEqual([429, 429, 429]);
  });
});
