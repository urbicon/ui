# Your first MCP App view

An MCP App view is an HTML page your MCP server ships with a tool, and a host such as Claude
shows it in place of the tool's text result: a card for a record, a form to confirm, a chart.
Here you build a notes server whose `show_note` tool appears as a card with a Pin button,
write the card in Svelte with `@urbicon-ui/blocks`, build it, test it in a host, and connect
it to Claude.

```sh
mkdir notes && cd notes
bun add @urbicon-ui/mcp-app @urbicon-ui/blocks svelte
bun add -d vite @sveltejs/vite-plugin-svelte tailwindcss @tailwindcss/vite
# only for the test at the end
bun add -d @modelcontextprotocol/ext-apps@1.7.5 @modelcontextprotocol/sdk playwright-core
```

Every command on this page runs in the `notes` folder. `bun add` writes the `package.json`,
and nothing else needs configuring: no `tsconfig.json`, no `svelte.config.js`. `ext-apps` is
pinned exactly: the test checks every message with that version's schemas, and Claude rejects
a malformed `ui/message` with the same sentence.

When the model calls `show_note`, the host finds a `ui://` URI in the tool's `_meta`, reads
the view's HTML from your server with `resources/read` and shows it in a sandboxed iframe. It
then passes the call's arguments and result to the view. When someone clicks Pin, the view
asks the host to call `pin_note`, and the host forwards the call to your server.

