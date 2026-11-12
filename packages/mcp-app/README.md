# @urbicon-ui/mcp-app

Building blocks for an MCP server that ships a **view** — an HTML page a host such as Claude
shows in place of a tool's text result, in an iframe that talks to the host over
`postMessage` (MCP Apps, `io.modelcontextprotocol/ui`, spec version 2026-01-26).

- **For a hand-written dispatcher.** The package hands out functions and objects your
  `switch (method)` hooks in. It brings no dispatcher, no HTTP transport and no tool
  registry.
- **Zero runtime dependencies, no framework.** The view side runs in any bundler and
  renders with whatever the app uses; the server side runs on Node and Bun.
- **Checked against the SDK, not the spec text.** Where the two disagree, hosts validate
  with the SDK's schemas, and so does this package's own test suite.

## Entry points

| Import                             | Runs in            | Peers                                                                     | What it gives you                                                      |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `@urbicon-ui/mcp-app/server`       | Node, Bun          | —                                                                         | `createViewCatalog`: `_meta.ui` for tools, `resources/*` for the views |
| `@urbicon-ui/mcp-app/view`         | the view (browser) | —                                                                         | `startView`, the bridge to the host, size and theme                    |
| `@urbicon-ui/mcp-app/view/tools`   | the view (browser) | —                                                                         | `toolCaller` — the one module that sends `tools/call`                  |
| `@urbicon-ui/mcp-app/testing`      | your test runner   | `@modelcontextprotocol/ext-apps` 1.7.5, `@modelcontextprotocol/sdk` ^1.29 | `wireProblem`: a message checked the way a host checks it              |
| `@urbicon-ui/mcp-app/testing/host` | Bun                | the two above, `playwright-core` ^1.62.1                                  | a test host after the spec, driven by Playwright against your server   |
| `@urbicon-ui/mcp-app/vite`         | a build script     | `vite` ^8.3                                                               | `buildViews`: each view as one HTML file, fonts beside it              |

```sh
bun add @urbicon-ui/mcp-app
# only for @urbicon-ui/mcp-app/testing and /testing/host
bun add -d @modelcontextprotocol/ext-apps@1.7.5 @modelcontextprotocol/sdk playwright-core
# only for @urbicon-ui/mcp-app/vite
bun add -d vite
```

The `ext-apps` peer is pinned exactly: `wireProblem` reports that version's schema sentences,
and Claude's rejection of a malformed `ui/message` is the 1.7.5 sentence word for word.

## Server: the view catalog

One catalog per server. It knows the views, their built HTML and, optionally, the app's
origin, and it answers what a host asks about them.

<!-- typecheck -->

```ts
import { createViewCatalog, type Outcome } from '@urbicon-ui/mcp-app/server';

declare const NOTE_HTML: string; // the built view: one self-contained HTML file

export const views = createViewCatalog({
  server: 'notes',
  views: {
    note: {
      title: 'Note',
      description: 'One note as a card, with a button to pin it.',
      csp: { resourceDomains: ['https://images.example.com'] },
      prefersBorder: true,
      callsTools: true
    }
  },
  html: (name) => (name === 'note' ? NOTE_HTML : undefined),
  base: { placeholder: '__NOTES_BASE__', origin: () => process.env.APP_URL ?? '' },
  unbuiltHint: 'bun run build:views'
});

export function dispatch(method: string, params: unknown): Outcome {
  switch (method) {
    case 'initialize':
      return {
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {}, ...views.capabilities },
          serverInfo: { name: 'notes', version: '1.0.0' }
        }
      };
    case 'tools/list':
      return {
        result: {
          tools: [
            {
              name: 'show_note',
              inputSchema: { type: 'object' },
              _meta: views.toolMeta({ view: 'note' })
            },
            {
              name: 'pin_note',
              inputSchema: { type: 'object' },
              _meta: views.toolMeta({ callableFromView: true })
            },
            { name: 'delete_note', inputSchema: { type: 'object' }, _meta: views.toolMeta() }
          ]
        }
      };
    default:
      return (
        views.handle(method, params) ?? {
          error: { code: -32601, message: `Method not found: ${method}` }
        }
      );
  }
}
```

