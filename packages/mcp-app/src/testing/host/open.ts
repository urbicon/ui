/**
 * Opening the test host: two servers, the browser, the host page — until the
 * view stands and the handshake is through.
 *
 * Claude cannot be scripted, so this host does itself what a **web host**
 * does after `specification/2026-01-26/apps.mdx`: the spec is the model for
 * the sequence, **the SDK for the wire** — every message in both directions
 * passes `wireProblem`, bundled for the page, because that is how Claude
 * checks. What it does not prove is how a real host behaves: it is ours, after
 * our reading of the spec.
 *
 * - The app's server is the app's: the host takes a **running** endpoint and
 *   starts none. Its headers (a token) stay in this process, as in a real
 *   host's backend; the page asks through `/rpc`, and **only the page**: `/rpc`
 *   takes requests with the host page's `Origin` alone. Otherwise any page in
 *   the same browser could pass a `text/plain` POST (no preflight) with the
 *   token on to the server, every tool included.
 * - The HTML goes into a **sandbox proxy on another origin**: host page on
 *   `localhost`, proxy on `127.0.0.1` ("The Host and the Sandbox MUST have
 *   different origins"), both `sandbox="allow-scripts allow-same-origin"`.
 * - The **CSP as a header** of the proxy, built after the spec from
 *   `_meta.ui.csp` (`buildCsp`), with `report-uri`; the inner iframe inherits it.
 */
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Browser,
  type ConsoleMessage,
  chromium,
  type Frame,
  type Page
} from 'playwright-core';
import { buildCsp, type HostCsp } from './csp.ts';
import { type HostPageConfig, hostPage, sandboxPage } from './pages.ts';

/**
 * The spec version this host speaks — in its handshake and in its check of
 * the view's. Written out rather than taken from the bridge: the handshake
 * check compares the two.
 */
export const SPEC_VERSION = '2026-01-26';

/** The sentence `failNext` fails a call with when it is given none. */
export const FAIL_NEXT_MESSAGE = 'The test host dropped this call on purpose.';

/** Where the app's MCP server answers — the host forwards to it and starts nothing. */
export interface Endpoint {
  /** The full URL of the JSON-RPC endpoint, e.g. `http://127.0.0.1:5173/mcp`. */
  url: string;
  /** Sent with every request — a bearer token, for instance. Never reaches the page. */
  headers?: Record<string, string>;
}

