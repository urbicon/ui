/** One scheduled job: an endpoint to hit and how often. */
export interface CronJob {
  /** Path (appended to {@link CronRunnerConfig.baseUrl}) to fetch on each tick. */
  path: string;
  /**
   * Interval between fires, in seconds. The first fire happens *after* one
   * interval — there is no leading call at `start()`.
   */
  intervalSeconds: number;
  /**
   * HTTP method for the request.
   * @default 'POST'
   */
  method?: 'GET' | 'POST';
}

/** Configuration for {@link createCronRunner}. */
export interface CronRunnerConfig {
  /**
   * Shared secret sent on every request in the {@link secretHeader} header, so
   * the target endpoint can distinguish a scheduled call from a public one.
   * Keep it in a private env var; the endpoint compares against the same value.
   */
  secret: string;
  /**
   * Header name carrying the {@link secret}.
   * @default 'x-cron-secret'
   */
  secretHeader?: string;
  /**
   * Origin the job paths are resolved against (e.g. `https://app.example.com`).
   * @default 'http://localhost:3000'
   */
  baseUrl?: string;
  /** Jobs to schedule; each runs on its own independent interval. */
  jobs: CronJob[];
  /**
   * Called when a job fails, with the failing {@link CronJob} and an `Error`.
   * Fires in two cases:
   * - the job's `fetch` **rejects** (network error, DNS failure, abort) — the
   *   `Error` is whatever `fetch` threw.
   * - the endpoint answers with a **non-2xx** status — the runner synthesises
   *   an `Error` naming the job and status, with the numeric code attached as
   *   `error.status` (e.g. `500`, `403`).
   *
   * Without a handler both failure modes are swallowed silently — pass one to
   * observe per-run outcomes.
   */
  onError?: (job: CronJob, error: Error) => void;
}

/** Handle returned by {@link createCronRunner}. */
export interface CronRunner {
  /**
   * Arm every job's interval timer. Idempotent — calling `start()` while
   * already running is a no-op (does not double-schedule).
   */
  start(): void;
  /**
   * Clear every timer so nothing fires again, and flip {@link isRunning} to
   * `false`. Call this on shutdown / HMR teardown to avoid leaked intervals.
   */
  stop(): void;
  /** Whether the runner is currently armed (between `start()` and `stop()`). */
  isRunning(): boolean;
}

/**
 * Create a background runner that fires HTTP requests at SvelteKit server
 * endpoints on a fixed interval — a minimal in-process cron for scheduled work
 * (digests, cleanup, cache warming).
 *
 * Deliberately simple: one `setInterval` per job, no drift compensation, no
 * distributed locking, no retry/backoff. Fits a **single-process** deployment;
 * for scale-out point a real scheduler (BullMQ, a platform cron) at the same
 * endpoints instead. The runner starts idle — call `start()` explicitly.
 *
 * @param config - Secret/header, base URL, and the jobs to schedule.
 * @returns A {@link CronRunner} handle (`start` / `stop` / `isRunning`).
 * @example
 * ```typescript
 * // src/lib/server/cron.ts
 * import { createCronRunner } from '@urbicon-ui/sveltekit-utils/cron';
 * import { env } from '$env/dynamic/private';
 *
 * export const cron = createCronRunner({
 *   secret: env.CRON_SECRET,
 *   baseUrl: env.BASE_URL,
 *   jobs: [
 *     { path: '/api/cron/send-digest', intervalSeconds: 3600 },
 *     { path: '/api/cron/cleanup', intervalSeconds: 900 }
 *   ],
 *   onError: (job, err) => console.error(`Cron ${job.path} failed`, err)
 * });
 *
 * cron.start();
 * ```
 */
export function createCronRunner(config: CronRunnerConfig): CronRunner {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  return {
    start() {
      if (running) return;
      running = true;

      for (const job of config.jobs) {
        const timer = setInterval(async () => {
          const base = config.baseUrl ?? 'http://localhost:3000';
          let response: Response;
          try {
            response = await fetch(`${base}${job.path}`, {
              method: job.method ?? 'POST',
              headers: { [config.secretHeader ?? 'x-cron-secret']: config.secret }
            });
          } catch (err) {
            // Network-level failure (DNS, connection refused, abort): fetch rejected.
            config.onError?.(job, err as Error);
            return;
          }
          // The request completed; a non-2xx status is still a failure. Handle it
          // outside the try so a throwing `onError` escapes as an unhandled
          // rejection rather than being re-caught and re-invoked here — symmetric
          // with the rejection path above.
          if (!response.ok) {
            const err = new Error(
              `Cron job "${job.path}" returned ${response.status} ${response.statusText}`
            ) as Error & { status: number };
            err.status = response.status;
            config.onError?.(job, err);
          }
        }, job.intervalSeconds * 1000);
        timers.push(timer);
      }
    },

    stop() {
      running = false;
      timers.forEach(clearInterval);
      timers.length = 0;
    },

    isRunning() {
      return running;
    }
  };
}