An `Outcome` is `{ result }` or `{ error: { code, message } }`, without the JSON-RPC envelope
— your dispatcher adds `jsonrpc` and `id`.

What the catalog says on the wire:

| Where                      | What                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialize`               | `views.capabilities` adds `resources: {}`                                                                                                                                                      |
| `tools/list`               | `toolMeta()` puts `_meta.ui.visibility` on **every** tool — `["model"]`, or `["model", "app"]` with `callableFromView`. With `view`, also `_meta.ui.resourceUri` and the flat `ui/resourceUri` |
| `resources/list`           | every view, `mimeType: text/html;profile=mcp-app`, `_meta.ui.csp` and `prefersBorder`                                                                                                          |
| `resources/read`           | the view's HTML, with the app's origin in place of `base.placeholder`                                                                                                                          |
| `resources/templates/list` | `{ resourceTemplates: [] }`                                                                                                                                                                    |
| errors                     | `-32602` without a string `uri`, `-32002` for a URI with no view, `-32603` (and a console error) for a view whose `html` returns `undefined`, with `unbuiltHint`, or for an unusable origin    |

`handle()` returns `null` for every other method, so it sits in a `default` branch. The
pieces are also there one by one — `uri`, `at`, and `list` and `read`, which return an
`Outcome` as well — for a dispatcher that wants its own error sentences.

**Visibility is always explicit.** Without `_meta.ui.visibility` the spec defaults to
`["model", "app"]`, and every view of the server could call every tool — `delete_note`
included. A grant (`callableFromView`) holds for every view of the server, not for one;
which view gets a path to `tools/call` at all is decided in the view
([`callsTools`](#view-startview)), and `callsTools` itself never reaches the host.

**Both resource keys.** The spec calls the flat `ui/resourceUri` deprecated; the SDK still
sets it next to `_meta.ui.resourceUri`, and hosts read both.

### Versioned URIs

A view is issued as `ui://<server>/<name>/<version>`, where the version is the first
twelve hex characters (`VERSION_LENGTH`) of a SHA-256 over the built HTML. A host may
prefetch and keep a view's HTML, and Claude keeps it past a deploy; a new URI is the only
thing by which a host notices a new view. The version is derived, so it changes exactly
when the built file does.

Reading is **tolerant in time and strict in everything else**: the current URI, any older
version and the bare `ui://<server>/<name>` all read today's HTML, answered under the URI
that was asked for. A different server, a deleted view, a query, a fragment, `..`, other
casing or a segment that is not lowercase hex is `-32002`. A view whose `html` returns
`undefined` is issued without a version, so the same URI reads it once it is built.

The version covers the HTML only. A change to a view's `csp` or `prefersBorder`, or to the
app's origin, keeps the URI, and a host with a cache keeps the old resource.

### The app's origin in the view

A view often needs the app's own address — for its fonts (the spec's CSP has no `data:` in
`font-src`) or for a link back into the app — and the build does not know it. With `base`,
the build writes `base.placeholder` wherever the address goes, and `resources/read`
replaces it with `base.origin()`. That origin also joins every view's
`csp.resourceDomains`, so the CSP allows exactly the address the HTML asks for.

The spec maps `resourceDomains` to `script-src` as well, so a view may run scripts from
that origin. `base` is sound only while the origin serves no script a stranger can write —
user uploads only with `nosniff` and a content type that is no script.

The version is hashed before the replacement: `tools/list` never calls `origin()`, and the
same build has the same URI under every deployment. What `origin()` returns passes
`plainOrigin`, which throws for anything but `http(s)://host[:port]` — the value lands in
an attribute and in unquoted CSS `url(…)`, where a quote, a parenthesis, a path or
credentials would break or leak. When `origin()` throws or returns anything else,
`resources/list` and `resources/read` answer `-32603` and the console says why — the
sentence on the wire does not quote the value.

