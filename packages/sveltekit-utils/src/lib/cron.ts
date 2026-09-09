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
   * Required: it is the runner's only outward channel, and nothing else
   * observes a job that has been answering 403 for weeks. A handler that
   * throws is reported on `console.error` and does not stop the schedule.
   */
  onError: (job: CronJob, error: Error) => void;
}

/** Handle returned by {@link createCronRunner}. */
export interface CronRunner {
  /**
   * Arm every job's interval timer. Idempotent — calling `start()` while
   * already running is a no-op (does not double-schedule).
   *
   * In development a job path that another runner in this process already
   * ticks is reported on `console.warn` (see {@link createCronRunner}).
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

// Which job paths this process currently ticks, and how many runners tick each.
// The registry hangs off `globalThis` under a `Symbol.for` key rather than
// living in this module's scope: under `vite dev` a server module is
// re-evaluated on a hot reload, and the fresh evaluation gets a fresh
// module scope while the previous evaluation's timers keep firing — the very
// situation the warning below exists for. A registry the reload resets sees
// nothing to warn about; `globalThis` and a cross-realm-stable key survive it.
const CRON_REGISTRY: unique symbol = Symbol.for('urbicon-ui.sveltekit-utils.cron');

type RegistryHost = typeof globalThis & { [CRON_REGISTRY]?: Map<string, number> };

function armedPaths(): Map<string, number> {
  const host = globalThis as RegistryHost;
  const known = host[CRON_REGISTRY];
  if (known) return known;
  const paths = new Map<string, number>();
  host[CRON_REGISTRY] = paths;
  return paths;
}

/** Register one armed path; returns how many runners already ticked it. */
function claimPath(path: string): number {
  const paths = armedPaths();
  const armed = paths.get(path) ?? 0;
  paths.set(path, armed + 1);
  return armed;
}

function releasePath(path: string): void {
  const paths = armedPaths();
  const armed = (paths.get(path) ?? 1) - 1;
  if (armed > 0) paths.set(path, armed);
  else paths.delete(path);
}

function warnDoubleStart(path: string, armed: number): void {
  const others = armed === 1 ? 'another runner is' : `${armed} other runners are`;
  console.warn(
    `[createCronRunner] start() armed "${path}" while ${others} already ticking it in this process — every one of them fires, and the endpoint sees the traffic of all. Call stop() on the runner you replaced; under \`vite dev\` put \`import.meta.hot?.dispose(() => runner.stop())\` next to the start() call so a hot reload clears the old timers. Two runners on one path on purpose (different intervals, say) look exactly the same from here. If this appeared right after you edited a file under \`vite dev\`, a hot reload made the second call and your wiring is fine; it is only actionable when you see it without having edited anything. Development only.`
  );
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
 * Import from `@urbicon-ui/sveltekit-utils/cron`, not from the package root:
 * the root barrel carries `url.svelte`, whose `$app/*` imports have no business
 * in `hooks.server.ts`.
 *
 * @param config - Secret/header, base URL, the jobs to schedule, and the
 *   required `onError` handler.
 * @returns A {@link CronRunner} handle (`start` / `stop` / `isRunning`).
 * @throws TypeError if `onError` is not a function.
 * @example
 * ```typescript
 * // src/lib/server/cron.ts
 * import { createCronRunner } from '@urbicon-ui/sveltekit-utils/cron';
 * import { env } from '$env/dynamic/private';
 *
 * // runtime env: `secret` is a `string`, so a missing one fails at startup
 * const secret = env.CRON_SECRET;
 * if (!secret) throw new Error('CRON_SECRET is not set');
 *
 * export const cron = createCronRunner({
 *   secret,
 *   baseUrl: env.BASE_URL,
 *   jobs: [
 *     { path: '/api/cron/send-digest', intervalSeconds: 3600 },
 *     { path: '/api/cron/cleanup', intervalSeconds: 900 }
 *   ],
 *   onError: (job, err) => console.error(`Cron ${job.path} failed`, err)
 * });
 *
 * cron.start();
 * import.meta.hot?.dispose(() => cron.stop());
 * ```
 */
export function createCronRunner(config: CronRunnerConfig): CronRunner {
  if (typeof config.onError !== 'function') {
    throw new TypeError(
      `[createCronRunner] onError is required and must be a function (received ${typeof config.onError}). It is the only channel a failing job has: without it a 403 or a 500 on every tick is indistinguishable from a job that works. Pass \`onError: (job, err) => console.error(job.path, err)\` if the server log is where you read it.`
    );
  }

  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  // The handler is the consumer's error channel, so when it throws there is no
  // second one to report on — and letting the throw escape this async interval
  // callback ends the process: an unhandled rejection exits node (25.2.1) and
  // bun (1.4.2) with code 1, so one broken log call would take the app down and
  // stop every other job with it. `console.error` is the sink a zero-dependency
  // package can assume; both errors go out, the schedule keeps running.
  const report = (job: CronJob, error: Error): void => {
    try {
      config.onError(job, error);
    } catch (handlerError) {
      console.error(
        `[createCronRunner] the onError handler threw while reporting a failure of "${job.path}"; the schedule keeps running. Handler error, then the job error:`,
        handlerError,
        error
      );
    }
  };

  return {
    start() {
      if (running) return;
      running = true;

      for (const job of config.jobs) {
        if (import.meta.env?.DEV) {
          const armed = claimPath(job.path);
          if (armed > 0) warnDoubleStart(job.path, armed);
        }
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
            report(job, err as Error);
            return;
          }
          // The request completed; a non-2xx status is still a failure.
          if (!response.ok) {
            const err = new Error(
              `Cron job "${job.path}" returned ${response.status} ${response.statusText}`
            ) as Error & { status: number };
            err.status = response.status;
            report(job, err);
          }
        }, job.intervalSeconds * 1000);
        timers.push(timer);
      }
    },

    stop() {
      if (running && import.meta.env?.DEV) {
        for (const job of config.jobs) releasePath(job.path);
      }
      running = false;
      timers.forEach(clearInterval);
      timers.length = 0;
    },

    isRunning() {
      return running;
    }
  };
}
