/**
 * The view's bridge to its host — JSON-RPC 2.0 over `postMessage`, written by
 * hand against `io.modelcontextprotocol/ui` 2026-01-26.
 *
 * **Not `@modelcontextprotocol/ext-apps`**: it brings the MCP SDK and Zod as
 * peers into the view bundle, and the surface here is small and fixed by the
 * spec. **Where the spec text and the SDK disagree, the SDK's wire wins**,
 * because hosts validate with its schemas: `ui/initialize` rather than the
 * `initialize` of the transport example, and `ui/message` with `content` as an
 * array of content blocks where the spec text shows an object — the object
 * form is what Claude rejects. `bridge.test.ts` checks every message this
 * bridge can send against those schemas (`../testing/wire.ts`).
 *
 * **Testable without a browser**: the bridge knows only a {@link Transport}.
 * {@link windowTransport} builds the real one over `window.parent`; tests pass
 * their own. Likewise {@link createSizeReporter} takes its measurement and
 * scheduler, and {@link autoResize} wires them to the document.
 *
 * **Errors are loud.** A host error answer rejects the promise with
 * {@link BridgeError}; an answer to an unknown id, a malformed JSON-RPC
 * message, a throwing handler and a transport that throws while answering go
 * to `onError` (default `console.error`). Ignored are what is not JSON-RPC at
 * all — browser extensions and developer tools talk over `postMessage` too
 * (the SDK source ignores those as well) —, a notification the view does not
 * know, and the first answer to a request that timed out: its promise has
 * rejected with `REQUEST_TIMEOUT` already, and a slow host may still answer.
 */
import { type JsonRpcId, METHOD_NOT_FOUND } from '../jsonrpc.ts';

/** The spec version this bridge is written against. */
export const PROTOCOL_VERSION = '2026-01-26';

/** How long a request waits for its answer — the MCP SDK's default. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** JSON-RPC codes the bridge itself hands out, beside `METHOD_NOT_FOUND`. */
export const IMPLEMENTATION_ERROR = -32000;
export const REQUEST_TIMEOUT = -32001;

export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: JsonRpcId | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** The wire: send and listen. The bridge needs nothing more. */
export interface Transport {
  send(message: JsonRpcMessage): void;
  /** Reports every incoming message; the returned function stops listening. */
  listen(handler: (data: unknown) => void): () => void;
}

/** A content block of a tool result — the text form is what a view reads. */
export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/** The MCP `CallToolResult`, as far as a view reads it. */
export interface CallToolResult {
  content: ContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

export type Theme = 'light' | 'dark';
export type DisplayMode = 'inline' | 'fullscreen' | 'pip';

/**
 * The host's context. Named are the fields a view reads; the rest is kept,
 * because `host-context-changed` may deliver any field later.
 *
 * `styles.variables` uses the spec's names (`--color-text-primary`,
 * `--font-sans`, …); some are also names of Tailwind's default theme
 * (`--font-sans`) or of a view's own tokens (`--color-text-primary`) — a view
 * that applies them sets them under its own prefix, never under their own name.
 */
export interface HostContext {
  theme?: Theme;
  displayMode?: DisplayMode;
  availableDisplayModes?: string[];
  locale?: string;
  timeZone?: string;
  platform?: 'web' | 'desktop' | 'mobile';
  [key: string]: unknown;
}

export interface InitializeResult {
  protocolVersion: string;
  hostInfo?: { name: string; version: string };
  hostCapabilities?: Record<string, unknown>;
  hostContext?: HostContext;
  [key: string]: unknown;
}

/**
 * A host error answer — code and sentence preserved.
 *
 * `message` is prefixed with the method (for the console and the log),
 * `reason` is the host's sentence alone — the one a view can show a person.
 */
export class BridgeError extends Error {
  readonly code: number;
  readonly data: unknown;
  readonly reason: string;
  constructor(code: number, message: string, data?: unknown, reason = message) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.data = data;
    this.reason = reason;
  }
}

/** What the view does on the host's messages. All optional. */
export interface BridgeHandlers {
  toolInput?(args: Record<string, unknown>): void;
  toolInputPartial?(args: Record<string, unknown>): void;
  toolResult?(result: CallToolResult): void;
  toolCancelled?(reason: string | undefined): void;
  /** After every change, with the **merged** context. */
  hostContextChanged?(context: HostContext): void;
  /** Before teardown; the host waits for the answer (spec: "SHOULD wait"). */
  teardown?(reason: string | undefined): void | Promise<void>;
}

export interface BridgeOptions {
  appInfo: { name: string; version: string };
  appCapabilities?: { availableDisplayModes?: DisplayMode[]; [key: string]: unknown };
  on?: BridgeHandlers;
  /** Where an error goes that has no promise to reject. */
  onError?: (error: Error) => void;
  timeoutMs?: number;
  /** `logger` of `notifications/message` and the console prefix; default `appInfo.name`. */
  logger?: string;
}

