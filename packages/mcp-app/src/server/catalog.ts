/**
 * The server half of MCP Apps — `_meta.ui` on the tools and the `ui://`
 * resources of the views, as functions a dispatcher (`createDispatcher` or
 * your own) hooks in.
 *
 * Spec: `io.modelcontextprotocol/ui` 2026-01-26. Where the spec says two
 * things, the SDK source decides (`registerAppTool`, `getUiCapability`).
 *
 * **`_meta.ui` is always there**, also for a host that does not know MCP Apps.
 * The spec advises the server to check the client's capabilities ("SHOULD
 * check", `capabilities.extensions["io.modelcontextprotocol/ui"]` of the
 * client's `initialize`). A stateless server never sees that `initialize`
 * again when `tools/list` arrives, so it departs from the SHOULD; a host
 * without MCP Apps ignores `_meta`, and the tool stays an ordinary one with a
 * text result ("text-only fallback", ibid.).
 */
import { createHash } from 'node:crypto';
import { INTERNAL_ERROR, INVALID_PARAMS } from '../jsonrpc.ts';

/** The `mimeType` the spec requires of a view ("MUST"). */
export const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

/**
 * The old flat key for a tool's resource. The spec calls it deprecated; the
 * SDK still sets it next to `_meta.ui.resourceUri` (`registerAppTool`), and
 * hosts are to read both.
 */
export const LEGACY_RESOURCE_URI_KEY = 'ui/resourceUri';

/** "Resource not found" — the code the MCP spec names for `resources/read`. */
export const RESOURCE_NOT_FOUND = -32002;

/** How many hex characters of the SHA-256 an issued URI carries. */
export const VERSION_LENGTH = 12;

/**
 * What `resources/read` accepts as a version: any prefix of a SHA-256 in
 * lowercase hex. A URI once issued stays in a chat's history — also after
 * {@link VERSION_LENGTH} changes.
 */
const ANY_VERSION = /^[0-9a-f]{1,64}$/;

/** A server or view name: one lowercase URI segment. */
const SEGMENT = /^[a-z0-9][a-z0-9_-]*$/;

/** What may stand in the HTML as the app's origin: scheme, host, at most a port. */
const PLAIN_ORIGIN = /^https?:\/\/(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d+)?$/;

/** `_meta.ui.csp` of the spec (`McpUiResourceCsp`) — origins only, no keywords. */
export interface ViewCsp {
  connectDomains?: readonly string[];
  resourceDomains?: readonly string[];
  frameDomains?: readonly string[];
  baseUriDomains?: readonly string[];
}

export interface ViewSpec {
  /** The resource's `name` in `resources/list`. */
  title: string;
  /** What the view is for — for the host and whoever reviews it. */
  description: string;
  csp?: ViewCsp;
  /** Whether the host draws border and background. The spec advises saying so explicitly. */
  prefersBorder?: boolean;
  /**
   * Whether the view calls tools. Ignored by the catalog and never sent to
   * the host — a tool's `"app"` visibility holds for every view of the server.
   * The app passes it to `startView` as `callsTools`, so one record carries
   * both sides.
   */
  callsTools?: boolean;
}

/** The built HTML of a view — `undefined` when it is not built. */
export type ViewSource<N extends string> = (name: N) => string | undefined;

/** What a tool says about MCP Apps: the view it renders in, and whether a view may call it. */
export interface AppToolMeta<N extends string> {
  view?: N;
  callableFromView?: boolean;
}

/** A dispatcher's answer: a JSON-RPC `result` or `error`, without envelope. */
export type Outcome =
  | { result: Record<string, unknown> }
  | { error: { code: number; message: string } };

export interface ViewCatalogOptions<N extends string> {
  /** The URI authority: views live at `ui://<server>/<name>[/<version>]`. */
  server: string;
  views: Record<N, ViewSpec>;
  html: ViewSource<N>;
  /**
   * The app's origin in the view: `placeholder` in the built HTML is replaced
   * at `resources/read`, and the origin joins every view's
   * `csp.resourceDomains`. The version is hashed before the replacement, so
   * `tools/list` never calls `origin()`. What `origin()` returns passes
   * {@link plainOrigin}; when it throws or fails that, `resources/list` and
   * `resources/read` answer `-32603`.
   */
  base?: { placeholder: string; origin(): string };
  /** Appended to the `-32603` of a view that is not built, e.g. `'bun run build:views'`. */
  unbuiltHint?: string;
}

