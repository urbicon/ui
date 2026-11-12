/**
 * The view catalog without a dispatcher — what a server says about its views
 * in `tools/list`, `resources/list` and `resources/read`.
 *
 * The oracles are not this package: the version is recomputed with WebCrypto
 * (not `node:crypto`), the `_meta.ui` objects are parsed with the ext-apps
 * schemas a host uses, and the results with the SDK's (`wireProblem`).
 */
import * as apps from '@modelcontextprotocol/ext-apps/app-bridge';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { wireProblem } from '../testing/wire.ts';
import {
  createViewCatalog,
  LEGACY_RESOURCE_URI_KEY,
  type Outcome,
  plainOrigin,
  RESOURCE_MIME_TYPE,
  RESOURCE_NOT_FOUND,
  VERSION_LENGTH,
  type ViewSpec
} from './catalog.ts';

const PLACEHOLDER = '__NOTES_BASE__';
const ORIGIN = 'https://notes.example';

/** A built view with the two places a build leaves the app's origin open. */
const NOTE_HTML = `<!doctype html><html><head><meta name="notes:base" content="${PLACEHOLDER}"><style>@font-face{src:url(${PLACEHOLDER}/fonts/a.woff2)}</style></head><body>note</body></html>`;

const VIEWS = {
  note: {
    title: 'Note',
    description: 'One note, as a card.',
    csp: { resourceDomains: ['https://img.example'] },
    prefersBorder: true,
    callsTools: true
  },
  board: { title: 'Board', description: 'All notes — not built in this test.' }
} satisfies Record<string, ViewSpec>;

type Name = keyof typeof VIEWS;

function catalogOf(
  html: (name: Name) => string | undefined = (name) => (name === 'note' ? NOTE_HTML : undefined)
) {
  return createViewCatalog<Name>({
    server: 'notes',
    views: VIEWS,
    html,
    base: { placeholder: PLACEHOLDER, origin: () => ORIGIN },
    unbuiltHint: 'bun run build:views'
  });
}

/** The version the URI must carry — WebCrypto over the built HTML, before the origin goes in. */
async function versionOf(html: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, VERSION_LENGTH);
}

const NOTE_URI = `ui://notes/note/${await versionOf(NOTE_HTML)}`;

function resultOf(outcome: Outcome | null): Record<string, unknown> {
  if (outcome === null) throw new Error('No outcome.');
  if ('error' in outcome) throw new Error(`Error ${outcome.error.code}: ${outcome.error.message}`);
  return outcome.result;
}

function errorOf(outcome: Outcome | null): { code: number; message: string } {
  if (outcome === null || !('error' in outcome)) throw new Error('An error was expected.');
  return outcome.error;
}

type SafeParser = { safeParse(value: unknown): { success: boolean } };

/**
 * The host's schemas for `_meta.ui`. Exported at runtime, but under NodeNext
 * the extensionless re-export in ext-apps' `app-bridge.d.ts` resolves to
 * nothing, so the type does not name them.
 */
const { McpUiToolMetaSchema, McpUiResourceMetaSchema } = apps as unknown as Record<
  'McpUiToolMetaSchema' | 'McpUiResourceMetaSchema',
  SafeParser
>;

/** What a host's schema says about a `_meta.ui` — `null` when it passes. */
function metaProblem(schema: SafeParser, ui: unknown) {
  return schema.safeParse(ui).success ? null : JSON.stringify(ui);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the constants are the SDK’s', () => {
  test('mime type and the flat resource key equal ext-apps’ own', () => {
    expect(RESOURCE_MIME_TYPE).toBe(apps.RESOURCE_MIME_TYPE);
    expect(LEGACY_RESOURCE_URI_KEY).toBe(apps.RESOURCE_URI_META_KEY);
  });
});

