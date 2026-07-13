import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCronRunner } from './cron';

describe('createCronRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should not be running initially', () => {
    const runner = createCronRunner({
      secret: 'test-secret',
      jobs: [{ path: '/api/test', intervalSeconds: 60 }]
    });
    expect(runner.isRunning()).toBe(false);
  });

  it('should be running after start()', () => {
    const runner = createCronRunner({
      secret: 'test-secret',
      jobs: [{ path: '/api/test', intervalSeconds: 60 }]
    });
    runner.start();
    expect(runner.isRunning()).toBe(true);
    runner.stop();
  });

  it('should not be running after stop()', () => {
    const runner = createCronRunner({
      secret: 'test-secret',
      jobs: [{ path: '/api/test', intervalSeconds: 60 }]
    });
    runner.start();
    runner.stop();
    expect(runner.isRunning()).toBe(false);
  });

  it('should not start twice', () => {
    const runner = createCronRunner({
      secret: 'test-secret',
      jobs: [{ path: '/api/test', intervalSeconds: 10 }]
    });
    runner.start();
    runner.start();

    vi.advanceTimersByTime(10_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    runner.stop();
  });

  it('should call fetch for each job at the correct interval', async () => {
    const runner = createCronRunner({
      secret: 'my-secret',
      baseUrl: 'http://localhost:5000',
      jobs: [
        { path: '/api/job-a', intervalSeconds: 10 },
        { path: '/api/job-b', intervalSeconds: 20, method: 'GET' }
      ]
    });

    runner.start();

    // At 10s: job-a fires
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/job-a', {
      method: 'POST',
      headers: { 'x-cron-secret': 'my-secret' }
    });

    // At 20s: job-a fires again + job-b fires for the first time
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/job-b', {
      method: 'GET',
      headers: { 'x-cron-secret': 'my-secret' }
    });

    runner.stop();
  });

  it('should use default baseUrl when not provided', async () => {
    const runner = createCronRunner({
      secret: 's',
      jobs: [{ path: '/api/ping', intervalSeconds: 5 }]
    });
    runner.start();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/ping', expect.any(Object));
    runner.stop();
  });

  it('should use custom secretHeader', async () => {
    const runner = createCronRunner({
      secret: 'abc',
      secretHeader: 'x-internal-key',
      jobs: [{ path: '/api/test', intervalSeconds: 5 }]
    });
    runner.start();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetch).toHaveBeenCalledWith(expect.any(String), {
      method: 'POST',
      headers: { 'x-internal-key': 'abc' }
    });
    runner.stop();
  });

  it('should call onError when fetch throws', async () => {
    const error = new Error('Network error');
    vi.mocked(fetch).mockRejectedValueOnce(error);

    const onError = vi.fn();
    const job = { path: '/api/fail', intervalSeconds: 5 };
    const runner = createCronRunner({
      secret: 's',
      jobs: [job],
      onError
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onError).toHaveBeenCalledWith(job, error);
    runner.stop();
  });

  it('should not call onError when fetch succeeds', async () => {
    const onError = vi.fn();
    const runner = createCronRunner({
      secret: 's',
      jobs: [{ path: '/api/ok', intervalSeconds: 5 }],
      onError
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onError).not.toHaveBeenCalled();
    runner.stop();
  });

  it('should call onError once with a status-bearing Error on a 500 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: 'Internal Server Error' })
    );

    const onError = vi.fn();
    const job = { path: '/api/fail', intervalSeconds: 5 };
    const runner = createCronRunner({
      secret: 's',
      jobs: [job],
      onError
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onError).toHaveBeenCalledTimes(1);
    const [passedJob, err] = onError.mock.calls[0] as [unknown, Error & { status?: number }];
    expect(passedJob).toBe(job);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(500);
    runner.stop();
  });

  it('should call onError with a status-bearing Error on a 403 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 403, statusText: 'Forbidden' })
    );

    const onError = vi.fn();
    const job = { path: '/api/forbidden', intervalSeconds: 5 };
    const runner = createCronRunner({
      secret: 's',
      jobs: [job],
      onError
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]?.[1] as Error & { status?: number };
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    runner.stop();
  });

  it('should call a throwing onError exactly once on a non-2xx (no re-invoke via catch)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Boom' }));

    // A misbehaving handler that itself throws must not be re-invoked by the
    // surrounding try/catch — the non-2xx path lives outside the fetch try.
    const onError = vi.fn(() => {
      throw new Error('handler boom');
    });
    // The deliberate throw escapes as an unhandled rejection by design (symmetric
    // with the network-rejection path); swallow it so it doesn't fail the suite.
    const swallow = vi.fn();
    process.on('unhandledRejection', swallow);

    const runner = createCronRunner({
      secret: 's',
      jobs: [{ path: '/api/fail', intervalSeconds: 5 }],
      onError
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onError).toHaveBeenCalledTimes(1);
    runner.stop();
    process.off('unhandledRejection', swallow);
  });

  it('should not throw when a non-2xx response has no onError configured', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));

    const runner = createCronRunner({
      secret: 's',
      jobs: [{ path: '/api/missing', intervalSeconds: 5 }]
    });

    runner.start();
    await expect(vi.advanceTimersByTimeAsync(5_000)).resolves.not.toThrow();
    runner.stop();
  });

  it('should stop all timers and not fire after stop()', async () => {
    const runner = createCronRunner({
      secret: 's',
      jobs: [{ path: '/api/test', intervalSeconds: 5 }]
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetch).toHaveBeenCalledTimes(1);

    runner.stop();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
