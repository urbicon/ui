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