export interface JsonRpcAnswer {
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** One JSON-RPC request to the app's server, the answer as it came — errors included. */
export async function mcpRequest(
  endpoint: Endpoint,
  method: string,
  params?: unknown
): Promise<JsonRpcAnswer> {
  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: {
      ...endpoint.headers,
      // Both, as the MCP transport asks of a client; the host reads JSON only,
      // and an event stream in answer fails loudly at `response.json()`.
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      ...(params === undefined ? {} : { params })
    })
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status} from ${endpoint.url}`);
  return (await response.json()) as JsonRpcAnswer;
}

/** {@link mcpRequest}, its `result` — and a throw on an error answer. */
export async function mcpResult(
  endpoint: Endpoint,
  method: string,
  params?: unknown
): Promise<unknown> {
  const answer = await mcpRequest(endpoint, method, params);
  if (answer.error) throw new Error(`${method}: ${answer.error.code} ${answer.error.message}`);
  return answer.result;
}

/** `serverInfo` of the server's `initialize` — what a view's `appInfo` is often measured against. */
export async function serverInfo(endpoint: Endpoint): Promise<unknown> {
  const result = (await mcpResult(endpoint, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'mcp-app-test-host', version: '1.0.0' }
  })) as { serverInfo?: unknown };
  return result.serverInfo;
}

/**
 * `hostContext.styles` of the test host — the spec's names ("Theming"), with
 * values in `light-dark()`, as a chat host might send them.
 *
 * **Among them the collision names**: `--font-sans`, `--font-mono`,
 * `--font-weight-*` and `--shadow-sm` are also names of Tailwind's default
 * theme, and `--color-text-*` is a name a view's own theme may define
 * (`@urbicon-ui/blocks` does). A view that applied them under their own name
 * would repaint itself with the host's values; `checkHostVariables` measures
 * that it does not.
 */
export const HOST_STYLES: { variables: Record<string, string> } = {
  variables: {
    '--color-background-primary': 'light-dark(#ffffff, #262624)',
    '--color-background-secondary': 'light-dark(#f5f4ef, #1f1e1d)',
    '--color-background-tertiary': 'light-dark(#ecebe4, #30302e)',
    '--color-text-primary': 'light-dark(#141413, #faf9f5)',
    '--color-text-secondary': 'light-dark(#3d3d3a, #c2c0b6)',
    '--color-text-tertiary': 'light-dark(#73726c, #9c9a92)',
    '--color-text-disabled': 'light-dark(#b0aea5, #5e5d59)',
    '--color-border-primary': 'light-dark(rgb(31 30 29 / 0.4), rgb(222 220 209 / 0.4))',
    '--color-border-secondary': 'light-dark(rgb(31 30 29 / 0.25), rgb(222 220 209 / 0.25))',
    '--color-border-tertiary': 'light-dark(rgb(31 30 29 / 0.15), rgb(222 220 209 / 0.15))',
    '--color-ring-primary': 'light-dark(#2c84db, #5aa6f2)',
    '--font-sans': '"MCP App Test Host Sans", ui-sans-serif, system-ui, sans-serif',
    '--font-mono': 'ui-monospace, Menlo, monospace',
    '--font-weight-normal': '400',
    '--font-weight-medium': '500',
    '--font-weight-semibold': '600',
    '--font-weight-bold': '700',
    '--font-text-sm-size': '14px',
    '--border-radius-md': '8px',
    '--shadow-hairline': '0 0 0 1px rgb(0 0 0 / 0.08)',
    '--shadow-sm': '0 1px 2px rgb(0 0 0 / 0.06)'
  }
};

/**
 * Takes out of a log what a probe produced — recognised by its signature —
 * and returns it; everything else stays. Not "everything from here on": a
 * real console line, CSP report or page error in the same moment would drop
 * out of the findings with it.
 */
export function takeLines<T>(log: T[], ...signatures: string[]): T[] {
  const taken: T[] = [];
  const kept = log.filter((entry) => {
    const text = typeof entry === 'string' ? entry : JSON.stringify(entry);
    const probe = signatures.some((signature) => text.includes(signature));
    if (probe) taken.push(entry);
    return !probe;
  });
  log.splice(0, log.length, ...kept);
  return taken;
}

/** One check of a run. `id` is stable — for a control that expects exactly these to fail. */
export interface HostCheck {
  id: string;
  ok: boolean;
  name: string;
  detail: string;
}

/** What the host page knows, read from `window.__host.state`. */
export interface HostState {
  phase: 'start' | 'loading' | 'failed';
  tool: { name: string; _meta?: Record<string, unknown> } | null;
  uri: string | null;
  mimeType: string | null;
  csp: HostCsp | null;
  initialized: boolean;
  resultReady: boolean;
  resultSent: boolean;
  initParams: { appInfo?: unknown; protocolVersion?: unknown; appCapabilities?: unknown } | null;
  sizes: { width: number; height: number }[];
  /** The view's `notifications/message`, as sent (each passed the wire check). */
  logs: { level: string; logger?: string; data: unknown }[];
  /** Every request of the view the host answered itself (not one the wire check refused). */
  viewRequests: { method: string; params: Record<string, unknown> | undefined }[];
  unknown: string[];
  errors: string[];
  tornDown: boolean;
  /** The failures `failNext` ordered that no call has met yet, each with its sentence. */
  failNext: { name: string; message: string }[];
  /** Every `tools/call` of the view the host refused, with the request's id. */
  refused: { id: string | number; name: string }[];
  wire: { checked: number; problems: string[] };
}

interface HostApi {
  state: HostState;
  wireControl(): { code: number; message: string } | null;
  releaseResult(): void;
  setTheme(theme: 'light' | 'dark'): void;
  failNext(name: string, message: string): void;
  replay(): Promise<void>;
  teardown(reason: string): Promise<unknown>;
}

type HostWindow = { __host?: HostApi };

export interface OpenHostOptions {
  endpoint: Endpoint;
  /** The tool with the view; the host calls it as the model would. */
  tool: string;
  args: Record<string, unknown>;
  /** How wide the host shows the view: ~700 like a chat on a desk, 390 like a phone. Default 700. */
  width?: number;
  /** Default `auto` (the result behind the latch); `scripted` for a redraw from history. */
  flow?: 'auto' | 'scripted';
  /**
   * Merged over the host's context: `theme: 'light'`, `displayMode: 'inline'`,
   * `containerDimensions`, `locale: 'en-US'`, `timeZone: 'UTC'`,
   * `platform: 'web'`, `styles: HOST_STYLES`.
   */
  hostContext?: Record<string, unknown>;
  /** In place of `resources/read`: an HTML with its CSP. */
  override?: { html: string; csp: HostCsp | null };
  /** Responses whose status and CORS header the run records (`OpenHost.responses`) — fonts, say. */
  watchResponses?(url: string): boolean;
  /** What the handshake must carry — compared by value. */
  expect: { appInfo: unknown; appCapabilities: unknown };
}

/** What an open host gives a run: page, view, recordings, the list of checks. */
export interface OpenHost {
  browser: Browser;
  page: Page;
  view: Frame;
  endpoint: Endpoint;
  width: number;
  state(): Promise<HostState>;
  check(id: string, name: string, ok: boolean, detail?: string): void;
  checks: HostCheck[];
  consoleLines: string[];
  pageErrors: string[];
  cspReports: unknown[];
  /** Every response `watchResponses` picked — with status and `Access-Control-Allow-Origin`. */
  responses: { url: string; status: number; cors: string | null }[];
  /** What `/rpc` forwarded to the app, and what it refused. */
  rpcLog: { forwarded: number; refused: number };
  origins: { host: string; sandbox: string };
  /** When the host page was loaded (`performance.now()`). */
  started: number;
  /** Lines a scenario wants printed with the report — a timing, say. */
  notes: string[];
  host: {
    /** Lets the latched `tool-result` go (`flow: 'auto'`). */
    releaseResult(): Promise<void>;
    setTheme(theme: 'light' | 'dark'): Promise<void>;
    /**
     * The next `tools/call` of this tool from the view fails with `-32000` and
     * `message` — {@link FAIL_NEXT_MESSAGE} without one.
     */
    failNext(name: string, message?: string): Promise<void>;
    /** `tool-input` and `tool-result` in the same tick (`flow: 'scripted'`). */
    replay(): Promise<void>;
    teardown(reason: string): Promise<unknown>;
    wireControl(): Promise<{ code: number; message: string } | null>;
  };
  close(): Promise<void>;
}

const DEFAULT_WIDTH = 700;

let wireBundle: Promise<string> | null = null;

/**
 * `wireProblem` for the host page (`/wire.js`), bundled once per process. The
 * host's own extension says which tree it runs from — `.ts` in the sources,
 * `.js` in `dist/` — and the wire module sits beside it in both.
 */
function wireJs(): Promise<string> {
  const entry = fileURLToPath(
    new URL(`../wire${extname(fileURLToPath(import.meta.url))}`, import.meta.url)
  );
  wireBundle ??= Bun.build({
    entrypoints: [entry],
    target: 'browser',
    format: 'esm',
    minify: true
  }).then((out) => {
    const [only] = out.outputs;
    if (!out.success || out.outputs.length !== 1 || !only) {
      throw new Error(`/wire.js did not bundle: ${out.logs.join('\n')}`);
    }
    return only.text();
  });
  return wireBundle;
}

/**
 * Opens the host and waits until the view stands: `auto` until the result is
 * there (still latched), `scripted` until the handshake. The run belongs to
 * the caller from then on; `close()` cleans up, and `openHost` itself closes
 * everything when it throws.
 */
export async function openHost(options: OpenHostOptions): Promise<OpenHost> {
  const width = options.width ?? DEFAULT_WIDTH;
  const flow = options.flow ?? 'auto';
  const hostContext = {
    theme: 'light' as 'light' | 'dark',
    displayMode: 'inline',
    availableDisplayModes: ['inline'],
    containerDimensions: { width, maxHeight: 2000 },
    locale: 'en-US',
    timeZone: 'UTC',
    platform: 'web',
    styles: HOST_STYLES,
    ...options.hostContext
  };
  const cspReports: unknown[] = [];
  const rpcLog = { forwarded: 0, refused: 0 };
  // Two ports, two origins — and each server must know the other's address.
  const origins = { host: '', sandbox: '' };

  const sandbox = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === '/csp-report' && request.method === 'POST') {
        cspReports.push(await request.json().catch(() => ({ unreadable: true })));
        return new Response(null, { status: 204 });
      }
      if (url.pathname !== '/sandbox.html')
        return new Response('only /sandbox.html', { status: 404 });
      const raw = url.searchParams.get('csp');
      const csp = raw ? (JSON.parse(raw) as HostCsp | null) : null;
      return new Response(sandboxPage(origins.host), {
        headers: {
          'content-type': 'text/html;charset=utf-8',
          'content-security-policy': buildCsp(csp, `${origins.sandbox}/csp-report`),
          'cache-control': 'no-store'
        }
      });
    }
  });
  origins.sandbox = `http://127.0.0.1:${sandbox.port}`;

  const config: HostPageConfig = {
    sandboxOrigin: origins.sandbox,
    specVersion: SPEC_VERSION,
    tool: options.tool,
    args: options.args,
    width,
    hostContext,
    ...(options.override ? { override: options.override } : {}),
    flow
  };
  const server = Bun.serve({
    hostname: 'localhost',
    port: 0,
    async fetch(request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === '/rpc' && request.method === 'POST') {
        // The backend half of the host: the headers never leave this process,
        // and only the host page itself may use them (head of this file).
        if (request.headers.get('origin') !== origins.host) {
          rpcLog.refused++;
          return new Response('only the host page', { status: 403 });
        }
        rpcLog.forwarded++;
        const response = await fetch(options.endpoint.url, {
          method: 'POST',
          headers: {
            ...options.endpoint.headers,
            accept: 'application/json, text/event-stream',
            'content-type': 'application/json'
          },
          body: await request.text()
        });
        return new Response(await response.text(), {
          status: response.status,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (url.pathname === '/wire.js') {
        return new Response(await wireJs(), {
          headers: { 'content-type': 'text/javascript;charset=utf-8' }
        });
      }
      if (url.pathname !== '/') return new Response('not here', { status: 404 });
      return new Response(hostPage(config), {
        headers: { 'content-type': 'text/html;charset=utf-8' }
      });
    }
  });
  origins.host = `http://localhost:${server.port}`;

  const checks: HostCheck[] = [];
  const check = (id: string, name: string, ok: boolean, detail = ''): void => {
    checks.push({ id, ok, name, detail });
  };
  const consoleLines: string[] = [];
  const pageErrors: string[] = [];
  const responses: OpenHost['responses'] = [];

  let browser: Browser | undefined;
  const close = async (): Promise<void> => {
    await browser?.close();
    server.stop(true);
    sandbox.stop(true);
  };
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: width + 48, height: 900 } });
    // Reduced motion: a view that gates its motion on the query keeps still
    // while it is measured. It stops no transition by itself — the common
    // reset `transition-duration: 0.01ms` still starts one, and a view need
    // not ask at all — so the checks read colours settled (`readSettled`).
    // `emulateMedia`, not the context option — only that reaches the page and
    // its frames.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    page.on('console', (message: ConsoleMessage) => {
      // With the address when the sentence does not name it: "Failed to load
      // resource" says not which — the probes recognise their lines by it.
      const where = message.location().url;
      const text = message.text();
      consoleLines.push(
        `[${message.type()}] ${text}${where && !text.includes(where) ? ` (${where})` : ''}`
      );
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (options.watchResponses?.(response.url())) {
        responses.push({
          url: response.url(),
          status: response.status(),
          cors: response.headers()['access-control-allow-origin'] ?? null
        });
      }
    });

    const started = performance.now();
    await page.goto(`${origins.host}/`);
    // Each call reads `window.__host` in the page: `page.evaluate` sends the
    // function's source, so it can close over nothing of this module.
    const state = () =>
      page.evaluate(() => (window as unknown as Required<HostWindow>).__host.state);

    await page
      .waitForFunction(
        (mode) => {
          const s = (window as unknown as HostWindow).__host?.state;
          if (!s) return false;
          if (s.phase === 'failed') return true;
          return mode === 'auto' ? s.resultReady : s.initialized;
        },
        flow,
        { timeout: 15_000 }
      )
      .catch(() => {});
    const s = await state();
    // The page reads the flat `ui/resourceUri` too, as a host does; the check
    // asks for the key the spec names.
    const ui = s.tool?._meta?.ui as { resourceUri?: unknown } | undefined;
    check(
      'tool-listed',
      'tools/list names the tool with _meta.ui.resourceUri',
      typeof ui?.resourceUri === 'string',
      JSON.stringify({ _meta: s.tool?._meta ?? null, errors: s.errors })
    );
    if (!options.override) {
      check(
        'mime-type',
        'resources/read: mimeType text/html;profile=mcp-app',
        s.mimeType === 'text/html;profile=mcp-app',
        String(s.mimeType)
      );
    }
    const init = s.initParams;
    check(
      'handshake',
      'handshake: ui/initialize with the expected appInfo, protocolVersion and appCapabilities',
      Bun.deepEquals(init?.appInfo, options.expect.appInfo) &&
        init?.protocolVersion === SPEC_VERSION &&
        Bun.deepEquals(init?.appCapabilities, options.expect.appCapabilities),
      JSON.stringify({ initParams: init, expect: options.expect })
    );
    check('initialized', 'ui/notifications/initialized arrived', s.initialized === true);

    const sandboxFrame = page
      .frames()
      .find((f) => f.url().startsWith(`${origins.sandbox}/sandbox.html`));
    const view = sandboxFrame?.childFrames()[0];
    check(
      'sandbox',
      'sandbox proxy on an origin of its own, the view inside it',
      Boolean(view),
      page
        .frames()
        .map((f) => f.url())
        .join(' | ')
    );
    if (!view) throw new Error(`No view, no run: ${JSON.stringify(checks)}`);

    return {
      browser,
      page,
      view,
      endpoint: options.endpoint,
      width,
      state,
      check,
      checks,
      consoleLines,
      pageErrors,
      cspReports,
      responses,
      rpcLog,
      origins,
      started,
      notes: [],
      host: {
        releaseResult: () =>
          page.evaluate(() => (window as unknown as Required<HostWindow>).__host.releaseResult()),
        setTheme: (theme) =>
          page.evaluate(
            (t) => (window as unknown as Required<HostWindow>).__host.setTheme(t),
            theme
          ),
        failNext: (name, message = FAIL_NEXT_MESSAGE) =>
          page.evaluate(
            ([n, m]) => (window as unknown as Required<HostWindow>).__host.failNext(n, m),
            [name, message] as const
          ),
        replay: () =>
          page.evaluate(() => (window as unknown as Required<HostWindow>).__host.replay()),
        teardown: (reason) =>
          page.evaluate(
            (r) => (window as unknown as Required<HostWindow>).__host.teardown(r),
            reason
          ),
        wireControl: () =>
          page.evaluate(() => (window as unknown as Required<HostWindow>).__host.wireControl())
      },
      close
    };
  } catch (error) {
    await close();
    throw error;
  }
}
