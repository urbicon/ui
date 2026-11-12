/**
 * The generic checks of an open host. Each adds to `o.checks` under a stable
 * `id`; `runHost` calls them in a fixed order, and a run of an app's own can
 * call them one by one.
 */
import { HOST_STYLES, type OpenHost, takeLines } from './open.ts';

/** Claude's sentence for `ui/message` with `content` as an object — the 1.7.5 schema's. */
const MESSAGE_OBJECT_SENTENCE =
  'Invalid params for ui/message: content: Invalid input: expected array, received object';

/**
 * Chromium warns about every iframe with `allow-scripts allow-same-origin` —
 * the combination the spec requires of the sandbox. The warning is about the
 * host, not the view.
 */
const SANDBOX_WARNING = 'has both allow-scripts and allow-same-origin';

/**
 * The id of the visibility probe's `tools/call` — its signature. By it the
 * bridge's console line about the foreign answer leaves the findings in the
 * probe, and the host's refusal and the bridge's log of the answer leave them
 * in `closingChecks`.
 */
const VISIBILITY_PROBE = 'mcp-app-probe-visibility';

/** `notifications/message` levels from `error` up (RFC 5424, as MCP takes them). */
const ERROR_LEVELS: ReadonlySet<string> = new Set(['error', 'critical', 'alert', 'emergency']);

const pause = (o: OpenHost, ms: number) => o.page.waitForTimeout(ms);

/**
 * Waits until the view has settled: images loaded or failed, fonts ready, and
 * the last `size-changed` through.
 */
export async function settle(o: OpenHost): Promise<void> {
  await o.view
    .waitForFunction(() => [...document.images].every((image) => image.complete), null, {
      timeout: 10_000
    })
    .catch(() => {});
  await o.view.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => {});
  await pause(o, 400);
}

/**
 * The host sized the iframe after `size-changed`: frame height = content,
 * no scrolling inside the view, nothing wider than the host. The content is
 * the `<body>`'s box, so a body margin shows as a gap.
 */
export async function checkSize(o: OpenHost): Promise<void> {
  await settle(o);
  const s = await o.state();
  const frameBox = await o.page
    .locator('#sandbox')
    .evaluate((el) => (el as HTMLIFrameElement).clientHeight);
  const viewSize = await o.view.evaluate(() => ({
    content: Math.ceil(document.body.getBoundingClientRect().height),
    inner: window.innerHeight,
    scroll: document.documentElement.scrollHeight,
    wide: document.documentElement.scrollWidth > window.innerWidth
  }));
  o.check(
    'size-reported',
    'size-changed arrived, with width and height',
    s.sizes.length > 0 && s.sizes.every((x) => x.width > 0 && x.height > 0),
    JSON.stringify(s.sizes)
  );
  o.check(
    'size-fits',
    `height fits: iframe = content, no scrolling in the view, nothing wider than ${o.width} px`,
    Math.abs(frameBox - viewSize.content) <= 1 &&
      viewSize.scroll <= viewSize.inner &&
      !viewSize.wide,
    JSON.stringify({ frameBox, ...viewSize })
  );
}

/**
 * The host sends the spec's `styles.variables` (`HOST_STYLES`), some of whose
 * names a view's theme uses too. The view must not set them on its root under
 * their own name: no `--*` inline on the root, and each of `variables` — names
 * the view's own CSS defines — keeps the view's value. **Positive control:**
 * set under its own name, the first of them takes the host's value and
 * changes `property` of `selector`, so the oracle would see a collision.
 */
