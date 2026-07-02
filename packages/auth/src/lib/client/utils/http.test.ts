import { describe, expect, it, vi } from 'vitest';
import { en } from '../../i18n/en.js';
import type { AuthLocale } from '../../i18n/keys.js';
import { errorTextFromBody, postJson } from './http.js';

describe('postJson', () => {
  it('POSTs the JSON body through the provided fetcher and parses the response', async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ user: { id: 'u1' } }), { status: 200 })
    ) as unknown as typeof fetch;

    const result = await postJson('/api/x', { a: 1 }, { fetcher });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ user: { id: 'u1' } });
    const [url, init] = vi.mocked(fetcher).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/x');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('yields ok:false with an empty data object on a non-JSON error body', async () => {
    const fetcher = vi.fn(
      async () => new Response('gateway timeout', { status: 504 })
    ) as unknown as typeof fetch;

    const result = await postJson('/api/x', {}, { fetcher });
    expect(result).toEqual({ ok: false, data: {} });
  });

  it('normalizes non-object JSON bodies (null, arrays) to an empty object', async () => {
    // A proxy error page can return literal `null`/an array with a JSON
    // content type; the caller's `data.code` access must not TypeError.
    for (const body of ['null', '[1,2]', '"oops"']) {
      const fetcher = vi.fn(
        async () =>
          new Response(body, { status: 502, headers: { 'Content-Type': 'application/json' } })
      ) as unknown as typeof fetch;
      const result = await postJson('/api/x', {}, { fetcher });
      expect(result, body).toEqual({ ok: false, data: {} });
    }
  });
});

describe('errorTextFromBody', () => {
  const t = en as AuthLocale;

  it('maps a machine code through the locale bundle', () => {
    expect(errorTextFromBody({ code: 'invalid_credentials', error: 'raw prose' }, t)).toBe(
      t.auth.errors.invalidCredentials
    );
  });

  it('falls back to the server prose for an unknown code', () => {
    expect(errorTextFromBody({ code: 'brand_new_code', error: 'Server prose.' }, t)).toBe(
      'Server prose.'
    );
  });

  it('yields the generic message when the body has neither', () => {
    expect(errorTextFromBody({}, t)).toBeTruthy();
  });

  it('lets a validation_error keep its field-level server prose (not the generic string)', () => {
    // Silent-failure review: a delegation refactor that stopped threading the
    // prose as fallback would keep every other case green while degrading
    // "Email is invalid" to a generic message.
    expect(errorTextFromBody({ code: 'validation_error', error: 'Email is invalid' }, t)).toBe(
      'Email is invalid'
    );
  });
});
