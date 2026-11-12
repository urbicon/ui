/**
 * The two pages of the test host: the host page, whose script is the host in
 * the spec's sense, and the sandbox proxy on a second origin. Plain scripts
 * in template strings — they run in the browser, not here.
 */
import type { HostCsp } from './csp.ts';

/** What the host page knows; serialised into the page. */
export interface HostPageConfig {
  sandboxOrigin: string;
  specVersion: string;
  tool: string;
  args: Record<string, unknown>;
  width: number;
  /** `hostContext` of `ui/initialize`, without `toolInfo` (the page adds the tool it read). */
  hostContext: Record<string, unknown> & { theme: 'light' | 'dark' };
  /** In place of `resources/read`: an HTML with its CSP — to measure a build variant. */
  override?: { html: string; csp: HostCsp | null };
  /**
   * `auto`: `tool-input`, then the call, its result behind the latch
   * (`releaseResult`). `scripted`: after `initialized` nothing happens on its
   * own; the run sends input and result itself (`replay`).
   */
  flow: 'auto' | 'scripted';
}

/** The proxy: writes the view into its inner iframe and passes messages through. */
export function sandboxPage(hostOrigin: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark">
<style>html,body{margin:0;height:100%;background:transparent}iframe{display:block;width:100%;height:100%;border:0;color-scheme:inherit}</style>
</head><body><script>
const HOST = ${JSON.stringify(hostOrigin)};
if (window.self === window.top) throw new Error('The sandbox proxy runs only inside an iframe.');
const inner = document.createElement('iframe');
inner.setAttribute('sandbox', 'allow-scripts allow-same-origin');
document.body.appendChild(inner);
window.addEventListener('message', (event) => {
  if (event.source === window.parent) {
    if (event.origin !== HOST) { console.error('[sandbox] foreign origin', event.origin); return; }
    if (event.data && event.data.method === 'ui/notifications/sandbox-resource-ready') {
      const doc = inner.contentDocument;
      doc.open(); doc.write(event.data.params.html); doc.close();
      return;
    }
    // Everything else goes to the view, except ui/notifications/sandbox-* (spec, item 6).
    if (!(event.data && typeof event.data.method === 'string' && event.data.method.startsWith('ui/notifications/sandbox-'))) {
      inner.contentWindow.postMessage(event.data, '*');
    }
  } else if (event.source === inner.contentWindow) {
    window.parent.postMessage(event.data, HOST);
  }
});
window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-proxy-ready', params: {} }, HOST);
</script></body></html>`;
}

/** The host page. Its script is the host; `window.__host` is for the run. */
export function hostPage(config: HostPageConfig): string {
  return `<!doctype html><html lang="en" data-theme="${config.hostContext.theme}"><head><meta charset="utf-8">
<title>MCP-App test host</title>
<style>
:root{color-scheme:light;font:14px/1.4 system-ui,sans-serif}
:root[data-theme=dark]{color-scheme:dark}
body{margin:0;padding:24px;background:light-dark(#f4f4f5,#1c1c1f);color:light-dark(#27272a,#e4e4e7)}
.chat{width:${config.width + 2}px}
.meta{margin:0 0 8px;font-size:12px;opacity:.7}
#sandbox{display:block;box-sizing:content-box;width:${config.width}px;height:0;border:1px solid light-dark(#d4d4d8,#3f3f46);border-radius:12px;overflow:hidden;background:transparent}
</style></head><body>
<div class="chat"><p class="meta">Test host · ${config.tool.replace(/[<&]/g, '')}</p>
<iframe id="sandbox" sandbox="allow-scripts allow-same-origin" title="MCP App"></iframe></div>
<script id="config" type="application/json">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>
<script type="module">
import { wireProblem } from '/wire.js';
const config = JSON.parse(document.getElementById('config').textContent);
const iframe = document.getElementById('sandbox');
let html = null;
const state = {
  phase: 'start', tool: null, uri: null, mimeType: null, csp: null, initialized: false,
  resultReady: false, resultSent: false, initParams: null, sizes: [], logs: [], viewRequests: [], unknown: [], errors: [],
  tornDown: false, failNext: [], refused: [], wire: { checked: 0, problems: [] }
};
// Every message against the SDK's schemas — \`from\` says who sent it.
function wireCheck(from, message, answers) {
  state.wire.checked++;
  const problem = wireProblem(message, answers);
  if (problem) state.wire.problems.push(from + ': ' + problem.message + ' — ' + JSON.stringify(message).slice(0, 300));
  return problem;
}
let rpcId = 0;
async function rpcRaw(method, params) {
  const response = await fetch('/rpc', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }) });
  return response.json();
}
async function rpc(method, params) {
  const body = await rpcRaw(method, params);
  if (body.error) throw new Error(method + ': ' + body.error.code + ' ' + body.error.message);
  return body.result;
}
const post = (message, answers) => {
  wireCheck('Host', message, answers);
  iframe.contentWindow.postMessage(message, config.sandboxOrigin);
};
const pending = new Map();
let hostId = 0;
function request(method, params, ms = 5000) {
  const id = 'host-' + (++hostId);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ': no answer')); }, ms);
    pending.set(id, { method, resolve, reject, timer });
    post({ jsonrpc: '2.0', id, method, params });
  });
}
// Without visibility the spec's default holds — which is what a host enforces.
const visibilityOf = (tool) => (tool && tool._meta && tool._meta.ui && tool._meta.ui.visibility) || ['model', 'app'];
let tools = [];