If you already have a server, it keeps its own JSON-RPC handling and takes three parts of
the view catalog instead of the server below: `views.capabilities` in its `server/discover`
answer, `views.toolMeta(…)` as each tool's `_meta`, and `views.handle(method, params)` for
the methods it does not handle itself, which answers `resources/*` and returns `null` for the
rest ([the view catalog](../README.md#server-the-view-catalog)). The view and its build stay
as they are below.

You will write these files, and the build writes `dist/`:

```text
notes/
├── build-views.ts            builds the view
├── test-host.ts              runs the view in a test host
├── dist/mcp-app/note.html    the built view, one file
└── src/
    ├── mcp.ts                the MCP endpoint: notes, tools, view catalog
    ├── server.ts             serves the endpoint with Bun
    └── mcp-app/
        ├── views.ts          what the server, the view and the build share
        ├── note.html         the view's page
        ├── note.ts           the view's entry
        ├── state.svelte.ts   the state startView writes
        ├── NoteView.svelte   the card
        └── app.css
```

## The server

`views.ts` describes the view once, for the server, the view's entry and the
build:

<!-- typecheck -->

```ts
import type { ViewSpec } from '@urbicon-ui/mcp-app/server';

export const APP_INFO = { name: 'notes', version: '1.0.0' };

export const VIEWS = {
  note: {
    title: 'Note',
    description: 'One note as a card, with a button to pin it.',
    prefersBorder: true,
    callsTools: true
  }
} as const satisfies Record<string, ViewSpec>;

// A stand-in for the app's address in the built view; the server writes the address in.
export const BASE_PLACEHOLDER = '__NOTES_BASE__';
```

The view bundles this file too, so it takes only `import type` from
`@urbicon-ui/mcp-app/server`: a value from there would bring `node:crypto` into the view.
The placeholder is explained under Build the view.

`mcp.ts` is the endpoint. The catalog answers what a host asks about the view, the
dispatcher handles JSON-RPC and calls your `call`, and `POST` turns a request into an answer:

<!-- typecheck -->

```ts
import { readFileSync } from 'node:fs';
import {
  createDispatcher,
  createViewCatalog,
  INVALID_PARAMS,
  type Outcome
} from '@urbicon-ui/mcp-app/server';
import { APP_INFO, BASE_PLACEHOLDER, VIEWS } from './mcp-app/views';

interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
}

const notes = new Map<string, Note>([
  ['n1', { id: 'n1', title: 'Groceries', body: 'Oat milk, lemons, rye bread.', pinned: false }]
]);

// Where the notes web app runs, which the view links to. This server answers /mcp only.
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const NOTE_HTML = readFileSync(new URL('../dist/mcp-app/note.html', import.meta.url), 'utf8');

const views = createViewCatalog({
  server: 'notes', // the view's URI: ui://notes/note/<version>
  views: VIEWS,
  html: () => NOTE_HTML,
  base: { placeholder: BASE_PLACEHOLDER, origin: () => APP_URL }
});

const text = (value: string) => [{ type: 'text', text: value }];

function call(name: string, args: unknown): Outcome {
  const { id, pinned } = (args ?? {}) as { id?: unknown; pinned?: unknown };
  if (name === 'list_notes') {
    const list = [...notes.values()].map((note) => ({ id: note.id, title: note.title }));
    return { result: { content: text(JSON.stringify(list)) } };
  }
  if (name !== 'show_note' && name !== 'pin_note') {
    return { error: { code: INVALID_PARAMS, message: `Unknown tool: ${name}` } };
  }
  const note = typeof id === 'string' ? notes.get(id) : undefined;
  if (!note) return { result: { content: text(`No note ${String(id)}.`), isError: true } };
  if (name === 'pin_note') note.pinned = pinned !== false;
  return {
    result: {
      // The card reads `structuredContent`; `content` is the text for the model.
      content: text(`${note.title}${note.pinned ? ' (pinned)' : ''}: ${note.body}`),
      structuredContent: { note }
    }
  };
}

const dispatcher = createDispatcher({
  serverInfo: APP_INFO,
  views,
  tools: () => [
    {
      name: 'list_notes',
      description: 'Lists the notes, each with its id and title.',
      inputSchema: { type: 'object' },
      annotations: { readOnlyHint: true },
      _meta: views.toolMeta()
    },
    {
      name: 'show_note',
      description: 'Shows one note to the user as a card.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      annotations: { readOnlyHint: true },
      _meta: views.toolMeta({ view: 'note' })
    },
    {
      name: 'pin_note',
      description: 'Pins a note, or unpins it with pinned: false.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, pinned: { type: 'boolean' } },
        required: ['id']
      },
      _meta: views.toolMeta({ callableFromView: true })
    }
  ],
  call
});

export function POST(request: Request): Promise<Response> {
  return dispatcher.handle(request);
}
```

Each tool's `_meta` comes from `views.toolMeta`, and it decides who may call the tool:

- `{ view: 'note' }` puts the view's URI on `show_note`, so a host shows its result in the
  view.
- `{ callableFromView: true }` sets `visibility: ["model", "app"]`: the model and the view may
  both call `pin_note`.
- No argument sets `["model"]`: only the model calls `list_notes`.

Give every tool one of the three. A tool without `visibility` is open to every view of the
server, a `delete_note` included ([the view catalog](../README.md#server-the-view-catalog)).

`call` may also return a promise, for tools that wait on a database. The server reads the
built HTML at startup: build the view before you start it, and restart it after each build.
The example has no notes web app at `APP_URL`, so the card's Open in Notes link leads nowhere
until yours runs there.

`dispatcher.handle` speaks MCP 2026-07-28: it reads the request, checks the protocol version
and headers a client sends, and answers with the status the revision names for each case
([the dispatcher](../README.md#server-the-dispatcher)). `POST` takes a web `Request` and
returns a `Response`, so it fits any server built on those. With Bun, `server.ts` is all that
is left:

```ts
import { POST } from './mcp';

Bun.serve({ port: 3000, routes: { '/mcp': POST } });
console.log('MCP endpoint at http://localhost:3000/mcp');
```

## The view

The view is a page of its own, built with Vite. `note.html` is named after the view's key in
`VIEWS`, which is how the build finds it, and loads the entry:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Note</title>
  </head>
  <body>
    <script type="module" src="./note.ts"></script>
  </body>
</html>
```

`startView` writes what the host sends into a state object of yours. In `state.svelte.ts`, a
class with Svelte `$state` fields re-renders the view on
every write:

```ts
import type { CallToolResult, HostContext, Phase, ViewState } from '@urbicon-ui/mcp-app/view';

export class NoteState implements ViewState {
  phase = $state<Phase>('connecting');
  // startView assigns a new object each time, so these three need no deep proxy.
  input = $state.raw<Record<string, unknown> | null>(null);
  result = $state.raw<CallToolResult | null>(null);
  problem = $state<string | null>(null);
  context = $state.raw<HostContext>({});
}
```

`note.ts` calls `startView` once:

<!-- typecheck -->

```ts
/// <reference types="vite/client" />
import './app.css';
import { startView } from '@urbicon-ui/mcp-app/view';
import { toolCaller } from '@urbicon-ui/mcp-app/view/tools';
import { mount as mountComponent } from 'svelte';
import NoteView from './NoteView.svelte';
import { NoteState } from './state.svelte';
import { APP_INFO, VIEWS } from './views';

startView({
  appInfo: APP_INFO,
  appCapabilities: { availableDisplayModes: ['inline'] },
  state: new NoteState(),
  messages: {
    cancelled: (reason) => (reason ? `Cancelled: ${reason}` : 'Cancelled.'),
    hostSilent: 'The host does not answer.',
    failed: 'That did not work.'
  },
  callsTools: VIEWS.note.callsTools,
  tools: toolCaller,
  mount(props) {
    mountComponent(NoteView, { target: document.body, props });
  }
});
```

With `callsTools: true`, `startView` requires `tools: toolCaller` and hands the component a
`tools` prop; with `false`, the component gets no `tools`
([what a view gets](../README.md#what-a-view-gets)). `messages` are the sentences `startView`
writes into `state.problem` when the call is cancelled, the handshake with the host fails,
or the result is an error without text of its own.

The card, `NoteView.svelte`, gets `{ state, bridge, tools }`:

```svelte NoteView.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { Alert, Badge, Button } from '@urbicon-ui/blocks';
  import {
    BridgeError,
    type CallToolResult,
    problemOf,
    REQUEST_TIMEOUT,
    readBaseMeta,
    type ViewProps,
    type ViewState
  } from '@urbicon-ui/mcp-app/view';

  interface Note {
    id: string;
    title: string;
    body: string;
    pinned: boolean;
  }

  // Bound as `view`: beside a binding named `state`, Svelte reads `$state` as a store.
  let { state: view, bridge, tools }: ViewProps<ViewState, true> = $props();

  const noteOf = (result: CallToolResult | null): Note | null =>
    (result?.structuredContent?.note as Note | undefined) ?? null;

  // The note as pin_note last returned it; until then, the result of show_note.
  let changed = $state.raw<Note | null>(null);
  const note = $derived(changed ?? noteOf(view.result));

  let busy = $state(false);
  let problem = $state<string | null>(null);

  // The app's address, written into the view by the server.
  let app = $state<string | null>(null);
  onMount(() => {
    app = readBaseMeta(document, 'notes:base');
  });

  function errorText(error: unknown): string {
    // The host may still carry a call out that timed out: its outcome is unknown, not failed.
    if (error instanceof BridgeError && error.code === REQUEST_TIMEOUT) {
      return 'The host did not answer in time. Ask for the note again to see whether it is pinned.';
    }
    // A BridgeError carries the host's own sentence in `reason`.
    return error instanceof BridgeError && error.reason ? error.reason : 'That did not work.';
  }

  async function pin(shown: Note): Promise<void> {
    busy = true;
    problem = null;
    try {
      const result = await tools.callTool('pin_note', { id: shown.id, pinned: !shown.pinned });
      if (result.isError) {
        problem = problemOf(result, 'That did not work.');
        return;
      }
      changed = noteOf(result);
      // Each update replaces the one before: state the note's state, not the click.
      await bridge.updateModelContext({
        content: [
          {
            type: 'text',
            text: `The note "${shown.title}" is ${shown.pinned ? 'not pinned' : 'pinned'}.`
          }
        ]
      });
    } catch (error) {
      problem = errorText(error);
    } finally {
      busy = false;
    }
  }

  async function open(shown: Note): Promise<void> {
    problem = null;
    try {
      await bridge.openLink(`${app}/notes/${shown.id}`);
    } catch (error) {
      problem = errorText(error);
    }
  }
</script>

<article class="bg-surface-base text-text-primary flex flex-col gap-3 p-4">
  {#if note}
    <div class="flex items-center gap-2">
      <h1 class="text-lg font-semibold">{note.title}</h1>
      {#if note.pinned}
        <Badge purpose="status" variant="soft">Pinned</Badge>
      {/if}
    </div>
    <p class="text-text-secondary text-sm">{note.body}</p>
    <div class="flex gap-2">
      <Button size="sm" loading={busy} onclick={() => pin(note)}>
        {note.pinned ? 'Unpin' : 'Pin'}
      </Button>
      {#if app}
        <Button size="sm" variant="outlined" onclick={() => open(note)}>Open in Notes</Button>
      {/if}
    </div>
  {:else}
    <p class="text-text-secondary text-sm">{view.problem ?? 'Loading the note…'}</p>
  {/if}
  {#if problem}
    <Alert intent="danger" size="sm">{problem}</Alert>
  {/if}
</article>
```

- `ViewProps<ViewState, true>` takes any object with the five `ViewState` fields as `state`,
  and `true` says that `tools` is there.
- `view.result` is the result of `show_note` once the host sends it. When the call fails or is
  cancelled, `view.problem` holds the sentence to show
  ([`state.phase`](../README.md#view-startview) says which step the call is at).
- `tools.callTool` resolves with the tool's result, so a tool that fails, like `pin_note` for
  a missing note, comes back with `isError: true`. The promise rejects with a `BridgeError`
  when the host refuses the call or your server answers it with an `error`, and with
  `code: REQUEST_TIMEOUT` after 60 seconds without an answer.
- `bridge.updateModelContext` does not make the model reply: a host usually passes the context
  on with the user's next message. `bridge.sendMessage` sends a message in the user's name
  instead, and the model answers it.
- The view runs in a sandboxed iframe, so a link into your app opens through the host, with
  `bridge.openLink`. The app's address comes from a `<meta>` the server fills in (next
  section). `readBaseMeta` returns `null` without it, and the button stays hidden.

In the host, the card takes the host's light or dark theme: `startView` sets `color-scheme`
from it, and blocks' colours are `light-dark()` tokens. Everything else is blocks' defaults,
and the text uses Tailwind's system font stack, so the view loads no font file. The
components and their tokens are documented at [ui.urbicon.de/blocks](https://ui.urbicon.de/blocks).

## Build the view

A host writes the view into a sandbox on an origin of its own, where a script or stylesheet
loaded from your app would need the CSP's permission and a CORS answer. `buildViews`
therefore writes each view as one HTML file, its script and CSS inside. `build-views.ts`
calls it:

<!-- typecheck -->

```ts
import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { buildViews } from '@urbicon-ui/mcp-app/vite';
import { BASE_PLACEHOLDER, VIEWS } from './src/mcp-app/views';

// blocks' dist/: its index.css would have Tailwind scan all of blocks; `exclude` turns that off.
const blocks = dirname(
  dirname(realpathSync(fileURLToPath(import.meta.resolve('@urbicon-ui/blocks/style/index.css'))))
);

const built = await buildViews({
  root: 'src/mcp-app',
  outDir: 'dist/mcp-app',
  views: Object.keys(VIEWS),
  plugins: [tailwindcss(), svelte()],
  base: { placeholder: BASE_PLACEHOLDER, meta: 'notes:base' },
  tailwind: { css: 'src/mcp-app/app.css', exclude: [blocks], witness: 'bg-surface-base' }
});
for (const view of built.views) {
  console.log(`${view.name}.html ${view.bytes} B, gzip ${view.gzipBytes} B`);
}
```

The Vite plugins are yours to bring, Tailwind and Svelte here. With `tailwind`, Tailwind
reads the view's bundled script, after tree-shaking, and `exclude` turns off the scan of all
of blocks that its `index.css` asks for. The CSS then holds the classes the view uses, not
every class in the library. `witness` is a class every view uses: the build fails when the CSS
has no rule for it. `app.css` names no sources of its own:

```css
@import 'tailwindcss' source(none);
@import '@urbicon-ui/blocks/style/index.css';
```

The build does not know where your app will run. `base.meta` writes
`<meta name="notes:base" content="__NOTES_BASE__">` into the view, under the name `NoteView`
reads, so the two must match. When a host reads the view, the catalog's `base` replaces the
placeholder with `APP_URL` and adds that origin to the view's CSP, so the view may load images
and fonts from it ([the app's origin](../README.md#the-apps-origin-in-the-view)).

Build the view, then start the server:

```sh
bun build-views.ts
bun src/server.ts
```

Ask the server for its tools, as a host does. MCP 2026-07-28 has no handshake: every request
names the protocol version in its body and its headers, and the client's capabilities in its
body:

```sh
curl -s localhost:3000/mcp -H 'content-type: application/json' \
  -H 'mcp-protocol-version: 2026-07-28' -H 'mcp-method: tools/list' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":{
    "io.modelcontextprotocol/protocolVersion":"2026-07-28",
    "io.modelcontextprotocol/clientCapabilities":{}}}}'
```

In the answer, the `_meta.ui.resourceUri` of `show_note` is `ui://notes/note/<version>`. The
version is a hash of the built HTML, so it changes whenever a build changes the view, and a
host that keeps views fetches the new one ([versioned URIs](../README.md#versioned-uris)).

## Test it in a host

`@urbicon-ui/mcp-app/testing/host` shows your view the way a web host does, in headless
Chromium driven by Playwright, against your running server. It sends each request as a POST
of MCP 2026-07-28 and reads JSON back, so it needs an endpoint like `POST` above, without
event streams. Install the browser once:

```sh
bunx playwright-core install --only-shell chromium
```

`test-host.ts` runs the view three times: at 700 and 390 px, and once redrawn from history,
the way a host rebuilds a chat:

<!-- typecheck -->

```ts
import { readFileSync } from 'node:fs';
import {
  type HostScenario,
  mcpResult,
  printReports,
  type RunHostOptions,
  runHost,
  versionReport
} from '@urbicon-ui/mcp-app/testing/host';
import { APP_INFO } from './src/mcp-app/views';

const origin = 'http://localhost:3000';
const endpoint = { url: `${origin}/mcp` };

const options = {
  endpoint,
  tool: 'show_note',
  args: { id: 'n1' },
  expect: { appInfo: APP_INFO, appCapabilities: { availableDisplayModes: ['inline'] } },
  allowedOrigin: origin,
  modelOnly: { tool: 'list_notes', args: {} },
  hostVariables: { variables: ['--color-text-primary'], selector: 'h1' },
  theme: { surface: 'article' }
} satisfies RunHostOptions;

const scenario: HostScenario = {
  async afterResult(o) {
    const title = await o.view.locator('h1').textContent();
    o.check('notes:title', 'the view shows the note', title === 'Groceries', String(title));

    await o.view.getByRole('button', { name: 'Pin', exact: true }).click();
    const pinned = await o.view
      .getByText('Pinned', { exact: true })
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false
      );
    o.check('notes:pin', 'Pin pins the note through the host', pinned);

    // Unpin on the server, so the next run finds the note as this one did.
    await mcpResult(endpoint, 'tools/call', {
      name: 'pin_note',
      arguments: { id: 'n1', pinned: false }
    });
  }
};

const { ok, total } = printReports([
  [
    'the versioned URI',
    await versionReport({
      endpoint,
      tool: 'show_note',
      uri: 'ui://notes/note',
      html: readFileSync('dist/mcp-app/note.html', 'utf8'),
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

The options are what only you know about your view:

- `expect`: what the view's `ui/initialize` must carry, compared by value.
- `allowedOrigin`: an origin in the view's CSP. The run loads an image from it, which the CSP
  must allow, and one from elsewhere, which it must block. `base` put `APP_URL` there.
- `modelOnly`: a tool on `["model"]` that the run calls from inside the view, which the host
  must refuse. Its `args` must harm nothing in case a host forwarded the call.
- `hostVariables`: names your CSS defines that the host's style variables use too, and an
  element painted with the first. The view must keep its own values; blocks defines
  `--color-text-primary`, and the `h1` takes its colour.
- `theme.surface`: an element whose background follows the theme. The run switches the
  host's theme and expects that background to change.
- `withoutView` in `versionReport`: a tool that must carry no view URI.

With the server running, `bun test-host.ts` prints every check and exits with 1 when one
fails. `versionReport` compares the view's URI with the built file, without a browser.
`runHost` checks on its own what every view must get right: the handshake, the size, the
theme, visibility, the CSP and every message against the SDK's schemas. The scenario adds what
only your view knows: the title, and a Pin that works in all three runs, the redrawn card
included. What each check catches is listed under
[testing in a host](../README.md#testing-in-a-host-urbicon-uimcp-apptestinghost).

## Connect it to Claude

Claude connects to your server from Anthropic's cloud, so the server needs a URL that the
public internet reaches. Deploy it, or expose port 3000 through a tunnel, and start it
with that origin. The catalog writes `APP_URL` into the view when Claude reads it, so the
build stays as it is:

```sh
APP_URL=https://notes.example.com bun src/server.ts
```

Add `https://notes.example.com/mcp` as a custom connector, following
[Claude's instructions](https://claude.com/docs/connectors/custom/remote-mcp). Custom
connectors are on every plan, one on Free; on Team and Enterprise, an owner adds the connector
for the organisation. Then ask Claude to show your groceries note. Claude shows views on the
web and in the desktop app. A host without MCP Apps shows the tool's `content` instead, which
is why `show_note` returns text as well.

When the text appears but no card, check what a host sees. The `curl` above, sent to the
public URL, must show `_meta.ui.resourceUri` on `show_note`, and `bun test-host.ts` must pass.

This server lets anyone who knows the URL call its tools. Before it holds real notes, find out
who is calling in `POST` (Claude can sign in to a connector with OAuth) and pass the caller
on. With `createDispatcher<Caller>`, `dispatcher.handle(request, caller)` hands it to
`tools(caller)` and `call(name, args, caller)`, which refuse what this caller may not use
([the dispatcher](../README.md#server-the-dispatcher)).

## Where to go from here

- A view with its own fonts: the build keeps them as files, and your app serves them with
  `Access-Control-Allow-Origin: *`
  ([building the views](../README.md#building-the-views-buildviews)).
- Every message your view sends, checked in a unit test the way a host checks it:
  [`wireProblem`](../README.md#testing-wireproblem).