export async function checkHostVariables(
  o: OpenHost,
  probe: { variables: readonly string[]; selector: string; property?: string }
): Promise<void> {
  const property = probe.property ?? 'color';
  const sent = probe.variables.map((name) => {
    const value = HOST_STYLES.variables[name];
    if (value === undefined) throw new Error(`${name} is not one of the host's variables.`);
    return { name, value };
  });
  const [first] = sent;
  if (first === undefined) throw new Error('checkHostVariables needs at least one variable.');
  const tokens = await o.view.evaluate(
    ({ names, selector, prop }) => {
      const root = document.documentElement;
      const target = document.querySelector(selector);
      return {
        inline: [...root.style].filter((name) => name.startsWith('--')),
        values: names.map((name) => getComputedStyle(root).getPropertyValue(name).trim()),
        painted: target ? getComputedStyle(target).getPropertyValue(prop) : null
      };
    },
    { names: [...probe.variables], selector: probe.selector, prop: property }
  );
  o.check(
    'host-variables-root',
    'the view sets no host variable on its root',
    tokens.inline.length === 0,
    JSON.stringify(tokens.inline)
  );
  o.check(
    'host-variables-collision',
    `a host value under a collision name leaves the view's own token (${probe.variables.join(', ')})`,
    sent.every(({ value }, i) => tokens.values[i] !== value) && tokens.painted !== null,
    JSON.stringify({ tokens, sent })
  );
  const collided = await o.view.evaluate(
    ({ name, value, selector, prop }) => {
      const root = document.documentElement;
      root.style.setProperty(name, value);
      const target = document.querySelector(selector);
      const after = {
        inline: [...root.style].filter((n) => n.startsWith('--')),
        value: getComputedStyle(root).getPropertyValue(name).trim(),
        painted: target ? getComputedStyle(target).getPropertyValue(prop) : null
      };
      root.style.removeProperty(name);
      return after;
    },
    { name: first.name, value: first.value, selector: probe.selector, prop: property }
  );
  o.check(
    'host-variables-control',
    `positive control: under its own name, the host's ${first.name} changes the view's token and ${probe.selector}`,
    collided.value === first.value &&
      collided.painted !== tokens.painted &&
      collided.inline.length === 1,
    JSON.stringify({ collided, before: tokens.painted })
  );
}

/**
 * `host-context-changed` with `theme: 'light'`, then `'dark'`: `color-scheme`
 * follows on the root, and `surface` — an element painted with
 * `light-dark()` — changes its background. Light is sent first, so a scenario
 * may leave either theme behind.
 */
export async function checkTheme(o: OpenHost, surface: string): Promise<void> {
  const scheme = () =>
    o.view.evaluate((selector) => {
      const element = document.querySelector(selector);
      return {
        scheme: getComputedStyle(document.documentElement).colorScheme,
        background: element ? getComputedStyle(element).backgroundColor : null
      };
    }, surface);
  await o.host.setTheme('light');
  await pause(o, 300);
  const light = await scheme();
  await o.host.setTheme('dark');
  await pause(o, 300);
  const dark = await scheme();
  o.check(
    'theme',
    `host-context-changed: theme dark → color-scheme dark, another background on ${surface}`,
    light.scheme === 'light' &&
      dark.scheme === 'dark' &&
      light.background !== null &&
      light.background !== dark.background,
    JSON.stringify({ light, dark })
  );
}

/**
 * Visibility is the host's to enforce — asked **from inside the view**,
 * through the proxy, as a view would: `tool` is on `["model"]`. The answer
 * reaches the view's bridge as well, which never asked under that id and says
 * so. That line, the host's refusal and the bridge's log of it belong to the
 * probe; the closing checks leave them out by the probe's id.
 *
 * `args` must harm nothing if forwarded: were `visibility` missing, the host
 * would apply the spec's default `["model", "app"]` and pass the call on.
 */