export interface ViewCatalog<N extends string> {
  readonly names: readonly N[];
  /** The URI the view is issued under today: with version once built, without before. */
  uri(name: N): string;
  /** The view behind a URI — current, old or without version — or `undefined`. */
  at(uri: string): N | undefined;
  /** `_meta` of a tool: `visibility` always, both resource keys when it has a view. */
  toolMeta(app?: AppToolMeta<N>): Record<string, unknown>;
  /** `resources/list`. */
  list(): Outcome;
  /** `resources/read` for `params.uri`. */
  read(uri: unknown): Outcome;
  /** `resources/list`, `resources/read`, `resources/templates/list` — `null` for any other method. */
  handle(method: string, params: unknown): Outcome | null;
  /** Spread into the `capabilities` of `initialize`. */
  readonly capabilities: { resources: Record<string, never> };
}

const versions = new Map<string, string>();

/**
 * A view's version: the first {@link VERSION_LENGTH} characters of a SHA-256
 * over the **built** HTML, computed once per content and process.
 *
 * A host may prefetch and keep UI resources (spec: "Host MAY prefetch and
 * cache UI resource content"), and Claude keeps them past a deploy. A new URI
 * is the only thing by which a host recognises a new view. Derived, not
 * counted: it changes exactly when the built file changes.
 *
 * **What the version does not cover:** a resource's `_meta.ui` (the CSP, the
 * border) and the base origin. When only one of those changes, the URI stays,
 * and a host with a cache keeps the old one.
 */
export function viewVersion(html: string): string {
  let version = versions.get(html);
  if (version === undefined) {
    version = createHash('sha256').update(html).digest('hex').slice(0, VERSION_LENGTH);
    versions.set(html, version);
  }
  return version;
}

/**
 * The origin of `url` — **and only if `url` is nothing else.**
 *
 * The origin lands in an attribute (`<meta content="…">`) and in unquoted
 * `url(…)` of `@font-face` rules. `new URL` does not make it safe for that:
 * `http://a"b.de/` keeps the `"` in the host and breaks the attribute, a path
 * `…/x)y(z` breaks the `url(…)`, and `https://user:pw@…` would carry
 * credentials into every view served. The answer to such a value is a loud
 * stop, not a repair — also for a path, because a silently shortened address
 * points elsewhere than the one meant.
 */
