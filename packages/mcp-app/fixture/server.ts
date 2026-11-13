/**
 * The fixture's MCP server — `Bun.serve`, `createDispatcher` over
 * `createViewCatalog`, three tools: `show_note` renders in the view,
 * `get_note` is granted to views, `remove_note` is the model's alone. It also
 * serves the view's fonts with `Access-Control-Allow-Origin: *`, the header a
 * font from another origin needs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createDispatcher,
  createViewCatalog,
  INVALID_PARAMS,
  type Outcome,
  parseErrorResponse
} from '@urbicon-ui/mcp-app/server';
import { BASE_PLACEHOLDER, FIXTURE_INFO, FONTS_PATH, NOTES, type Note, VIEWS } from './shared.ts';

export interface FixtureServer {
  origin: string;
  endpoint: { url: string };
  stop(): void;
}

export interface FixtureServerOptions {
  /** The build's `outDir`: `note.html` and `fonts/`. */
  dist: string;
  /** Control `no-visibility`: this tool loses `_meta.ui.visibility` in `tools/list`. */
  stripVisibility?: string;
}

const FONT_NAME = /^[\w.-]+\.(?:woff2?|ttf|otf)$/;
const FONT_TYPES: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf'
};

const text = (value: string) => [{ type: 'text', text: value }];

export function startFixtureServer(options: FixtureServerOptions): FixtureServer {
  const html = new Map<string, string>();
  for (const name of Object.keys(VIEWS)) {
    const file = join(options.dist, `${name}.html`);
    if (existsSync(file)) html.set(name, readFileSync(file, 'utf8'));
  }
  const notes = new Map<string, Note>(NOTES.map((note) => [note.id, { ...note }]));
  let origin = '';
  const views = createViewCatalog({
    server: 'fixture',
    views: VIEWS,
    html: (name) => html.get(name),
    base: { placeholder: BASE_PLACEHOLDER, origin: () => origin },
    unbuiltHint: 'bun fixture/host.ts builds it'
  });

  const tools = [
    {
      name: 'show_note',
      description: 'Shows a note as a card.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      _meta: views.toolMeta({ view: 'note' })
    },
    {
      name: 'get_note',
      description: 'Reads a note.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      _meta: views.toolMeta({ callableFromView: true })
    },
    {
      name: 'remove_note',
      description: 'Removes a note.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      _meta: views.toolMeta()
    }
  ].map((tool) => {
    if (tool.name !== options.stripVisibility) return tool;
    const ui = { ...(tool._meta.ui as Record<string, unknown>) };
    delete ui.visibility;
    return { ...tool, _meta: { ...tool._meta, ui } };
  });

  function call(name: string, args: unknown): Outcome {
    const given = (args as { id?: unknown } | null | undefined)?.id;
    const id = typeof given === 'string' ? given : '';
    const note = notes.get(id);
    switch (name) {
      case 'show_note':
      case 'get_note':
        return note
          ? {
              result: { content: text(`${note.title}: ${note.body}`), structuredContent: { note } }
            }
          : { result: { content: text(`No note ${id}.`), isError: true } };
      case 'remove_note':
        if (!note) return { result: { content: text(`No note ${id}.`), isError: true } };
        notes.delete(id);
        return { result: { content: text(`Removed ${note.title}.`) } };
      default:
        return { error: { code: INVALID_PARAMS, message: `Unknown tool: ${name}` } };
    }
  }

  const dispatcher = createDispatcher({
    serverInfo: FIXTURE_INFO,
    tools: () => tools,
    call,
    views
  });

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === '/mcp' && request.method === 'POST') {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json(parseErrorResponse(), { status: 400 });
        }
        const answer = await dispatcher.dispatch(payload);
        return answer === null ? new Response(null, { status: 202 }) : Response.json(answer);
      }
      if (url.pathname.startsWith(FONTS_PATH)) {
        const name = url.pathname.slice(FONTS_PATH.length);
        const file = join(options.dist, 'fonts', name);
        if (!FONT_NAME.test(name) || !existsSync(file)) {
          return new Response('no such font', { status: 404 });
        }
        return new Response(readFileSync(file), {
          headers: {
            'content-type': FONT_TYPES[name.slice(name.lastIndexOf('.') + 1)] ?? 'font/woff2',
            'access-control-allow-origin': '*',
            'cache-control': 'public, max-age=31536000, immutable'
          }
        });
      }
      return new Response('not here', { status: 404 });
    }
  });
  origin = `http://127.0.0.1:${server.port}`;
  return { origin, endpoint: { url: `${origin}/mcp` }, stop: () => server.stop(true) };
}
