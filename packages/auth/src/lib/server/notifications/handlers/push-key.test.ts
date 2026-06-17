import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { createPushKeyHandler } from './push-key.js';

describe('createPushKeyHandler', () => {
  it('returns the configured VAPID public key', async () => {
    const res = await createPushKeyHandler('BPublicVapidKey_123').GET({} as RequestEvent);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ publicKey: 'BPublicVapidKey_123' });
  });
});