export function plainOrigin(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a URL: ${JSON.stringify(url)}.`);
  }
  const plain =
    parsed.username === '' &&
    parsed.password === '' &&
    parsed.pathname === '/' &&
    parsed.search === '' &&
    parsed.hash === '' &&
    PLAIN_ORIGIN.test(parsed.origin);
  if (!plain) {
    throw new Error(
      `The view's base must be a plain origin (https://host[:port]), not ${JSON.stringify(url)} — it is written into HTML and CSS.`
    );
  }
  return parsed.origin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createViewCatalog<N extends string>(
  options: ViewCatalogOptions<N>
): ViewCatalog<N> {
  const { server, views, html, base, unbuiltHint } = options;
  if (!SEGMENT.test(server)) {
    throw new Error(`server must be one lowercase URI segment, not ${JSON.stringify(server)}.`);
  }
  const names = Object.keys(views) as N[];
  for (const name of names) {
    if (!SEGMENT.test(name)) {
      throw new Error(
        `A view name must be one lowercase URI segment, not ${JSON.stringify(name)}.`
      );
    }
  }
  if (base && base.placeholder === '') throw new Error('base.placeholder must not be empty.');

  const root = (name: N): string => `ui://${server}/${name}`;
  const known = (name: unknown): name is N => names.includes(name as N);

  function uri(name: N): string {
    const built = html(name);
    return built === undefined ? root(name) : `${root(name)}/${viewVersion(built)}`;
  }

  function at(candidate: string): N | undefined {
    return names.find((name) => {
      const prefix = root(name);
      if (candidate === prefix) return true;
      return (
        candidate.startsWith(`${prefix}/`) && ANY_VERSION.test(candidate.slice(prefix.length + 1))
      );
    });
  }

  /**
   * `answer` with the app's origin, checked once per answer — `undefined`
   * without `base`. An origin that throws or fails {@link plainOrigin} is
   * `-32603`, not a throw. Only the origin is caught: an `html()` that throws
   * stays a throw, so its cause is not reported as the origin's.
   */
  function withOrigin(answer: (origin: string | undefined) => Outcome): Outcome {
    let origin: string | undefined;
    try {
      origin = base ? plainOrigin(base.origin()) : undefined;
    } catch (error) {
      // The sentence stays in the log: plainOrigin quotes the value, credentials included.
      console.error("[mcp-app] The app's origin for the views is not usable:", error);
      return {
        error: {
          code: INTERNAL_ERROR,
          message:
            "The app's origin for the views (base.origin()) is not usable — see the server log."
        }
      };
    }
    return answer(origin);
  }

  function resourceMeta(name: N, origin: string | undefined): Record<string, unknown> {
    const { csp, prefersBorder } = views[name];
    const ui: Record<string, unknown> = {};
    if (origin !== undefined) {
      // The spec writes `resourceDomains` into `script-src` as well, so this
      // allows scripts from the app's origin — sound only while the origin
      // serves no script a stranger can write (user uploads only with
      // `nosniff` and a content type that is no script).
      ui.csp = { ...csp, resourceDomains: [...(csp?.resourceDomains ?? []), origin] };
    } else if (csp) {
      ui.csp = { ...csp };
    }
    if (prefersBorder !== undefined) ui.prefersBorder = prefersBorder;
    return { ui };
  }

  function toolMeta(app?: AppToolMeta<N>): Record<string, unknown> {
    // `visibility` on every tool, explicitly: without it the spec defaults to
    // ["model", "app"], and every view of the server could call every tool.
    const visibility = app?.callableFromView ? ['model', 'app'] : ['model'];
    const view = app?.view;
    if (view === undefined) return { ui: { visibility } };
    if (!known(view))
      throw new Error(`No view ${JSON.stringify(view)} in the catalog of ${server}.`);
    const resourceUri = uri(view);
    return { ui: { resourceUri, visibility }, [LEGACY_RESOURCE_URI_KEY]: resourceUri };
  }

  function list(): Outcome {
    // Listed although the spec allows omitting UI-only resources: the server
    // declares `resources`, and what it declares it answers.
    return withOrigin((origin) => ({
      result: {
        resources: names.map((name) => ({
          uri: uri(name),
          name: views[name].title,
          description: views[name].description,
          mimeType: RESOURCE_MIME_TYPE,
          _meta: resourceMeta(name, origin)
        }))
      }
    }));
  }

  function read(requested: unknown): Outcome {
    if (typeof requested !== 'string') {
      return { error: { code: INVALID_PARAMS, message: 'resources/read needs params.uri.' } };
    }
    const name = at(requested);
    if (name === undefined) {
      return {
        error: { code: RESOURCE_NOT_FOUND, message: `Resource not found: ${requested}` }
      };
    }
    const built = html(name);
    if (built === undefined) {
      console.error(`[mcp-app] The view ${name} is not built.`);
      return {
        error: {
          code: INTERNAL_ERROR,
          message: `The view ${name} is not built${unbuiltHint ? ` — ${unbuiltHint}` : ''}.`
        }
      };
    }
    return withOrigin((origin) => ({
      result: {
        contents: [
          {
            // Under the URI that was asked for, with today's HTML.
            uri: requested,
            mimeType: RESOURCE_MIME_TYPE,
            // A function as replacement: a string would read `$&`, `$'` and `` $` `` as patterns.
            text:
              base && origin !== undefined
                ? built.replaceAll(base.placeholder, () => origin)
                : built,
            _meta: resourceMeta(name, origin)
          }
        ]
      }
    }));
  }

  function handle(method: string, params: unknown): Outcome | null {
    switch (method) {
      case 'resources/list':
        return list();
      // Whoever declares `resources` is asked for templates too; views have none.
      case 'resources/templates/list':
        return { result: { resourceTemplates: [] } };
      case 'resources/read':
        return read(isRecord(params) ? params.uri : undefined);
      default:
        return null;
    }
  }

  return {
    names,
    uri,
    at,
    toolMeta,
    list,
    read,
    handle,
    capabilities: { resources: {} }
  };
}