/**
 * The whole bridge — for the entry that wires it and for `toolCaller`. A view
 * never gets it, only a {@link ViewBridge}.
 *
 * **No `callTool` here**: `tools/call` is written only by `toolCaller`
 * (`@urbicon-ui/mcp-app/view/tools`), and only a view that declares
 * `callsTools` gets that path (`propsFor`).
 */
export interface Bridge {
  /** `ui/initialize` → keep the result → `ui/notifications/initialized`. */
  connect(): Promise<InitializeResult>;
  readonly hostContext: HostContext;
  readonly connected: boolean;
  request<T = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
  notify(method: string, params?: unknown): void;
  readResource(uri: string): Promise<unknown>;
  sendMessage(text: string): Promise<unknown>;
  updateModelContext(params: {
    content?: ContentBlock[];
    structuredContent?: Record<string, unknown>;
  }): Promise<unknown>;
  openLink(url: string): Promise<unknown>;
  requestDisplayMode(mode: DisplayMode): Promise<{ mode: DisplayMode }>;
  ping(): Promise<unknown>;
  log(level: 'debug' | 'info' | 'warning' | 'error', data: unknown): void;
  sizeChanged(size: { width: number; height: number }): void;
  /** Stops listening and rejects everything still open. */
  close(): void;
}

/**
 * What a view gets of the bridge: the messages to the host under fixed method
 * names — **no** free request. With `request` any view could send any method,
 * `tools/call` included, and the spec grants a tool's `"app"` visibility to
 * every view of the server. Whether a view calls tools is decided by its
 * `callsTools`, not by what it can pull out of a bridge.
 */
export type ViewBridge = Pick<
  Bridge,
  | 'hostContext'
  | 'connected'
  | 'sendMessage'
  | 'updateModelContext'
  | 'openLink'
  | 'requestDisplayMode'
  | 'log'
>;

/** The one way a view calls a tool — built by `toolCaller` (`@urbicon-ui/mcp-app/view/tools`). */
export interface ToolCaller {
  callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult>;
}

/**
 * The {@link ViewBridge} of a bridge — an object of its own, not the same
 * bridge under a narrower type: what the view must not get, it then does not
 * have at runtime either.
 */
export function viewBridge(bridge: Bridge): ViewBridge {
  return {
    get hostContext(): HostContext {
      return bridge.hostContext;
    },
    get connected(): boolean {
      return bridge.connected;
    },
    sendMessage: (text) => bridge.sendMessage(text),
    updateModelContext: (params) => bridge.updateModelContext(params),
    openLink: (url) => bridge.openLink(url),
    requestDisplayMode: (mode) => bridge.requestDisplayMode(mode),
    log: (level, data) => bridge.log(level, data)
  };
}