async function viewRequest(message) {
  const { id, method, params } = message;
  state.viewRequests.push({ method, params });
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const no = (code, text) => ({ jsonrpc: '2.0', id, error: { code, message: text } });
  switch (method) {
    case 'ui/initialize':
      state.initParams = params;
      return ok({
        protocolVersion: config.specVersion,
        hostInfo: { name: 'mcp-app-test-host', version: '1.0.0' },
        hostCapabilities: { openLinks: {}, serverTools: {}, serverResources: {}, logging: {} },
        hostContext: { ...config.hostContext, toolInfo: { tool: state.tool } }
      });
    case 'tools/call': {
      // Spec: "Host MUST reject tools/call requests from apps for tools that don't include "app" in visibility".
      const tool = tools.find((t) => t.name === params?.name);
      const visibility = visibilityOf(tool);
      if (!tool || !visibility.includes('app')) {
        state.refused.push(params?.name ?? '?');
        return no(-32000, (params?.name ?? '?') + ' is not granted to views (visibility ' + JSON.stringify(visibility) + ')');
      }
      // An error to order — for a scenario that checks how the view shows one.
      const fail = state.failNext.indexOf(params.name);
      if (fail >= 0) {
        state.failNext.splice(fail, 1);
        return no(-32000, 'The test host dropped this call on purpose.');
      }
      // As the server answered: a JSON-RPC error goes to the view as an error, with its code and sentence.
      const answer = await rpcRaw('tools/call', params);
      return answer.error ? no(answer.error.code, answer.error.message) : ok(answer.result);
    }
    case 'resources/read':
      try { return ok(await rpc('resources/read', params)); } catch (e) { return no(-32000, String(e.message)); }
    case 'ui/open-link': case 'ui/message': case 'ui/update-model-context': return ok({});
    case 'ui/request-display-mode': return ok({ mode: 'inline' });
    case 'ping': return ok({});
    default: return no(-32601, 'Unknown method: ' + method);
  }
}

let releaseResult;
const resultGate = new Promise((resolve) => { releaseResult = resolve; });
async function afterInitialized() {
  if (config.flow === 'scripted') return;
  post({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: config.args } });
  const result = await rpc('tools/call', { name: config.tool, arguments: config.args });
  state.resultReady = true;
  await resultGate;
  post({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result });
  state.resultSent = true;
}

