/**
 * Test double for the `$app/state` / `$app/navigation` / `$app/environment`
 * trio, wired up via `test.alias` in vitest.config.ts. Models the one
 * property that makes URL ownership racy in real SvelteKit: `goto` applies
 * **asynchronously** (a microtask by default; `setNavigationLatency` stretches
 * it into a timer, standing in for a navigation's load phase), while reads of
 * `page.url` are reactive. Keeps a history stack so the back button is
 * testable.
 */

class MockPageUrl {
  #url = $state(new URL('http://localhost/'));

  get url(): URL {
    return this.#url;
  }

  _set(url: URL): void {
    this.#url = url;
  }
}

export const page = new MockPageUrl();

let history: string[] = ['http://localhost/'];
let latencyMs = 0;

export const navigationLog = {
  gotoCount: 0,
  pushCount: 0
};

import { __setBuilding } from './app-environment';

export function setNavigationLatency(ms: number): void {
  latencyMs = ms;
}

export function resetMockApp(initial = ''): void {
  const href = `http://localhost/${initial}`;
  history = [href];
  latencyMs = 0;
  navigationLog.gotoCount = 0;
  navigationLog.pushCount = 0;
  __setBuilding(false);
  page._set(new URL(href));
}

export function goto(path: string, opts: { replaceState?: boolean } = {}): Promise<void> {
  navigationLog.gotoCount += 1;
  const href = new URL(path, page.url).href;
  const replaceState = opts.replaceState ?? false;
  const apply = () => {
    if (replaceState) {
      history[history.length - 1] = href;
    } else {
      history.push(href);
      navigationLog.pushCount += 1;
    }
    page._set(new URL(href));
  };
  if (latencyMs > 0) {
    setTimeout(apply, latencyMs);
  } else {
    queueMicrotask(apply);
  }
  return Promise.resolve();
}

/** The back button — synchronous, like a popstate delivering a new URL. */
export function back(): void {
  if (history.length > 1) {
    history.pop();
    page._set(new URL(history[history.length - 1]));
  }
}
