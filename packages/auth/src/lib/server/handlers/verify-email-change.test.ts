import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
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