export async function probeVisibility(
  o: OpenHost,
  modelOnly: { tool: string; args: Record<string, unknown> }
): Promise<void> {
  const forwarded = o.rpcLog.forwarded;
  const answer = (await o.view.evaluate(
    ({ id, name, args }) =>
      new Promise<unknown>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          if (event.data?.id !== id) return;
          window.removeEventListener('message', onMessage);
          resolve(event.data);
        };
        window.addEventListener('message', onMessage);
        window.parent.postMessage(
          { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } },
          '*'
        );
        setTimeout(() => resolve({ timeout: true }), 3_000);
      }),
    { id: VISIBILITY_PROBE, name: modelOnly.tool, args: modelOnly.args }
  )) as { error?: { message?: string } };
  const s = await o.state();
  o.check(
    'visibility',
    `the host refuses tools/call ${modelOnly.tool} from the view (visibility ["model"]), nothing reaches the app`,
    String(answer.error?.message).includes('not granted to views') &&
      s.refused.some((r) => r.id === VISIBILITY_PROBE && r.name === modelOnly.tool) &&
      o.rpcLog.forwarded === forwarded,
    JSON.stringify({ answer, forwarded: o.rpcLog.forwarded - forwarded })
  );
  await pause(o, 200);
  // Only what the probe carries leaves the findings — a real line in the same moment stays.
  const lines = takeLines(o.consoleLines, VISIBILITY_PROBE);
  o.check(
    'visibility-bridge-loud',
    "… and the view's bridge reports the foreign answer instead of swallowing it",
    lines.some((line) => line.includes(`Answer to an unknown request (id ${VISIBILITY_PROBE})`)),
    lines.join('\n')
  );
}

/**
 * The oracle checked before it is believed: a CSP violation and a page error,
 * caused on purpose, must arrive — and an image from `allowedOrigin` (one of
 * the view's `resourceDomains`) must not show as a violation. The probes then
 * leave the findings, recognised by their signature.
 */
export async function probeOracle(o: OpenHost, allowedOrigin: string): Promise<void> {
  const PROBE_CSP = 'mcp-app-csp-probe';
  const PROBE_THROWN = 'mcp-app-pageerror-probe';
  const reportsBefore = o.cspReports.length;
  const consoleBefore = o.consoleLines.length;
  const errorsBefore = o.pageErrors.length;
  await o.view.evaluate(
    ([csp, thrown, permittedOrigin]) => {
      const blocked = new Image();
      blocked.src = `https://example.com/${csp}.png`;
      const permitted = new Image();
      permitted.src = `${permittedOrigin}/${csp}.png`;
      setTimeout(() => {
        throw new Error(thrown);
      });
    },
    [PROBE_CSP, PROBE_THROWN, allowedOrigin.replace(/\/+$/, '')] as const
  );
  await pause(o, 800);
  const probeConsole = o.consoleLines.slice(consoleBefore).join('\n');
  const reports = o.cspReports.slice(reportsBefore);
  o.check(
    'oracle-csp',
    'positive control: the CSP blocks an image from example.com and reports it',
    probeConsole.includes('example.com') ||
      reports.some((r) => JSON.stringify(r).includes('example.com')),
    probeConsole
  );
  const blockedUris = reports.map((r) =>
    String((r as { 'csp-report'?: { 'blocked-uri'?: string } })['csp-report']?.['blocked-uri'])
  );
  const allowed = new URL(allowedOrigin);
  // The blocked URL in quotes before "violates" — the line of another
  // violation quotes the whole policy, and the policy names this origin too.
  const refusedHere = new RegExp(
    `'${allowed.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^']*' violates`
  );
  o.check(
    'oracle-allowed',
    `positive control: an image from ${allowedOrigin} (resourceDomains) is not blocked`,
    !blockedUris.some((uri) => uri.includes(allowed.host)) && !refusedHere.test(probeConsole),
    JSON.stringify({ blockedUris, probeConsole })
  );
  o.check(
    'oracle-pageerror',
    'positive control: an error thrown in the view arrives as a page error',
    o.pageErrors.slice(errorsBefore).some((m) => m.includes(PROBE_THROWN)),
    o.pageErrors.join(' | ')
  );
  takeLines(o.consoleLines, PROBE_CSP, PROBE_THROWN);
  takeLines(o.cspReports, PROBE_CSP);
  takeLines(o.pageErrors, PROBE_THROWN);
}