describe('_meta of a tool', () => {
  const catalog = catalogOf();

  test('visibility on every tool: ["model"] without a grant', () => {
    expect(catalog.toolMeta()).toEqual({ ui: { visibility: ['model'] } });
    expect(catalog.toolMeta({})).toEqual({ ui: { visibility: ['model'] } });
  });

  test('callableFromView: ["model", "app"], and no resource', () => {
    expect(catalog.toolMeta({ callableFromView: true })).toEqual({
      ui: { visibility: ['model', 'app'] }
    });
  });

  test('with a view: resourceUri with version — and the flat key with the same URI', () => {
    const meta = catalog.toolMeta({ view: 'note' });
    expect(meta).toEqual({
      ui: { resourceUri: NOTE_URI, visibility: ['model'] },
      [LEGACY_RESOURCE_URI_KEY]: NOTE_URI
    });
    expect(catalog.toolMeta({ view: 'note', callableFromView: true }).ui).toEqual({
      resourceUri: NOTE_URI,
      visibility: ['model', 'app']
    });
  });

  test('every shape passes the host’s schema (McpUiToolMetaSchema)', () => {
    const shapes = [
      catalog.toolMeta(),
      catalog.toolMeta({ callableFromView: true }),
      catalog.toolMeta({ view: 'note' }),
      catalog.toolMeta({ view: 'board', callableFromView: true })
    ];
    expect(shapes.map((meta) => metaProblem(McpUiToolMetaSchema, meta.ui))).toEqual([
      null,
      null,
      null,
      null
    ]);
  });

  test('a view the catalog does not have is loud', () => {
    expect(() => catalog.toolMeta({ view: 'gone' as Name })).toThrow('No view "gone"');
  });
});

describe('the version comes from the built HTML', () => {
  test('another HTML, another URI — the same content, the same URI', async () => {
    const changed = NOTE_HTML.replace('<body>note</body>', '<body>note, rebuilt</body>');
    expect(catalogOf().uri('note')).toBe(NOTE_URI);
    // The same content, assembled anew — not an accident of identity.
    expect(catalogOf(() => [...NOTE_HTML].join('')).uri('note')).toBe(NOTE_URI);
    expect(catalogOf(() => changed).uri('note')).toBe(
      `ui://notes/note/${await versionOf(changed)}`
    );
    expect(catalogOf(() => changed).uri('note')).not.toBe(NOTE_URI);
    expect(NOTE_URI).toMatch(new RegExp(`^ui://notes/note/[0-9a-f]{${VERSION_LENGTH}}$`));
  });

  test('tools/list does not ask for the origin — a broken one breaks only the read', () => {
    const catalog = createViewCatalog<Name>({
      server: 'notes',
      views: VIEWS,
      html: () => NOTE_HTML,
      base: {
        placeholder: PLACEHOLDER,
        origin: () => {
          throw new Error('APP_URL is not set');
        }
      }
    });
    expect(catalog.toolMeta({ view: 'note' }).ui).toMatchObject({ resourceUri: NOTE_URI });
    expect(() => catalog.read(NOTE_URI)).toThrow('APP_URL is not set');
  });

  test('an unbuilt view stands without version', () => {
    const catalog = catalogOf();
    expect(catalog.uri('board')).toBe('ui://notes/board');
    expect(catalog.toolMeta({ view: 'board' })[LEGACY_RESOURCE_URI_KEY]).toBe('ui://notes/board');
  });
});

