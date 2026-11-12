/**
 * A whole run of the test host — `openHost`, the app's scenario, the generic
 * checks — and the checks against the server alone (`versionReport`).
 */
import { VERSION_LENGTH } from '../../server/catalog.ts';
import {
  checkHostVariables,
  checkSize,
  checkTheme,
  closingChecks,
  probeOracle,
  probeRpc,
  probeVisibility
} from './checks.ts';
import {
  type Endpoint,
  type HostCheck,
  mcpRequest,
  mcpResult,
  type OpenHost,
  type OpenHostOptions,
  openHost
} from './open.ts';

export interface HostReport {
  ok: boolean;
  checks: HostCheck[];
  console: string[];
  cspReports: unknown[];
  pageErrors: string[];
  sizes: unknown[];
  notes: string[];
}

/** What the app does in a run; both run with the host open and the view connected. */
export interface HostScenario {
  /** Before the result reaches the view — with `flow: 'auto'` while it is latched. */
  beforeResult?(o: OpenHost): Promise<void>;
  /** After `tool-result` arrived — before the generic checks, which end with the teardown. */
  afterResult?(o: OpenHost): Promise<void>;
}

export interface RunHostOptions extends Omit<OpenHostOptions, 'flow'> {
  /**
   * Redraw from history: `tool-input` and `tool-result` in the same tick,
   * without the latch — the usual case of a host rebuilding a chat.
   */
  replay?: boolean;
  /** An origin in the view's `resourceDomains` — the CSP probe loads an image from it. */
  allowedOrigin: string;
  /** A tool on `["model"]` and arguments that harm nothing if the host forwarded them. */
  modelOnly: { tool: string; args: Record<string, unknown> };
  /** Names the view's CSS defines that collide with the host's, and an element painted with the first. */
  hostVariables: { variables: readonly string[]; selector: string; property?: string };
  /** An element whose background follows the theme through `light-dark()`. */
  theme: { surface: string };
}

function reportOf(o: OpenHost, sizes: unknown[]): HostReport {
  return {
    ok: o.checks.every((c) => c.ok),
    checks: o.checks,
    console: o.consoleLines,
    cspReports: o.cspReports,
    pageErrors: o.pageErrors,
    sizes,
    notes: o.notes
  };
}

/** A report without a browser — only checks against the server. */
function plainReport(checks: HostCheck[]): HostReport {
  return {
    ok: checks.every((c) => c.ok),
    checks,
    console: [],
    cspReports: [],
    pageErrors: [],
    sizes: [],
    notes: []
  };
}

/**
 * One run: open the host, `beforeResult`, the result (released or replayed),
 * `afterResult`, then size, host variables, theme, the visibility probe, the
 * oracle probes, `/rpc`, and the closing checks with the teardown.
 */
export async function runHost(
  options: RunHostOptions,
  scenario: HostScenario = {}
): Promise<HostReport> {
  const o = await openHost({ ...options, flow: options.replay ? 'scripted' : 'auto' });
  try {
    await scenario.beforeResult?.(o);
    if (options.replay) await o.host.replay();
    else await o.host.releaseResult();
    await o.page
      .waitForFunction(
        () =>
          (window as unknown as { __host: { state: { resultSent: boolean } } }).__host.state
            .resultSent,
        null,
        { timeout: 5_000 }
      )
      .catch(() => {});
    const s = await o.state();
    o.check('result-sent', 'tool-input and tool-result sent', s.resultSent, String(s.errors));
    await scenario.afterResult?.(o);
    await checkSize(o);
    await checkHostVariables(o, options.hostVariables);
    await checkTheme(o, options.theme.surface);
    await probeVisibility(o, options.modelOnly);
    await probeOracle(o, options.allowedOrigin);
    await probeRpc(o);
    await closingChecks(o);
    return reportOf(o, (await o.state()).sizes);
  } finally {
    await o.close();
  }
}

interface ToolLite {
  name: string;
  _meta?: { ui?: { resourceUri?: string }; 'ui/resourceUri'?: string };
}

