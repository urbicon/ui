import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLettermintTransport } from './lettermint.js';

const okResponse = () => new Response(JSON.stringify({ id: 'msg-1' }), { status: 200 });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createLettermintTransport', () => {
  it('throws when neither token nor apiKey is provided', () => {
    // Both fields are optional at the type level (either satisfies the API), so
    // an empty config compiles — the runtime guard is what enforces "one of".
    expect(() => createLettermintTransport({})).toThrow(/token/i);
  });

  it('POSTs to {baseUrl}/send with the x-lettermint-token header (v2 API)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const transport = createLettermintTransport({ token: 'lm-token' });
    await transport.send({
      from: 'Acme <auth@acme.test>',
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.lettermint.co/v1/send');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-lettermint-token': 'lm-token'
    });
    // No stale Authorization: Bearer header.
    expect(init.headers).not.toHaveProperty('Authorization');
    // The request is bounded by a timeout signal.
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      from: 'Acme <auth@acme.test>',
      to: ['user@example.com'], // wrapped in an array
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi'
    });
  });

  it('accepts apiKey as a back-compat alias for token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await createLettermintTransport({ apiKey: 'legacy-key' }).send({
      from: 'a@test.com',
      to: 'b@test.com',
      subject: 's',
      html: 'h'
    });

    expect(fetchMock.mock.calls[0][1].headers['x-lettermint-token']).toBe('legacy-key');
  });

  it('prefers token over apiKey when both are set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await createLettermintTransport({ token: 'new', apiKey: 'old' }).send({
      from: 'a@test.com',
      to: 'b@test.com',
      subject: 's',
      html: 'h'
    });

    expect(fetchMock.mock.calls[0][1].headers['x-lettermint-token']).toBe('new');
  });

  it('honours a custom baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await createLettermintTransport({ token: 't', baseUrl: 'https://eu.lettermint.test/v1' }).send({
      from: 'a@test.com',
      to: 'b@test.com',
      subject: 's',
      html: 'h'
    });

    expect(fetchMock.mock.calls[0][0]).toBe('https://eu.lettermint.test/v1/send');
  });

  it('throws with status + body on a non-2xx response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"error":"invalid sender"}', { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createLettermintTransport({ token: 't' }).send({
        from: 'a@test.com',
        to: 'b@test.com',
        subject: 's',
        html: 'h'
      })
    ).rejects.toThrow(/422.*invalid sender/);
  });

  it('falls back to the configured `from` when a send omits it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await createLettermintTransport({ token: 't', from: 'Fallback <noreply@acme.test>' }).send({
      to: 'b@test.com',
      subject: 's',
      html: 'h'
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe('Fallback <noreply@acme.test>');
  });

  it('prefers a per-send `from` over the configured default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await createLettermintTransport({ token: 't', from: 'config@acme.test' }).send({
      from: 'per-send@acme.test',
      to: 'b@test.com',
      subject: 's',
      html: 'h'
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe('per-send@acme.test');
  });

  it('throws (without issuing a request) when neither a per-send nor a configured `from` is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createLettermintTransport({ token: 't' }).send({ to: 'b@test.com', subject: 's', html: 'h' })
    ).rejects.toThrow(/from|sender/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a request timeout as an Error carrying the budget', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createLettermintTransport({ token: 't', timeoutMs: 1 }).send({
        from: 'a@test.com',
        to: 'b@test.com',
        subject: 's',
        html: 'h'
      })
    ).rejects.toThrow(/timed out after 1ms/);
  });

  it('propagates a non-timeout fetch error untouched', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createLettermintTransport({ token: 't' }).send({
        from: 'a@test.com',
        to: 'b@test.com',
        subject: 's',
        html: 'h'
      })
    ).rejects.toThrow('fetch failed');
  });
});