interface Pending {
  method: string;
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is JsonRpcId {
  return typeof value === 'string' || typeof value === 'number';
}

function argsOf(params: unknown): Record<string, unknown> {
  return isRecord(params) && isRecord(params.arguments) ? params.arguments : {};
}

function reasonOf(params: unknown): string | undefined {
  return isRecord(params) && typeof params.reason === 'string' ? params.reason : undefined;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function createBridge(transport: Transport, options: BridgeOptions): Bridge {
  const on = options.on ?? {};
  const logger = options.logger ?? options.appInfo.name;
  const onError = options.onError ?? ((error: Error): void => console.error(`[${logger}]`, error));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let nextId = 1;
  const pending = new Map<JsonRpcId, Pending>();
  /**
   * Requests that timed out; their answer, should it come after all, is
   * dropped. An id stays until that answer or `close()` — never more ids than
   * requests the host left unanswered.
   */
  const expired = new Set<JsonRpcId>();
  let hostContext: HostContext = {};
  let connected = false;
  let closed = false;

  function send(message: JsonRpcMessage): void {
    if (closed) throw new Error('The bridge is closed.');
    transport.send(message);
  }

  function rawRequest<T>(method: string, params: unknown, ms: number): Promise<T> {
    if (closed) return Promise.reject(new Error(`${method}: the bridge is closed.`));
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        expired.add(id);
        reject(
          new BridgeError(REQUEST_TIMEOUT, `${method}: no answer after ${ms} ms.`, undefined, '')
        );
      }, ms);
      pending.set(id, { method, resolve: resolve as (value: unknown) => void, reject, timer });
      send({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });
    });
  }

  function request<T>(method: string, params?: unknown, ms = timeoutMs): Promise<T> {
    // The spec forbids the host to send before `initialized`; the same order
    // holds the other way, or the view asks a host that does not know it yet.
    if (!connected) {
      return Promise.reject(new Error(`${method}: connect() first, then requests.`));
    }
    return rawRequest<T>(method, params, ms);
  }

  function notify(method: string, params?: unknown): void {
    send({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) });
  }

  function answer(id: JsonRpcId, result: unknown): void {
    if (!closed) send({ jsonrpc: '2.0', id, result });
  }

  function refuse(id: JsonRpcId, code: number, message: string): void {
    if (!closed) send({ jsonrpc: '2.0', id, error: { code, message } });
  }

  function mergeContext(partial: unknown): void {
    if (!isRecord(partial)) return;
    // Shallow, like the SDK source: a partial update replaces every field it
    // names and leaves the others standing.
    hostContext = { ...hostContext, ...partial };
    on.hostContextChanged?.(hostContext);
  }

  function settle(message: Record<string, unknown>): void {
    const id = message.id;
    if (isId(id) && expired.delete(id)) return;
    const entry = isId(id) ? pending.get(id) : undefined;
    if (!entry || !isId(id)) {
      onError(new Error(`Answer to an unknown request (id ${String(id)}).`));
      return;
    }
    pending.delete(id);
    clearTimeout(entry.timer);
    if (isRecord(message.error)) {
      const { code, message: text, data } = message.error;
      const reason = typeof text === 'string' ? text : '';
      entry.reject(
        new BridgeError(
          typeof code === 'number' ? code : IMPLEMENTATION_ERROR,
          `${entry.method}: ${reason || 'error without a message'}`,
          data,
          reason
        )
      );
    } else {
      entry.resolve(message.result);
    }
  }

  async function onHostRequest(id: JsonRpcId, method: string, params: unknown): Promise<void> {
    switch (method) {
      case 'ui/resource-teardown': {
        let failure: Error | null = null;
        try {
          await on.teardown?.(reasonOf(params));
        } catch (error) {
          failure = toError(error);
          onError(failure);
        }
        try {
          if (failure) refuse(id, IMPLEMENTATION_ERROR, `Teardown error: ${failure.message}`);
          else answer(id, {});
        } finally {
          // After the answer the host tears down; the view stops listening —
          // also when the answer did not go out (that error goes to onError).
          close();
        }
        return;
      }
      case 'ping':
        answer(id, {});
        return;
      default:
        refuse(id, METHOD_NOT_FOUND, `The view does not handle ${method}.`);
    }
  }

  function onNotification(method: string, params: unknown): void {
    switch (method) {
      case 'ui/notifications/tool-input':
        on.toolInput?.(argsOf(params));
        return;
      case 'ui/notifications/tool-input-partial':
        on.toolInputPartial?.(argsOf(params));
        return;
      case 'ui/notifications/tool-result':
        if (isRecord(params) && Array.isArray(params.content)) {
          on.toolResult?.(params as unknown as CallToolResult);
        } else {
          onError(new Error('tool-result without content — that is not a CallToolResult.'));
        }
        return;
      case 'ui/notifications/tool-cancelled':
        on.toolCancelled?.(reasonOf(params));
        return;
      case 'ui/notifications/host-context-changed':
        mergeContext(params);
        return;
      default:
      // A notification the view does not know is not an error: JSON-RPC never
      // answers one, and a newer spec may add some.
    }
  }

  function receive(data: unknown): void {
    if (closed) return;
    // What is not JSON-RPC is not ours (see the head of this file).
    if (!isRecord(data) || data.jsonrpc !== '2.0') return;
    const { id, method, params } = data;
    try {
      if (typeof method === 'string') {
        // Asynchronous: what throws later (the handler, the transport while
        // answering) no longer reaches the catch below.
        if (isId(id)) onHostRequest(id, method, params).catch((error) => onError(toError(error)));
        else onNotification(method, params);
      } else if ('result' in data || 'error' in data) {
        settle(data);
      } else {
        onError(new Error('JSON-RPC message without method, result or error.'));
      }
    } catch (error) {
      onError(toError(error));
    }
  }

  const stopListening = transport.listen(receive);

  function close(): void {
    if (closed) return;
    closed = true;
    stopListening();
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(`${entry.method}: the bridge was closed.`));
      pending.delete(id);
    }
    expired.clear();
  }

  return {
    async connect(): Promise<InitializeResult> {
      if (connected) throw new Error('The bridge is already connected.');
      const result = await rawRequest<InitializeResult>(
        'ui/initialize',
        {
          appInfo: options.appInfo,
          appCapabilities: options.appCapabilities ?? {},
          protocolVersion: PROTOCOL_VERSION
        },
        timeoutMs
      );
      if (!isRecord(result) || typeof result.protocolVersion !== 'string') {
        throw new Error('ui/initialize: the result carries no protocolVersion.');
      }
      connected = true;
      hostContext = isRecord(result.hostContext) ? { ...result.hostContext } : {};
      notify('ui/notifications/initialized');
      on.hostContextChanged?.(hostContext);
      return result;
    },
    get hostContext(): HostContext {
      return hostContext;
    },
    get connected(): boolean {
      return connected && !closed;
    },
    request,
    notify,
    readResource: (uri) => request('resources/read', { uri }),
    sendMessage: (text) =>
      request('ui/message', { role: 'user', content: [{ type: 'text', text }] }),
    updateModelContext: (params) => request('ui/update-model-context', params),
    openLink: (url) => request('ui/open-link', { url }),
    requestDisplayMode: (mode) =>
      request<{ mode: DisplayMode }>('ui/request-display-mode', { mode }),
    ping: () => request('ping'),
    log: (level, data) => notify('notifications/message', { level, logger, data }),
    sizeChanged: (size) => notify('ui/notifications/size-changed', size),
    close
  };
}

