export interface CronJob {
  path: string;
  intervalSeconds: number;
  method?: 'GET' | 'POST';
}

export interface CronRunnerConfig {
  secret: string;
  secretHeader?: string;
  baseUrl?: string;
  jobs: CronJob[];
  onError?: (job: CronJob, error: Error) => void;
}

export interface CronRunner {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export function createCronRunner(config: CronRunnerConfig): CronRunner {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  return {
    start() {
      if (running) return;
      running = true;

      for (const job of config.jobs) {
        const timer = setInterval(async () => {
          try {
            const base = config.baseUrl ?? 'http://localhost:3000';
            await fetch(`${base}${job.path}`, {
              method: job.method ?? 'POST',
              headers: { [config.secretHeader ?? 'x-cron-secret']: config.secret }
            });
          } catch (err) {
            config.onError?.(job, err as Error);
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