## View: `startView`

The view's entry calls `startView` once. It connects to the host, writes what the host
sends into a state object of yours, reports the document's height and applies the host's
theme; your `mount` renders.

<!-- typecheck -->

```ts
import { startView, type ViewState } from '@urbicon-ui/mcp-app/view';
import { toolCaller } from '@urbicon-ui/mcp-app/view/tools';

const state: ViewState = {
  phase: 'connecting',
  input: null,
  result: null,
  problem: null,
  context: {}
};

startView({
  appInfo: { name: 'notes', version: '1.0.0' },
  appCapabilities: { availableDisplayModes: ['inline'] },
  state,
  messages: {
    cancelled: (reason) => (reason ? `Cancelled: ${reason}` : 'Cancelled.'),
    hostSilent: 'The host does not answer.',
    failed: 'That did not work.'
  },
  callsTools: true,
  tools: toolCaller,
  mount({ state, bridge, tools }) {
    // Any framework renders here; plain DOM for the sketch. `tools` is typed as
    // present because callsTools is true.
    const pin = document.createElement('button');
    pin.textContent = 'Pin';
    pin.onclick = async () => {
      await tools.callTool('pin_note', { id: state.input?.id });
      await bridge.updateModelContext({ content: [{ type: 'text', text: 'The note is pinned.' }] });
    };
    document.body.append(pin);
  }
});
```

`state` can be any object with these five writable fields: a plain object, a class whose
setters re-render, or a class of Svelte `$state` fields — `startView` only assigns. A
Svelte component that takes it as a prop binds it under another name,
`let { state: view } = $props()`: beside a local binding `state`, Svelte reads `$state(0)`
as a subscription to a store `state` (`store_rune_conflict`).

| `state.phase` | When                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `connecting`  | until the handshake (`ui/initialize`) stands                                                                              |
| `waiting`     | after the handshake or the first `tool-input`; `state.input` holds the call's arguments                                   |
| `ready`       | `tool-result` arrived; `state.result` holds it                                                                            |
| `failed`      | an error result (`state.problem` is its first text block, or `messages.failed`) — or no handshake (`messages.hostSilent`) |
| `cancelled`   | `tool-cancelled`; `state.problem` is `messages.cancelled(reason)`                                                         |

`state.context` is the host context, merged across `host-context-changed`. The view's
words come from `messages`, in the view's language; the package's own sentences (errors,
logs) are English.

### What a view gets

`mount` receives `{ state, bridge, tools? }`, and `startView` returns `{ bridge }` — the
same `bridge`:

- **`bridge` is a `ViewBridge`**, not the bridge: `sendMessage`, `updateModelContext`,
  `openLink`, `requestDisplayMode`, `log`, `hostContext`, `connected` — each a fixed method
  name, no free `request`. It is a separate object, so what the type hides is not on it at
  runtime either; `startView` checks the mounted object with `assertViewReach` and throws if
  it reaches further.
- **`tools` exists exactly when `callsTools` is `true`.** `callsTools: true` requires
  `tools`, `callsTools: false` forbids it — in the type and, at runtime, loudly and before
  the bridge listens; a `callsTools` that is not a boolean stops the view as well.

A tool's `"app"` visibility holds for every view of the server, so that a view without
`callsTools` changes nothing rests on the view's code, not on the host. The package's
part: of everything a view can import, one module writes `tools/call` —
`@urbicon-ui/mcp-app/view/tools`, a subpath of its own. The app's part: forbid that one specifier everywhere except in the entry of a
view that calls tools, **and** scan the view code for the literal `tools/call` —
`createBridge` (below) keeps a free `request`. Both are a heuristic against an accident,
not a guarantee: `'tools' + '/call'` passes either.