window.addEventListener('message', async (event) => {
  if (event.source !== iframe.contentWindow || event.origin !== config.sandboxOrigin) return;
  const message = event.data;
  if (!message || message.jsonrpc !== '2.0') return;
  const isResponse = typeof message.method !== 'string';
  const problem = wireCheck('View', message, isResponse ? pending.get(message.id)?.method : undefined);
  if (problem && !isResponse) {
    // A request that fails gets exactly the error object of the check — what a
    // host validating with the SDK answers; a notification that fails is dropped.
    if (message.id !== undefined && message.id !== null) {
      post({ jsonrpc: '2.0', id: message.id, error: { code: problem.code, message: problem.message } });
    }
    return;
  }
  if (message.method === 'ui/notifications/sandbox-proxy-ready') {
    post({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-resource-ready', params: { html, csp: state.csp ?? undefined } });
    return;
  }
  if (typeof message.method === 'string' && message.id !== undefined && message.id !== null) {
    post(await viewRequest(message), message.method);
    return;
  }
  if (typeof message.method === 'string') {
    switch (message.method) {
      case 'ui/notifications/initialized':
        state.initialized = true;
        afterInitialized().catch((e) => state.errors.push(String(e.message)));
        return;
      case 'ui/notifications/size-changed':
        state.sizes.push(message.params);
        if (typeof message.params?.height === 'number') iframe.style.height = message.params.height + 'px';
        return;
      case 'notifications/message':
        state.logs.push(message.params);
        return;
      default:
        state.unknown.push(message.method);
        return;
    }
  }
  const entry = pending.get(message.id);
  if (!entry) { state.errors.push('Answer without a request: ' + JSON.stringify(message.id)); return; }
  pending.delete(message.id); clearTimeout(entry.timer);
  if (problem) entry.reject(new Error(problem.message));
  else if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
});

window.__host = {
  state,
  // Positive control: the bundled schema is alive and rejects the form of the spec text.
  wireControl: () => wireProblem({ jsonrpc: '2.0', id: 0, method: 'ui/message', params: { role: 'user', content: { type: 'text', text: 'x' } } }),
  releaseResult: () => releaseResult(),
  setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    // Spec: the host sends nothing before initialized.
    if (state.initialized) post({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme } });
  },
  failNext(name) { state.failNext.push(name); },
  // Redraw from history (flow: 'scripted'): the host has arguments and result
  // already, and both reach the view in the same tick — no latch.
  async replay() {
    const answer = await rpcRaw('tools/call', { name: config.tool, arguments: config.args });
    post({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: config.args } });
    post({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: answer.result });
    state.resultSent = true;
  },
  async teardown(reason) {
    const result = await request('ui/resource-teardown', { reason });
    iframe.remove();
    state.tornDown = true;
    return result;
  }
};

try {
  tools = (await rpc('tools/list')).tools;
  state.tool = tools.find((t) => t.name === config.tool) ?? null;
  if (!state.tool) throw new Error(config.tool + ' is not in tools/list');
  const meta = state.tool._meta ?? {};
  state.uri = (meta.ui && meta.ui.resourceUri) ?? meta['ui/resourceUri'] ?? null;
  if (config.override) {
    html = config.override.html; state.csp = config.override.csp; state.mimeType = 'override';
  } else {
    if (!state.uri) throw new Error(config.tool + ' has no view (_meta.ui.resourceUri)');
    const read = await rpc('resources/read', { uri: state.uri });
    const content = read.contents[0];
    state.mimeType = content.mimeType;
    html = content.text;
    state.csp = (content._meta && content._meta.ui && content._meta.ui.csp) ?? null;
  }
  state.phase = 'loading';
  iframe.src = config.sandboxOrigin + '/sandbox.html?csp=' + encodeURIComponent(JSON.stringify(state.csp));
} catch (e) {
  state.phase = 'failed'; state.errors.push(String(e.message));
}
</script></body></html>`;
}