describe('resources/list', () => {
  test('every view, under the URI tools/list issues, with mime type, CSP and border', () => {
    const catalog = catalogOf();
    const { resources } = catalog.list();
    expect(resources).toEqual([
      {
        uri: NOTE_URI,
        name: 'Note',
        description: 'One note, as a card.',
        mimeType: RESOURCE_MIME_TYPE,
        // The view's own domains, then the app's origin — the view loads from it.
        _meta: {
          ui: { csp: { resourceDomains: ['https://img.example', ORIGIN] }, prefersBorder: true }
        }
      },
      {
        uri: 'ui://notes/board',
        name: 'Board',
        description: 'All notes — not built in this test.',
        mimeType: RESOURCE_MIME_TYPE,
        _meta: { ui: { csp: { resourceDomains: [ORIGIN] } } }
      }
    ]);
    expect(catalog.toolMeta({ view: 'note' })[LEGACY_RESOURCE_URI_KEY]).toBe(resources[0]?.uri);
  });

  test('callsTools never reaches the host', () => {
    expect(JSON.stringify(catalogOf().list())).not.toContain('callsTools');
  });

  test('the result and every _meta.ui pass the host’s schemas', () => {
    const listing = catalogOf().list();
    expect(wireProblem({ jsonrpc: '2.0', id: 1, result: listing }, 'resources/list')).toBeNull();
    expect(
      listing.resources.map((r) =>
        metaProblem(McpUiResourceMetaSchema, (r._meta as { ui: unknown }).ui)
      )
    ).toEqual([null, null]);
  });

  test('without base: the CSP as declared, nothing added — and no CSP where none is declared', () => {
    const catalog = createViewCatalog<Name>({
      server: 'notes',
      views: VIEWS,
      html: () => NOTE_HTML
    });
    expect(catalog.list().resources.map((r) => r._meta)).toEqual([
      { ui: { csp: { resourceDomains: ['https://img.example'] }, prefersBorder: true } },
      { ui: {} }
    ]);
  });
});