`ViewSpec.callsTools` lets one record carry both sides: the catalog ignores it, and the
view's entry passes it on as `callsTools`. A file of view specs that view and server share
takes `ViewSpec` with `import type` and nothing else from `@urbicon-ui/mcp-app/server`: any
of its values in the view's bundle, a constant included, brings `node:crypto` along, which
the view's bundler then has to polyfill, stub or refuse.

### The bridge underneath

`startView` is built from parts that are exported for an entry of your own:

- `createBridge(transport, options)` — JSON-RPC 2.0 to the host: the handshake
  (`ui/initialize`, then `ui/notifications/initialized`), requests with a timeout
  (`DEFAULT_TIMEOUT_MS`), the host's notifications, `ping` and `ui/resource-teardown`
  answered, and `ui/message` with `content` as an **array** of content blocks — the SDK's
  form; the spec text shows an object, and Claude rejects it.
- `windowTransport(window)` — `postMessage` to `window.parent`, and only `window.parent` is
  heard (checked by `event.source`: a sandboxed view does not know its host's origin).
- `autoResize(bridge, document, window)` and `createSizeReporter(env)` — the document's
  height to the host, at most once per frame and only on a real change.
- `applyTheme(root, context)` — `hostContext.theme` as `color-scheme` on the root, which is
  what `light-dark()` follows.
- `readBaseMeta(document, metaName)` — the app's origin from a `<meta>` the server filled
  in (see [`base`](#the-apps-origin-in-the-view)), or `null` when it was not replaced.
- `problemOf(result, fallback)` — the first text block of an error result.

**Errors are loud.** A host's error answer rejects with a `BridgeError` (`code`, `data`, and
`reason` — the host's sentence alone, fit to show). An answer to an unknown id, a malformed
message, a throwing handler and a transport that throws go to `onError`; under `startView`
that is the console plus `notifications/message` to the host, and your `onError` in addition.
Only what is not JSON-RPC at all is ignored — extensions and developer tools use
`postMessage` too.

## Building the views: `buildViews`

A host fetches a view with `resources/read` and writes it into a sandbox on an origin of
its own, so whatever the view loaded from elsewhere would need the CSP's permission and,
for a module script, a stylesheet or a font, a CORS answer from your app. `buildViews`
therefore writes **one HTML file per view**, with the script and the CSS inside it, and
fails the build when anything in it still points at a file.

<!-- typecheck -->

```ts
import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { buildViews } from '@urbicon-ui/mcp-app/vite';

// A component library's dist/ — its index.css brings `@source '..'` for all of it.
const blocks = dirname(
  dirname(realpathSync(fileURLToPath(import.meta.resolve('@urbicon-ui/blocks/style/index.css'))))
);

const built = await buildViews({
  root: 'src/views', // note.html, note.ts, app.css
  outDir: 'src/views/dist',
  views: ['note'],
  plugins: [tailwindcss(), svelte()],
  base: { placeholder: '__NOTES_BASE__', meta: 'notes:base', fonts: '/views/fonts/' },
  tailwind: { css: 'src/views/app.css', exclude: [blocks], witness: 'bg-surface' }
});
for (const view of built.views) {
  console.log(`${view.name}.html ${view.bytes} B, gzip ${view.gzipBytes} B`);
}
```

The package imports neither Tailwind nor Svelte: whatever the views need — Tailwind,
Svelte, an alias — comes in `plugins`. What the build holds to:

- **The fonts stay files**, in `<outDir>/fonts/`. The spec's CSP has no `data:` in
  `font-src`, so a host that follows it blocks an embedded font. The CSS names each font
  as `base.placeholder + base.fonts + file` — the placeholder the catalog's `base` replaces
  with your origin at `resources/read`, and the origin it adds to `resourceDomains`. Your
  app serves `<outDir>/fonts/` under `base.fonts` with `Access-Control-Allow-Origin: *`. A
  view with a font and no `base.fonts` does not build.
- **`light-dark()` stays as written.** The CSS target is `CSS_TARGET`, the first browser
  versions with `light-dark()`. Below it, Lightning CSS rewrites the function into
  variables that only a `color-scheme` declared in CSS switches, and `applyTheme` sets the
  scheme from a script.
- **A dynamic import is embedded too** — the view is one chunk — and runs through Vite's
  preload helper. The inlining waits for Vite to fill in the helper's placeholder and
  stops the build if one is left; `base.placeholder` may not look like one
  (`__VITE_…__`).
- **With `tailwind`, Tailwind reads each view's own script**, not the libraries'. A
  first pass writes each view's script, unminified, into a fresh temporary directory
  (removed after the build); the second turns the `exclude` directories off
  (`@source not`) and lets Tailwind read exactly that script — what the bundler put into
  the view, after tree-shaking. That script keeps none of the code's comments (JSDoc,
  legal, annotations; Rolldown's module-path lines stay and name no utility), so a
  library's JSDoc adds no class — a comment edit would otherwise change the CSS, and with it the view's
  URI. The CSS file names no source
  itself (`@import 'tailwindcss' source(none)`), and the build appends both lines.
  Tailwind treats a glob that finds nothing as no error, so `witness` names a class every
  view uses: the build fails when the finished CSS has no rule for it.
- `base.meta` puts `<meta name="<meta>" content="<placeholder>">` into every view, for
  `readBaseMeta`.
- **Nothing may still point at a file.** The build stops on a relative `src` or `href` in
  the HTML, on any file but a font left beside it, and on a `url()` in the CSS unless it is
  `data:`, an absolute URL, a fragment, a font as the build names it, or under
  `base.placeholder`. Vite leaves a `url()` it cannot resolve as written and only warns.
- **In `outDir` the build removes only what it wrote.** It keeps a list there,
  `.mcp-app-build.json` — each view's HTML and fonts. After a successful build it removes
  what the previous list names and this build did not write again: nothing without a list,
  nothing after a failed build, `fonts/` only when the build made it and it is empty. It
  writes over no file the list does not name: a `<view>.html` another build left in
  `outDir` stops it until you remove that build's output once — its `<view>.html` files
  and `fonts/`, or fonts of it stay behind for good. A symbolic link where it would write
  or remove, a file it would write over or remove that is one of its sources, a
  `<view>.html` with another hard link, and an `outDir` that is `root` stop it too, before
  it does. Vite's `public/` is not copied
  (`publicDir: false`).

`viewConfig(view, options, mode, scanDir)` is the Vite config of a single pass, for a
build loop of your own — with `tailwind`, both passes need `scanDir`, an existing
directory for the scan pass's scripts. Such a loop keeps no list and removes nothing.
`inlineIntoHtml` is the plugin that does the inlining and its checks.

## Testing: `wireProblem`

`wireProblem(message, answers?)` returns what a host would object to in a JSON-RPC message,
or `null` when it passes. It looks the method up among the request, notification and result
schemas of `@modelcontextprotocol/ext-apps` and the MCP SDK; for an answer, `answers` names
the method of the request it answers.

The objection is a JSON-RPC error object, `{ code, message }`, so a test host can answer a
request with it as it is. The code says what kind of objection it is:

| `code`   | When                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| `-32601` | no schema knows the method — of a request, a notification, or the request answered |
| `-32602` | the method's schema rejects the params, or the result of an answer                 |
| `-32600` | not a JSON-RPC message, a broken envelope, or an answer whose request is not named |

<!-- typecheck -->

```ts
import { wireProblem } from '@urbicon-ui/mcp-app/testing';

const objectForm = {
  jsonrpc: '2.0',
  id: 1,
  method: 'ui/message',
  params: { role: 'user', content: { type: 'text', text: 'Pin it.' } }
};

wireProblem(objectForm);
// → { code: -32602,
//     message: 'Invalid params for ui/message: content: Invalid input: expected array, received object' }
wireProblem({ jsonrpc: '2.0', id: 1, result: {} }, 'ping');
// → null
```

Run it over every message a view sends in a test — this package does so for every message
its bridge can send. A method no schema knows is a finding, not a pass.

## Testing in a host: `@urbicon-ui/mcp-app/testing/host`

A real host cannot be scripted, so this one does what a **web host** does after the spec,
driven by Playwright: the spec for the sequence, the SDK's schemas for the wire. It runs
under Bun and starts no server of yours — you give it a **running** endpoint, built or in
development, and the parts only your app knows.

`playwright-core` brings no browser. The host launches headless Chromium in the build
your `playwright-core` version expects — without it, the launch fails with "Executable
doesn't exist". Install it once where `playwright-core` is installed (in CI, Playwright's
container image of the same version brings it):

```sh
bunx playwright-core install --only-shell chromium
```

<!-- typecheck -->

```ts
import { readFileSync } from 'node:fs';
import {
  FAIL_NEXT_MESSAGE,
  type HostScenario,
  printReports,
  type RunHostOptions,
  runHost,
  serverInfo,
  versionReport
} from '@urbicon-ui/mcp-app/testing/host';

const endpoint = {
  url: 'http://127.0.0.1:5173/mcp',
  headers: { authorization: `Bearer ${process.env.MCP_TOKEN}` }
};

const options = {
  endpoint,
  tool: 'show_note',
  args: { id: 'n1' },
  expect: {
    appInfo: await serverInfo(endpoint),
    appCapabilities: { availableDisplayModes: ['inline'] }
  },
  // An origin in the view's resourceDomains, a tool on ["model"] with harmless
  // arguments, a token of the view that shares a host variable's name, and the
  // element whose background follows the theme.
  allowedOrigin: 'http://127.0.0.1:5173',
  modelOnly: { tool: 'delete_note', args: { id: crypto.randomUUID() } },
  hostVariables: { variables: ['--color-text-primary'], selector: 'h1' },
  theme: { surface: 'main' }
} satisfies RunHostOptions;

const scenario: HostScenario = {
  async afterResult(o) {
    const title = await o.view.locator('h1').textContent();
    o.check('notes:title', 'the view shows the note', title === 'Groceries', String(title));

    await o.host.failNext('pin_note');
    await o.view.getByRole('button', { name: 'Pin' }).click();
    const shown = await o.view.getByRole('alert').textContent();
    o.check(
      'notes:pin-failed',
      'a failed pin shows the host’s sentence',
      shown === FAIL_NEXT_MESSAGE,
      String(shown)
    );
  }
};

const { ok, total } = printReports([
  [
    'the versioned URI',
    await versionReport({
      endpoint,
      tool: 'show_note',
      uri: 'ui://notes/note',
      html: readFileSync('src/views/dist/note.html', 'utf8'),
      withoutView: 'pin_note'
    })
  ],
  ['note · 700 px', await runHost(options, scenario)],
  ['note · 390 px', await runHost({ ...options, width: 390 }, scenario)],
  ['note · redrawn from history', await runHost({ ...options, replay: true }, scenario)]
]);
console.log(`${total} checks`);
process.exit(ok ? 0 : 1);
```

What the host does on its own:

- **Two origins.** The host page runs on `localhost`, the view in a sandbox proxy on
  `127.0.0.1` ("The Host and the Sandbox MUST have different origins"), the CSP as the
  proxy's header, built from `_meta.ui.csp` after the spec (`buildCsp`), with a
  `report-uri`.
- **Your headers stay in the process.** The page reaches your server through the host's
  `/rpc`, which takes requests from the host page's origin only — otherwise any page in the
  same browser could send requests with your token, by a plain `text/plain` POST.
- **The wire in both directions** passes `wireProblem`, bundled for the page. A view
  request that fails is answered with exactly that error object, as a host validating with
  the SDK answers it, and is not carried out.
- **Visibility is enforced**: a `tools/call` from the view for a tool without `"app"`, or
  one `tools/list` does not name, is refused, and without `_meta.ui.visibility` the spec's
  default `["model", "app"]` holds — which is why `modelOnly.args` must be harmless if
  they were forwarded. A refusal of a call your view makes itself is a finding.
- **The result is latched** until `beforeResult` has looked at the view's waiting state;
  with `replay: true`, `tool-input` and `tool-result` arrive in the same tick instead, the
  way a host redraws a chat from history.

`runHost` opens the host, runs `beforeResult`, lets the result go, runs `afterResult`, then
the generic checks below, and closes. Each check has a stable `id` — the one to name in a
control run that breaks your app on purpose and expects exactly those checks to fail.

| `id`                                                | What fails it                                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `tool-listed`, `mime-type`                          | the tool has no `_meta.ui.resourceUri`; `resources/read` answers another `mimeType`                   |
| `handshake`, `initialized`, `sandbox`               | `ui/initialize` carries another `appInfo`, protocol version or `appCapabilities`; no `initialized`    |
| `result-sent`                                       | the host could not call the tool                                                                      |
| `size-reported`, `size-fits`                        | no `size-changed`; the frame is not the `<body>`'s height, the view scrolls or is wider than the host |
| `host-variables-root`, `-collision`, `-control`     | the view applies `hostContext.styles` under their own names; the control cannot see a collision       |
| `theme`                                             | `color-scheme` does not follow `host-context-changed`, or `theme.surface` keeps its background        |
| `visibility`, `visibility-bridge-loud`              | the host forwards `modelOnly.tool`; the bridge swallows an answer it never asked for                  |
| `oracle-csp`, `oracle-allowed`, `oracle-pageerror`  | the probes: a blocked image, an allowed one and a thrown error did not arrive as such                 |
| `rpc-origin`                                        | `/rpc` forwards a request from another origin, or from none                                           |
| `teardown`, `console`, `csp-reports`, `page-errors` | no answer to `ui/resource-teardown`; any console error or warning, CSP violation or page error        |
| `log-errors`                                        | a `notifications/message` of the view at level `error`, `critical`, `alert` or `emergency`            |
| `refused-calls`                                     | the host refused a `tools/call` of the view — a tool without `"app"`, or one not in `tools/list`      |
| `wire`, `wire-control`                              | a message fails the schemas; the bundled schema no longer rejects `ui/message` with an object         |

What a probe produces — the blocked image, the thrown error, the host's refusal of the
probe's call and the bridge's line and log about the foreign answer — leaves the findings
by its signature (`takeLines`, the request's id), and nothing else does.

`versionReport` checks the view's URI without a browser; the version is the SHA-256 of the
built `html` you pass, computed by the host and not by the catalog. Its checks:

| `id`                    | What fails it                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `version-uri`           | the tool lacks either key or names another URI than `<uri>/<version>`, or the view's URIs in `resources/list` are not exactly that one |
| `version-without-view`  | the `withoutView` tool is missing or carries a URI                                                                                     |
| `version-read-tolerant` | `resources/read` of the version, a foreign version and the bare URI does not return the same HTML                                      |
| `version-unknown`       | a view name the server does not know is not answered with `-32002`                                                                     |

The pieces are exported one by one — `openHost`, `checkSize`, `checkHostVariables`,
`checkTheme`, `probeVisibility`, `probeOracle`, `probeRpc`, `closingChecks` — for a run in
another order. `o.host` drives the page (`setTheme`, `failNext`, `releaseResult`, `replay`,
`teardown`), `o.state()` reads what the host saw, and `o.responses` holds what
`watchResponses` picked — your fonts, with status and CORS header.
`failNext(name, message?)` fails the view's next `tools/call` of `name` with `-32000` and
`message`, or `FAIL_NEXT_MESSAGE` without one — either way a sentence the scenario knows.

**What it does not prove** is how a real host behaves: it is this package's reading of the
spec. Its own test, `bun run test:host` in this package, drives it against a fixture server
and a view built with `buildViews`; `bun run test:host:controls` then breaks the fixture in
seven ways and expects each run red at exactly the checks it names.
