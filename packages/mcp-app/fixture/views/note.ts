/**
 * The fixture's view — plain DOM, no framework, through `startView`. It does
 * what the test host has to see a view do: render the result, call a granted
 * tool, ask the model, open a link into the app, load a font from the app's
 * origin and a module through a dynamic import.
 *
 * `__FIXTURE_SABOTAGE__` is set by the fixture's build: a control run breaks
 * the view on purpose (`../sabotage.ts`), a green build sets `''`.
 */
import './app.css';
import {
  BridgeError,
  type CallToolResult,
  problemOf,
  readBaseMeta,
  startView,
  type ToolCaller,
  type ViewBridge,
  type ViewState
} from '@urbicon-ui/mcp-app/view';
import { toolCaller } from '@urbicon-ui/mcp-app/view/tools';
import { BASE_META, FIXTURE_INFO, type Note, VIEWS } from '../shared.ts';

declare const __FIXTURE_SABOTAGE__: string;

const PHASE_TEXT = {
  connecting: 'Connecting…',
  waiting: 'Waiting for the note…',
  ready: '',
  failed: '',
  cancelled: ''
} as const;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = ''
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

const noteOf = (result: CallToolResult | null): Note | null =>
  (result?.structuredContent?.note as Note | undefined) ?? null;

const reasonOf = (error: unknown): string =>
  error instanceof BridgeError ? error.reason : String(error);

// The transitions are for the host's checks, which must read the value a
// transition settles on: the title's colour takes longer than a frame or two
// (`host-variables-control`), the card's background begins to change only
// long after the theme does (`theme`).
const main = element(
  'main',
  'bg-surface text-ink flex flex-col gap-2 p-4 transition-colors delay-1000'
);
const status = element('p', 'text-sm');
status.setAttribute('role', 'status');
const title = element(
  'h1',
  'text-text-primary text-lg font-semibold transition-colors duration-300'
);
const body = element('p', 'font-mono text-sm');
const greeting = element('p', 'text-sm');
const actions = element('div', 'flex gap-2');
const outcome = element('p', 'text-sm');
outcome.id = 'outcome';
outcome.setAttribute('role', 'status');
main.append(status, title, body, greeting, actions, outcome);

let shown: Note | null = null;

function render(): void {
  const phase = state.phase;
  status.textContent = state.problem ?? PHASE_TEXT[phase];
  shown = phase === 'ready' ? (noteOf(state.result) ?? shown) : shown;
  title.textContent = shown?.title ?? '';
  body.textContent = shown?.body ?? '';
}

// Any object with writable fields will do; this one renders on every write.
const state: ViewState = new Proxy<ViewState>(
  { phase: 'connecting', input: null, result: null, problem: null, context: {} },
  {
    set(target, key, value) {
      Reflect.set(target, key, value);
      render();
      if (key === 'result' && value) afterResult();
      return true;
    }
  }
);

/** What `mount` received — for the sabotages that act after the result. */
let mounted: { bridge: ViewBridge; tools: ToolCaller } | null = null;

let sabotaged = false;
function afterResult(): void {
  if (sabotaged) return;
  sabotaged = true;
  if (__FIXTURE_SABOTAGE__ === 'image-outside-csp') {
    const image = element('img', '');
    image.alt = '';
    image.src = 'https://example.org/mcp-app-fixture-sabotage.png';
    main.append(image);
  }
  if (__FIXTURE_SABOTAGE__ === 'view-throws') {
    setTimeout(() => {
      throw new Error('The fixture view throws (sabotage view-throws).');
    });
  }
  if (__FIXTURE_SABOTAGE__ === 'model-only-from-view') {
    // A tool of the model's, and the refusal swallowed: nothing shows in the view.
    void mounted?.tools.callTool('remove_note', { id: 'no-such-note' }).catch(() => {});
  }
  if (__FIXTURE_SABOTAGE__ === 'log-error') {
    mounted?.bridge.log('error', 'The fixture view is broken (sabotage log-error).');
  }
}

function button(label: string, onClick: () => Promise<void>): void {
  const b = element('button', 'rounded border px-2 py-1 text-sm', label);
  b.type = 'button';
  b.onclick = () => {
    onClick().catch((error: unknown) => {
      outcome.textContent = reasonOf(error);
    });
  };
  actions.append(b);
}

function mount({ bridge, tools }: { bridge: ViewBridge; tools: ToolCaller }): void {
  mounted = { bridge, tools };
  document.body.append(main);
  render();
  button('Ask about it', async () => {
    await bridge.sendMessage(`Tell me more about “${shown?.title ?? ''}”.`);
    outcome.textContent = 'Asked.';
  });
  button('Reload', async () => {
    const result = await tools.callTool('get_note', { id: shown?.id });
    if (result.isError) {
      outcome.textContent = problemOf(result, 'That did not work.');
      return;
    }
    shown = noteOf(result) ?? shown;
    render();
    await bridge.updateModelContext({
      content: [{ type: 'text', text: `The note “${shown?.title ?? ''}” is shown.` }]
    });
    outcome.textContent = 'Reloaded.';
  });
  button('Open in the app', async () => {
    const base = readBaseMeta(document, BASE_META);
    if (!base) throw new Error('The view has no base URL.');
    await bridge.openLink(`${base}/notes/${shown?.id ?? ''}`);
    outcome.textContent = 'Opened.';
  });
  void import('./greeting.ts').then(({ greeting: line }) => {
    greeting.textContent = line();
  });
}

startView({
  appInfo: FIXTURE_INFO,
  appCapabilities: { availableDisplayModes: ['inline'] },
  state,
  messages: {
    cancelled: (reason) => (reason ? `Cancelled: ${reason}` : 'Cancelled.'),
    hostSilent: 'The host does not answer.',
    failed: 'That did not work.'
  },
  callsTools: VIEWS.note.callsTools,
  tools: toolCaller,
  mount
});