describe('resources/read', () => {
  test('the HTML with the app’s origin in every place the build left open', () => {
    const { contents } = resultOf(catalogOf().read(NOTE_URI)) as {
      contents: { uri: string; mimeType: string; text: string; _meta: unknown }[];
    };
    expect(contents).toHaveLength(1);
    expect(contents[0]?.uri).toBe(NOTE_URI);
    expect(contents[0]?.mimeType).toBe('text/html;profile=mcp-app');
    expect(contents[0]?.text).toBe(NOTE_HTML.replaceAll(PLACEHOLDER, ORIGIN));
    expect(contents[0]?.text).not.toContain(PLACEHOLDER);
    expect(contents[0]?.text).toContain(`content="${ORIGIN}"`);
    expect(contents[0]?.text).toContain(`url(${ORIGIN}/fonts/a.woff2)`);
    expect(contents[0]?._meta).toEqual(catalogOf().list().resources[0]?._meta);
  });

  test('the result passes the SDK’s schema', () => {
    const result = resultOf(catalogOf().read(NOTE_URI));
    expect(wireProblem({ jsonrpc: '2.0', id: 1, result }, 'resources/read')).toBeNull();
  });

  test('without base the HTML goes out as built', () => {
    const catalog = createViewCatalog<Name>({
      server: 'notes',
      views: VIEWS,
      html: () => NOTE_HTML
    });
    const { contents } = resultOf(catalog.read('ui://notes/note')) as {
      contents: { text: string }[];
    };
    expect(contents[0]?.text).toBe(NOTE_HTML);
  });

  test('no string as uri: -32602', () => {
    for (const uri of [undefined, null, 42, {}, ['ui://notes/note']]) {
      expect(errorOf(catalogOf().read(uri)).code, JSON.stringify(uri)).toBe(-32602);
    }
  });

  test('a known view that is not built is loud: -32603 with the hint', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const problem = errorOf(catalogOf().read('ui://notes/board'));
    expect(problem.code).toBe(-32603);
    expect(problem.message).toBe('The view board is not built — bun run build:views.');
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

/**
 * The population of URIs a host may send. Reading is tolerant in time — the
 * current version, an old one, none — and strict in everything else.
 */
describe('which URI reads which view', () => {
  const V = NOTE_URI.slice('ui://notes/note/'.length);
  const POPULATION: [group: string, uri: string, view: Name | undefined][] = [
    ['current', NOTE_URI, 'note'],
    ['old', 'ui://notes/note/0123456789ab', 'note'],
    ['old, full hash', `ui://notes/note/${'f'.repeat(64)}`, 'note'],
    ['old, short', 'ui://notes/note/a', 'note'],
    ['unversioned', 'ui://notes/note', 'note'],
    ['unbuilt view, unversioned', 'ui://notes/board', 'board'],
    ['unbuilt view, a version from before', `ui://notes/board/${V}`, 'board'],
    ['foreign server', `ui://other/note/${V}`, undefined],
    ['foreign server, prefix', 'ui://notesx/note', undefined],
    ['foreign scheme', `https://notes.example/note/${V}`, undefined],
    ['server alone', 'ui://notes', undefined],
    ['server and slash', 'ui://notes/', undefined],
    ['view name prefix', 'ui://notes/notes', undefined],
    ['empty', '', undefined],
    ['bare name', 'note', undefined],
    ['../ after the view', 'ui://notes/note/../note', undefined],
    ['../ before the view', 'ui://notes/../notes/note', undefined],
    ['.. as version', 'ui://notes/note/..', undefined],
    ['./ before the view', 'ui://notes/./note', undefined],
    ['upper-case scheme', 'UI://notes/note', undefined],
    ['upper-case server', 'ui://NOTES/note', undefined],
    ['upper-case view', 'ui://notes/Note', undefined],
    ['upper-case version', `ui://notes/note/${V.toUpperCase()}`, undefined],
    ['deleted view', `ui://notes/render-ui/${V}`, undefined],
    ['deleted view, unversioned', 'ui://notes/render-ui', undefined],
    ['__proto__', 'ui://notes/__proto__', undefined],
    ['constructor', 'ui://notes/constructor', undefined],
    ['toString with version', `ui://notes/toString/${V}`, undefined],
    ['query', 'ui://notes/note?v=1', undefined],
    ['query after version', `${NOTE_URI}?v=1`, undefined],
    ['fragment', 'ui://notes/note#top', undefined],
    ['fragment after version', `${NOTE_URI}#top`, undefined],
    ['trailing slash', 'ui://notes/note/', undefined],
    ['double slash', `ui://notes/note//${V}`, undefined],
    ['segment after version', `${NOTE_URI}/more`, undefined],
    ['not hex', 'ui://notes/note/NOTHEX', undefined],
    ['hash too long', `ui://notes/note/${'a'.repeat(65)}`, undefined],
    ['percent-encoded', 'ui://notes/n%6Fte', undefined],
    ['leading space', ` ${NOTE_URI}`, undefined],
    ['trailing space', `${NOTE_URI} `, undefined]
  ];

  test('at() — each URI to its view or to none', () => {
    const catalog = catalogOf();
    expect(POPULATION.map(([group, uri]) => [group, catalog.at(uri)])).toEqual(
      POPULATION.map(([group, , view]) => [group, view])
    );
  });

  test('read() — every version of a view reads today’s HTML, under the URI asked for', () => {
    const catalog = catalogOf();
    const today = (resultOf(catalog.read(NOTE_URI)) as { contents: { text: string }[] }).contents[0]
      ?.text;
    for (const [group, uri] of POPULATION.filter(([, , view]) => view === 'note')) {
      const read = (resultOf(catalog.read(uri)) as { contents: { uri: string; text: string }[] })
        .contents[0];
      expect(read?.text, group).toBe(today);
      expect(read?.uri, group).toBe(uri);
    }
  });

  test('read() — every URI without a view is -32002, naming the URI', () => {
    const catalog = catalogOf();
    for (const [group, uri] of POPULATION.filter(([, , view]) => view === undefined)) {
      const problem = errorOf(catalog.read(uri));
      expect(problem.code, group).toBe(RESOURCE_NOT_FOUND);
      expect(problem.message, group).toContain(uri);
    }
  });
});

describe('handle — the resources/* methods for a dispatcher', () => {
  const catalog = catalogOf();

  test('list, templates and read; any other method is not the catalog’s', () => {
    expect(resultOf(catalog.handle('resources/list', undefined))).toEqual(catalog.list());
    expect(resultOf(catalog.handle('resources/templates/list', {}))).toEqual({
      resourceTemplates: []
    });
    expect(resultOf(catalog.handle('resources/read', { uri: NOTE_URI }))).toEqual(
      resultOf(catalog.read(NOTE_URI))
    );
    expect(errorOf(catalog.handle('resources/read', 'ui://notes/note')).code).toBe(-32602);
    expect(errorOf(catalog.handle('resources/read', {})).code).toBe(-32602);
    for (const method of ['tools/list', 'resources/subscribe', 'initialize', 'resources']) {
      expect(catalog.handle(method, {}), method).toBeNull();
    }
  });

  test('capabilities declare resources', () => {
    expect({ tools: {}, ...catalog.capabilities }).toEqual({ tools: {}, resources: {} });
  });
});

describe('the catalog is built loud', () => {
  test('server and view names are one lowercase URI segment', () => {
    for (const server of ['Notes', '', 'a/b', 'notes.', '-notes', 'nötes']) {
      expect(() => createViewCatalog({ server, views: {}, html: () => undefined }), server).toThrow(
        'server must be one lowercase URI segment'
      );
    }
    const proto = JSON.parse('{"__proto__": {"title": "x", "description": "y"}}') as Record<
      string,
      ViewSpec
    >;
    const invalid: Record<string, ViewSpec>[] = [
      { Note: VIEWS.note },
      { 'a/b': VIEWS.note },
      proto
    ];
    for (const views of invalid) {
      expect(() => createViewCatalog({ server: 'notes', views, html: () => undefined })).toThrow(
        'A view name must be one lowercase URI segment'
      );
    }
  });

  test('an empty placeholder is refused — it would match between every character', () => {
    expect(() =>
      createViewCatalog({
        server: 'notes',
        views: VIEWS,
        html: () => NOTE_HTML,
        base: { placeholder: '', origin: () => ORIGIN }
      })
    ).toThrow('base.placeholder must not be empty');
  });
});

describe('plainOrigin — the app’s origin, and only an origin', () => {
  test('a plain origin passes, a trailing slash is dropped', () => {
    expect(plainOrigin('https://notes.example')).toBe('https://notes.example');
    expect(plainOrigin('https://notes.example/')).toBe('https://notes.example');
    expect(plainOrigin('http://localhost:5184')).toBe('http://localhost:5184');
    expect(plainOrigin('http://[::1]:5173')).toBe('http://[::1]:5173');
  });

  test('anything else stops loudly — it would land in HTML and CSS', () => {
    // `"` breaks the attribute, `)` the url(…), `$&` would be a replacement
    // pattern, credentials would ship in every view, a path points elsewhere.
    for (const url of [
      'http://a"b.example/',
      'https://notes.example/x)y(z',
      'https://notes.example/$&',
      'https://user:pw@notes.example',
      'https://notes.example/app',
      'https://notes.example/?q=1',
      'https://notes.example/#x',
      'ftp://notes.example'
    ]) {
      expect(() => plainOrigin(url), url).toThrow('must be a plain origin');
    }
    expect(() => plainOrigin('not a url')).toThrow('Not a URL');
  });

  test('the catalog applies it to what origin() returns', () => {
    const catalog = createViewCatalog<Name>({
      server: 'notes',
      views: VIEWS,
      html: () => NOTE_HTML,
      base: { placeholder: PLACEHOLDER, origin: () => 'https://user:pw@notes.example' }
    });
    expect(() => catalog.read(NOTE_URI)).toThrow('must be a plain origin');
    expect(() => catalog.list()).toThrow('must be a plain origin');
  });
});