/**
 * `/rpc` belongs to the host page. Another page in the same browser — the
 * proxy server's 404 on the sandbox origin, without a CSP — sends the simple
 * POST an attacker would (`text/plain`, no preflight), and a request without
 * any `Origin` follows. Only `tools/list` is asked, so a hole does no harm.
 */
export async function probeRpc(o: OpenHost): Promise<void> {
  const before = { ...o.rpcLog };
  const stranger = await o.browser.newPage();
  try {
    await stranger.goto(`${o.origins.sandbox}/stranger`);
    await stranger.evaluate(
      (target) =>
        fetch(target, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'content-type': 'text/plain' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
        }).then(
          () => undefined,
          () => undefined
        ),
      `${o.origins.host}/rpc`
    );
  } finally {
    await stranger.close();
  }
  const direct = await fetch(`${o.origins.host}/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  });
  o.check(
    'rpc-origin',
    '/rpc refuses a foreign and a missing Origin (403) and forwards nothing',
    o.rpcLog.refused - before.refused === 2 &&
      o.rpcLog.forwarded === before.forwarded &&
      direct.status === 403 &&
      before.forwarded > 0,
    JSON.stringify({ before, after: o.rpcLog, direct: direct.status })
  );
}

/**
 * The end of every run: `ui/resource-teardown` answered, and the whole run
 * without console errors or warnings, `notifications/message` from `error`
 * up, CSP violations, page errors or refused `tools/call` of the view — the
 * visibility probe's own refusal and log line leave by its id; every message
 * passed the schemas, and the page's schema still rejects the spec text's
 * `ui/message` (**positive control** — a wire check that rejects nothing
 * reports "no problem" exactly like a clean run).
 */
export async function closingChecks(o: OpenHost): Promise<void> {
  const torn = await o.host.teardown('end of run').catch((e: Error) => ({ failed: e.message }));
  o.check(
    'teardown',
    'ui/resource-teardown is answered ({}), then torn down',
    JSON.stringify(torn) === '{}',
    JSON.stringify(torn)
  );
  const problems = o.consoleLines.filter(
    (line) =>
      (line.startsWith('[error]') || line.startsWith('[warning]')) &&
      !line.includes(SANDBOX_WARNING)
  );
  o.check(
    'console',
    'no errors and warnings in the console (all frames)',
    problems.length === 0,
    problems.join('\n')
  );
  const s = await o.state();
  // A copy: the page's own record stays whole for `o.state()`.
  const logs = [...s.logs];
  takeLines(logs, VISIBILITY_PROBE);
  const logged = logs.filter((entry) => ERROR_LEVELS.has(entry.level));
  o.check(
    'log-errors',
    'no notifications/message from the view at level error or above',
    logged.length === 0,
    JSON.stringify(logged)
  );
  o.check(
    'csp-reports',
    'no CSP violation reported (report-uri)',
    o.cspReports.length === 0,
    JSON.stringify(o.cspReports)
  );
  o.check('page-errors', 'no page error', o.pageErrors.length === 0, o.pageErrors.join(' | '));
  const refused = s.refused.filter((r) => r.id !== VISIBILITY_PROBE);
  o.check(
    'refused-calls',
    "the host refused no tools/call of the view, apart from the visibility probe's",
    refused.length === 0,
    JSON.stringify(refused)
  );
  const { wire } = s;
  o.check(
    'wire',
    `every message between view and host passes the ext-apps schemas (${wire.checked} checked)`,
    wire.checked > 0 && wire.problems.length === 0,
    wire.problems.join('\n')
  );
  const control = await o.host.wireControl();
  o.check(
    'wire-control',
    "positive control: the page's schema rejects ui/message with content as an object",
    control?.code === -32602 && control.message === MESSAGE_OBJECT_SENTENCE,
    JSON.stringify(control)
  );
}