/**
 * The view's URI at the running server, without a browser: it carries the
 * first {@link VERSION_LENGTH} hex characters of a SHA-256 over `html` — the
 * built file the server was built from — and `tools/list` (both keys) and
 * `resources/list` name the same. `resources/read` returns the same HTML
 * under it, under a foreign version and without version; an unknown name is
 * `-32002`. With `withoutView`, that tool carries no URI.
 *
 * The hash is computed here, not taken from the catalog: the check is meant
 * to catch the catalog hashing something else.
 */
export async function versionReport(options: {
  endpoint: Endpoint;
  tool: string;
  /** `ui://<server>/<name>`, without version. */
  uri: string;
  html: string;
  withoutView?: string;
}): Promise<HostReport> {
  const { endpoint } = options;
  const checks: HostCheck[] = [];
  const check = (id: string, name: string, ok: boolean, detail = ''): void => {
    checks.push({ id, ok, name, detail });
  };
  const version = new Bun.CryptoHasher('sha256')
    .update(options.html)
    .digest('hex')
    .slice(0, VERSION_LENGTH);
  const expected = `${options.uri}/${version}`;

  const { tools } = (await mcpResult(endpoint, 'tools/list')) as { tools: ToolLite[] };
  const shown = tools.find((tool) => tool.name === options.tool);
  const { resources } = (await mcpResult(endpoint, 'resources/list')) as {
    resources: { uri: string }[];
  };
  check(
    'version-uri',
    `the view's URI carries the built HTML's version — in tools/list, in the flat key and in resources/list`,
    shown?._meta?.ui?.resourceUri === expected &&
      shown._meta['ui/resourceUri'] === expected &&
      resources.some((r) => r.uri === expected),
    JSON.stringify({ expected, tool: shown?._meta, resources })
  );
  if (options.withoutView !== undefined) {
    const plain = tools.find((tool) => tool.name === options.withoutView);
    check(
      'version-without-view',
      `${options.withoutView} has no view, ${options.tool} has`,
      Boolean(plain) &&
        plain?._meta?.ui?.resourceUri === undefined &&
        plain?._meta?.['ui/resourceUri'] === undefined,
      JSON.stringify(plain?._meta)
    );
  }
  const textAt = async (uri: string): Promise<string | null> => {
    const answer = await mcpRequest(endpoint, 'resources/read', { uri });
    return (
      (answer.result as { contents?: { text?: string }[] } | undefined)?.contents?.[0]?.text ?? null
    );
  };
  const today = await textAt(expected);
  const foreign = await textAt(`${options.uri}/0123456789ab`);
  const unversioned = await textAt(options.uri);
  check(
    'version-read-tolerant',
    'resources/read: the same HTML under the version, a foreign version and without version',
    typeof today === 'string' && today.length > 0 && foreign === today && unversioned === today,
    JSON.stringify({
      today: today?.length,
      foreign: foreign?.length,
      unversioned: unversioned?.length
    })
  );
  const unknownUri = `${options.uri.replace(/[^/]+$/, 'no-such-view')}/${version}`;
  const unknown = await mcpRequest(endpoint, 'resources/read', { uri: unknownUri });
  check(
    'version-unknown',
    'an unknown name is -32002',
    unknown.error?.code === -32002,
    JSON.stringify(unknown)
  );
  return plainReport(checks);
}

/**
 * Prints reports as `✓`/`✗` lines with the detail of each failed check, the
 * notes and the console. Returns whether all passed, and how many checks ran.
 */
export function printReports(
  reports: readonly (readonly [label: string, report: HostReport])[],
  print: (line: string) => void = console.log
): { ok: boolean; total: number } {
  let ok = true;
  let total = 0;
  for (const [label, report] of reports) {
    print(`\n— ${label}`);
    for (const c of report.checks) {
      print(`${c.ok ? '✓' : '✗'} ${c.name}${c.ok || !c.detail ? '' : `\n    ${c.detail}`}`);
    }
    for (const note of report.notes) print(note);
    if (report.console.length > 0) print(`console:\n  ${report.console.join('\n  ')}`);
    ok &&= report.ok;
    total += report.checks.length;
  }
  return { ok, total };
}