/* --- The real wire ----------------------------------------------------------- */

/** As much of `window` as the transport needs — a test builds it. */
export interface WindowLike {
  parent: unknown;
  addEventListener(
    type: 'message',
    listener: (event: { source: unknown; data: unknown }) => void
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: { source: unknown; data: unknown }) => void
  ): void;
}

/**
 * `postMessage` to `window.parent` — and **only** from there is heard.
 *
 * The sender is checked by `event.source`, not by `event.origin`: in a web
 * host the view sits behind a sandbox proxy on an origin of its own that the
 * view does not know, and `window.location.origin` can be `"null"` in the
 * sandbox. Whoever is not the parent window does not take part.
 *
 * Sent to `'*'`, because the parent's origin is unknown; the view's messages
 * carry nothing a foreign receiver must not see — and the only receiver is the
 * parent window anyway.
 */
export function windowTransport(win: WindowLike): Transport {
  const parent = win.parent as { postMessage(message: unknown, targetOrigin: string): void };
  return {
    send: (message) => parent.postMessage(message, '*'),
    listen(handler): () => void {
      const listener = (event: { source: unknown; data: unknown }): void => {
        if (event.source !== win.parent) return;
        handler(event.data);
      };
      win.addEventListener('message', listener);
      return () => win.removeEventListener('message', listener);
    }
  };
}

/* --- The size ---------------------------------------------------------------- */

export interface SizeReporterEnv {
  /** Measures the content's size in whole pixels. */
  measure(): { width: number; height: number };
  /** One frame later (in the browser `requestAnimationFrame`). */
  schedule(callback: () => void): void;
  send(size: { width: number; height: number }): void;
}

/**
 * Debounces to one frame and reports only a **real** change.
 *
 * Several `changed()` in the same frame measure once; a measurement equal to
 * the last one reported sends nothing — otherwise host and view would rock
 * each other up over the view's own height (the same rule as the SDK source).
 */
export function createSizeReporter(env: SizeReporterEnv): { changed(): void } {
  let scheduled = false;
  let last: { width: number; height: number } | null = null;
  return {
    changed(): void {
      if (scheduled) return;
      scheduled = true;
      env.schedule(() => {
        scheduled = false;
        const size = env.measure();
        if (last && last.width === size.width && last.height === size.height) return;
        last = size;
        env.send(size);
      });
    }
  };
}

/**
 * The document's size to the host, through a `ResizeObserver` on `<html>` and
 * `<body>`.
 *
 * Measured as in the SDK source: `<html>` briefly at `max-content`, because
 * `fit-content` sticks to the iframe's height when the content is taller — the
 * view would then scroll inside instead of growing. The width is the window's;
 * measuring it would force the layout to zero width once.
 */
export function autoResize(bridge: Bridge, doc: Document, win: Window): () => void {
  const reporter = createSizeReporter({
    measure() {
      const html = doc.documentElement;
      const before = html.style.height;
      html.style.height = 'max-content';
      const height = Math.ceil(html.getBoundingClientRect().height);
      html.style.height = before;
      return { width: Math.ceil(win.innerWidth), height };
    },
    schedule: (callback) => win.requestAnimationFrame(callback),
    send: (size) => {
      if (bridge.connected) bridge.sizeChanged(size);
    }
  });
  const observer = new ResizeObserver(() => reporter.changed());
  observer.observe(doc.documentElement);
  observer.observe(doc.body);
  reporter.changed();
  return () => observer.disconnect();
}

/* --- The theme --------------------------------------------------------------- */

/**
 * `hostContext.theme` → `color-scheme` on the root.
 *
 * Enough for a view whose colours switch through `light-dark()`, which follows
 * `color-scheme`. Without a theme from the host the page keeps its own
 * default (`light dark` → the system setting).
 */
export function applyTheme(root: { style: { colorScheme: string } }, context: HostContext): void {
  if (context.theme === 'light' || context.theme === 'dark') {
    root.style.colorScheme = context.theme;
  }
}
