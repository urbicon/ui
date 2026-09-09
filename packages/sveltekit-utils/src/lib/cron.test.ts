import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CronRunnerConfig, createCronRunner } from './cron';

// The registry's address is part of the contract — `globalThis` under this
// well-known symbol — and is spelled out here rather than reached through an
// export: a test that imported the key could not notice it changing, and the
// key is the whole reason a hot reload finds the previous evaluation's runners.
const CRON_REGISTRY = Symbol.for('urbicon-ui.sveltekit-utils.cron');

const registry = () =>
  (globalThis as { [CRON_REGISTRY]?: Map<string, number> })[CRON_REGISTRY] ?? new Map();

const onError = () => {};

describe('createCronRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    // Every start() registers its paths process-wide; without this a runner
    // one test left armed makes the next one warn about a double start.
    delete (globalThis as { [CRON_REGISTRY]?: unknown })[CRON_REGISTRY];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should not be running initially', () => {
    const runner = createCronRunner({
      secret: 'test-secret',
      jobs: [{ path: '/api/test', intervalSeconds: 60 }],
      onError
    });
    expect(runner.isRunning()).toBe(false);
  });

  it('should be running after start()', () => {
    const runner = createCronRunner({
      secret: 'test-secret',
      jobs: [{ path: '/api/test', intervalSeconds: 60 }],
      onError
    });
    runner.start();
    expect(runner.isRunning()).toBe(true);
    runner.stop();
  });

  it('should not be running after stop()', () => {
    const runner = createCronRunner({
      secret: 'test-secret',
      jobs: [{ path: '/api/test', intervalSeconds: 60 }],
      onError
    });
    runner.start();
    runner.stop();
    expect(runner.isRunning()).toBe(false);
  });

  it('should not start twice', () => {
    const runner = createCronRunner({
      secret: 'test-secret',
      jobs: [{ path: '/api/test', intervalSeconds: 10 }],
      onError
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
      ],
      onError
    });

    runner.start();
    // No leading call: start() arms the timers and fires nothing.
    expect(fetch).not.toHaveBeenCalled();

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
      jobs: [{ path: '/api/ping', intervalSeconds: 5 }],
      onError
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
      jobs: [{ path: '/api/test', intervalSeconds: 5 }],
      onError
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

    const handler = vi.fn();
    const job = { path: '/api/fail', intervalSeconds: 5 };
    const runner = createCronRunner({
      secret: 's',
      jobs: [job],
      onError: handler
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(handler).toHaveBeenCalledWith(job, error);
    runner.stop();
  });

  it('should not call onError when fetch succeeds', async () => {
    const handler = vi.fn();
    const runner = createCronRunner({
      secret: 's',
      jobs: [{ path: '/api/ok', intervalSeconds: 5 }],
      onError: handler
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(handler).not.toHaveBeenCalled();
    runner.stop();
  });

  it('should call onError once with a status-bearing Error on a 500 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: 'Internal Server Error' })
    );

    const handler = vi.fn();
    const job = { path: '/api/fail', intervalSeconds: 5 };
    const runner = createCronRunner({
      secret: 's',
      jobs: [job],
      onError: handler
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(handler).toHaveBeenCalledTimes(1);
    const [passedJob, err] = handler.mock.calls[0] as [unknown, Error & { status?: number }];
    expect(passedJob).toBe(job);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(500);
    runner.stop();
  });

  it('should call onError with a status-bearing Error on a 403 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 403, statusText: 'Forbidden' })
    );

    const handler = vi.fn();
    const job = { path: '/api/forbidden', intervalSeconds: 5 };
    const runner = createCronRunner({
      secret: 's',
      jobs: [job],
      onError: handler
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(handler).toHaveBeenCalledTimes(1);
    const err = handler.mock.calls[0]?.[1] as Error & { status?: number };
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    runner.stop();
  });

  it('should stop all timers and not fire after stop()', async () => {
    const runner = createCronRunner({
      secret: 's',
      jobs: [{ path: '/api/test', intervalSeconds: 5 }],
      onError
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetch).toHaveBeenCalledTimes(1);

    runner.stop();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  describe('onError is required', () => {
    // The `@ts-expect-error` is half the test: the type rejects the call, and
    // the throw is what the JS consumer the type system never reaches gets.
    const withoutHandler = { secret: 's', jobs: [{ path: '/api/test', intervalSeconds: 5 }] };

    it('throws a TypeError naming onError when it is missing', () => {
      // @ts-expect-error — onError is required.
      expect(() => createCronRunner(withoutHandler)).toThrow(/onError is required/);
    });

    it('throws for a non-function onError', () => {
      const config = {
        secret: 's',
        jobs: [{ path: '/api/test', intervalSeconds: 5 }],
        onError: 'log it'
      } as unknown as CronRunnerConfig;

      expect(() => createCronRunner(config)).toThrow(TypeError);
      expect(() => createCronRunner(config)).toThrow(/received string/);
    });

    it('arms no timer when the check throws', async () => {
      // @ts-expect-error — as above.
      expect(() => createCronRunner(withoutHandler)).toThrow();

      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('a throwing onError', () => {
    it('keeps the schedule running and reports both errors on a non-2xx', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500, statusText: 'Boom' }));
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handlerError = new Error('handler boom');
      const handler = vi.fn(() => {
        throw handlerError;
      });
      const runner = createCronRunner({
        secret: 's',
        jobs: [{ path: '/api/fail', intervalSeconds: 5 }],
        onError: handler
      });

      runner.start();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
      const [message, thrown, jobError] = error.mock.calls[0] as [string, unknown, Error];
      expect(message).toContain('/api/fail');
      expect(thrown).toBe(handlerError);
      expect((jobError as Error & { status?: number }).status).toBe(500);

      // The tick that follows must still fire: a broken handler is a consumer
      // bug, not the end of the schedule.
      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledTimes(2);
      runner.stop();
    });

    it('keeps the schedule running when fetch rejects', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler = vi.fn(() => {
        throw new Error('handler boom');
      });
      const runner = createCronRunner({
        secret: 's',
        jobs: [{ path: '/api/fail', intervalSeconds: 5 }],
        onError: handler
      });

      runner.start();
      await vi.advanceTimersByTimeAsync(15_000);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(error).toHaveBeenCalledTimes(3);
      runner.stop();
    });

    it('reports an async handler that rejects, and keeps ticking', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500, statusText: 'Boom' }));
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      const rejection = new Error('webhook refused the report');
      // The natural shape for a handler that reaches a webhook or a database:
      // it fails after an await, so a synchronous try/catch around the call
      // sees nothing and the rejection ends the process instead.
      const handler = vi.fn(async () => {
        await Promise.resolve();
        throw rejection;
      });
      const runner = createCronRunner({
        secret: 's',
        jobs: [{ path: '/api/fail', intervalSeconds: 5 }],
        onError: handler
      });

      runner.start();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0]?.[1]).toBe(rejection);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledTimes(2);
      runner.stop();
    });
  });

  describe('the double-start warning', () => {
    const spyOnWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
    let warn: ReturnType<typeof spyOnWarn>;

    beforeEach(() => {
      warn = spyOnWarn();
      // The warning is `import.meta.env?.DEV`-gated; without DEV every
      // assertion below would hold for the wrong reason.
      expect(import.meta.env.DEV).toBe(true);
    });

    const runnerOn = (path: string, intervalSeconds = 60) =>
      createCronRunner({ secret: 's', jobs: [{ path, intervalSeconds }], onError });

    it('warns once when a second runner arms a path this process already ticks', () => {
      const first = runnerOn('/api/cron/night');
      const second = runnerOn('/api/cron/night', 30);

      first.start();
      expect(warn).not.toHaveBeenCalled();

      second.start();
      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0]?.[0] as string;
      expect(message).toContain('/api/cron/night');
      expect(message).toContain('import.meta.hot');
      expect(message).toContain('A hot reload under `vite dev` is the usual cause');

      first.stop();
      second.stop();
    });

    it('does not warn for a repeated start() on one runner', () => {
      const runner = runnerOn('/api/cron/night');
      runner.start();
      runner.start();
      expect(warn).not.toHaveBeenCalled();
      runner.stop();
    });

    it('does not warn for different paths', () => {
      const a = runnerOn('/api/cron/a');
      const b = runnerOn('/api/cron/b');
      a.start();
      b.start();
      expect(warn).not.toHaveBeenCalled();
      a.stop();
      b.stop();
    });

    it('names the duplicate entry, not a second runner, for one path listed twice', () => {
      createCronRunner({
        secret: 's',
        jobs: [
          { path: '/api/cron/night', intervalSeconds: 60 },
          { path: '/api/cron/night', intervalSeconds: 30 }
        ],
        onError
      }).start();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0] as string).toContain('twice from one jobs list');
      // One runner, one claim: the count is what a second runner is compared
      // against, and a duplicate that inflated it would make the next warning
      // say "2 other runners are" about a process that has one.
      expect(registry().get('/api/cron/night')).toBe(1);

      runnerOn('/api/cron/night').start();
      expect(warn.mock.calls[1]?.[0] as string).toContain('another runner is');
    });

    it('releases what start() claimed, not what config.jobs says at stop() time', () => {
      const jobs = [{ path: '/api/cron/night', intervalSeconds: 60 }];
      const runner = createCronRunner({ secret: 's', jobs, onError });
      runner.start();

      // The consumer owns this array and may rebuild it between the two calls.
      jobs.length = 0;
      runner.stop();

      expect(registry().size).toBe(0);
      runnerOn('/api/cron/night').start();
      expect(warn).not.toHaveBeenCalled();
    });

    it('stops warning once the first runner has been stopped', () => {
      const first = runnerOn('/api/cron/night');
      first.start();
      first.stop();

      runnerOn('/api/cron/night').start();
      expect(warn).not.toHaveBeenCalled();
    });

    it('keeps warning while any other runner still ticks the path', () => {
      const first = runnerOn('/api/cron/night');
      const second = runnerOn('/api/cron/night');
      first.start();
      second.start();
      expect(warn).toHaveBeenCalledTimes(1);

      // One of the two is gone; the other still ticks the path, so a third
      // start is still a double start — a boolean flag would have forgotten.
      first.stop();
      runnerOn('/api/cron/night').start();
      expect(warn).toHaveBeenCalledTimes(2);

      second.stop();
    });

    it('warns across a module re-evaluation — the HMR case', async () => {
      runnerOn('/api/cron/night').start();
      // The warning below has to come from the reloaded module's start(), not
      // from a path some earlier test left in a registry this file cannot
      // clear: with a module-scoped registry that leaks, the count would reach
      // 1 here and the assertion at the end would pass for the wrong reason.
      expect(warn).not.toHaveBeenCalled();

      vi.resetModules();
      const reloaded = await import('./cron');
      // Control: without a genuinely fresh module instance this test would
      // hold for a module-scoped registry too, which is the thing it denies.
      expect(reloaded.createCronRunner).not.toBe(createCronRunner);

      reloaded
        .createCronRunner({
          secret: 's',
          jobs: [{ path: '/api/cron/night', intervalSeconds: 60 }],
          onError
        })
        .start();

      expect(warn).toHaveBeenCalledTimes(1);
    });
  });
});
