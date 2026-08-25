import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PASSWORD_POLICY } from '../../password-policy.js';
import { fetchPasswordPolicy } from './password-policy.svelte.js';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  ) as unknown as typeof globalThis.fetch;

describe('fetchPasswordPolicy', () => {
  it('reads the policy the endpoint published', async () => {
    const policy = { ...DEFAULT_PASSWORD_POLICY, minLength: 14, requireDigit: true };
    expect(
      await fetchPasswordPolicy('/api/auth/password-policy', respond(200, { policy }))
    ).toEqual(policy);
  });

  it('answers null when the route is not mounted, so the caller keeps the defaults', async () => {
    // A 404 here is the ordinary "consumer has not added the +server.ts yet"
    // case; the form must still work, gating on what an unconfigured server
    // enforces rather than on nothing.
    expect(await fetchPasswordPolicy('/api/auth/password-policy', respond(404, {}))).toBeNull();
  });

  it('answers null instead of throwing inside a component effect when the request fails', async () => {
    const boom = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(
      await fetchPasswordPolicy(
        '/api/auth/password-policy',
        boom as unknown as typeof globalThis.fetch
      )
    ).toBeNull();
  });

  it('tolerates a body without a policy field', async () => {
    expect(await fetchPasswordPolicy('/x', respond(200, { nope: 1 }))).toEqual(
      DEFAULT_PASSWORD_POLICY
    );
  });
});
