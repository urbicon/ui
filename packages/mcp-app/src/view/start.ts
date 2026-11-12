/**
 * Starting a view: connect the bridge, keep the state, report the size.
 *
 * The same for every view, following the spec's lifecycle: handshake →
 * `tool-input-partial` (zero or more) → `tool-input` → `tool-result` (or
 * `tool-cancelled`) → `ui/resource-teardown`. What the view renders and with
 * which framework is the app's: `startView` writes into the app's state
 * object and hands the props to the app's `mount`.
 */
import {
  applyTheme,
  autoResize,
  type Bridge,
  type BridgeOptions,
  type CallToolResult,
  createBridge,
  type HostContext,
  type ToolCaller,
  type Transport,
  type ViewBridge,
  windowTransport
} from './bridge.ts';
import { assertViewReach, checkCallsTools, propsFor, type ViewProps } from './props.ts';
import { problemOf } from './result.ts';

/**
 * The run of a tool call, as the view sees it.
 *
 * `connecting` until the handshake stands, `waiting` until the result is
 * there, then `ready` — or `failed` (an error result, a failed handshake) or
 * `cancelled` (the host cancelled).
 */
export type Phase = 'connecting' | 'waiting' | 'ready' | 'failed' | 'cancelled';

/**
 * The state `startView` writes and the view reads. Any object with these
 * writable fields will do — a plain object, a class with setters that render,
 * a class of `$state` fields.
 */
export interface ViewState {
  phase: Phase;
  /** The call's arguments (`tool-input`), as the host sends them. */
  input: Record<string, unknown> | null;
  result: CallToolResult | null;
  /** A sentence when something did not work — the view shows it. */
  problem: string | null;
  context: HostContext;
}

/** The sentences `startView` writes into `state.problem`, in the view's language. */
export interface ViewMessages {
  /** After `tool-cancelled`, with the host's reason if it gave one. */
  cancelled(reason: string | undefined): string;
  /** The handshake failed or timed out. */
  hostSilent: string;
  /** An error result without a text block of its own (`problemOf`). */
  failed: string;
}

export type StartViewOptions<S extends ViewState, C extends boolean> = {
  appInfo: BridgeOptions['appInfo'];
  appCapabilities?: BridgeOptions['appCapabilities'];
  state: S;
  messages: ViewMessages;
  /** `logger` of `notifications/message` and the console prefix; default `appInfo.name`. */
  logger?: string;
  /**
   * Called **in addition** to the default, which logs to the console and, while
   * connected, to the host (`notifications/message`, level `error`).
   */
  onError?: (error: Error) => void;
  /** Renders the view; called once, before the handshake. */
  mount(props: ViewProps<S, C>): void;
  /** Whether the view calls tools. `true` requires `tools`, `false` forbids it. */
  callsTools: C;
} & (C extends true ? { tools: (bridge: Bridge) => ToolCaller } : { tools?: never });

/** What `runView` reaches of the browser — `startView` passes the real one. */
export interface ViewEnvironment {
  transport: Transport;
  root: { style: { colorScheme: string } };
  /** Starts reporting the size; returns the function that stops it. */
  resize(bridge: Bridge): () => void;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Starts the view in this window: `window.parent` is the host. Returns the
 * {@link ViewBridge} the view was mounted with — the caller gets no more of
 * the bridge than the view does.
 */
export function startView<S extends ViewState, C extends boolean>(
  options: StartViewOptions<S, C>
): { bridge: ViewBridge } {
  return runView(options, {
    transport: windowTransport(window),
    root: document.documentElement,
    resize: (bridge) => autoResize(bridge, document, window)
  });
}

/** {@link startView} over an explicit environment. */
export function runView<S extends ViewState, C extends boolean>(
  options: StartViewOptions<S, C>,
  env: ViewEnvironment
): { bridge: ViewBridge } {
  // Before createBridge: a view stopped here must leave no listener behind.
  checkCallsTools(options.callsTools, options.tools);
  const { state, messages } = options;
  const logger = options.logger ?? options.appInfo.name;
  let stopResize: (() => void) | undefined;

  function reportError(error: Error): void {
    console.error(`[${logger}]`, error);
    if (bridge.connected) bridge.log('error', error.message);
    options.onError?.(error);
  }

  const bridge: Bridge = createBridge(env.transport, {
    appInfo: options.appInfo,
    ...(options.appCapabilities ? { appCapabilities: options.appCapabilities } : {}),
    logger,
    on: {
      hostContextChanged(context) {
        state.context = context;
        applyTheme(env.root, context);
      },
      toolInputPartial() {
        if (state.phase === 'connecting') state.phase = 'waiting';
      },
      toolInput(args) {
        state.input = args;
        if (state.phase === 'connecting') state.phase = 'waiting';
      },
      toolResult(result) {
        state.result = result;
        state.phase = result.isError ? 'failed' : 'ready';
        state.problem = result.isError ? problemOf(result, messages.failed) : null;
      },
      toolCancelled(reason) {
        state.phase = 'cancelled';
        state.problem = messages.cancelled(reason);
      },
      teardown() {
        stopResize?.();
      }
    },
    onError: reportError
  });

  // The view gets the ViewBridge, never the whole bridge — checked on the
  // object that is mounted, where the type would not see it.
  const props = propsFor(options, state, bridge, options.tools);
  assertViewReach(props);
  options.mount(props as ViewProps<S, C>);

  bridge
    .connect()
    .then(
      () => {
        if (state.phase === 'connecting') state.phase = 'waiting';
        stopResize = env.resize(bridge);
      },
      (error: unknown) => {
        state.phase = 'failed';
        state.problem = messages.hostSilent;
        console.error(`[${logger}] The handshake failed.`, error);
      }
    )
    .catch((error: unknown) => reportError(toError(error)));

  return { bridge: props.bridge };
}
