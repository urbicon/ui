/**
 * The package's own test of its test host — `bun run test:host`, and with
 * `--controls` (`bun run test:host:controls`) the control runs.
 *
 * Builds the fixture view through `@urbicon-ui/mcp-app/vite`, starts the
 * fixture server and drives `runHost` against it: the URI report, the card at
 * 700 and 390 px, and a redraw from history. Every check must pass.
 *
 * `--controls` breaks the fixture once per entry of `SABOTAGES` and drives one
 * run against each: the run must fail, and the failing checks must be exactly
 * the ones the entry names. Without the controls, "all green" would also be
 * the result of a host that checks nothing.
 *
 * Imports the package by its name, so it runs `dist/` — the scripts build first.
 */
import { join } from 'node:path';
import {
  type HostReport,
  printReports,
  type RunHostOptions,
  runHost,
  versionReport
} from '@urbicon-ui/mcp-app/testing/host';
import { buildFixture } from './build.ts';
import { SABOTAGES, type Sabotage } from './sabotage.ts';
import { fixtureScenario } from './scenario.ts';
import { type FixtureServer, startFixtureServer } from './server.ts';
import { FIXTURE_INFO, FONTS_PATH, NOTES, type Note } from './shared.ts';

const DIST = new URL('./dist/', import.meta.url).pathname;
function firstNote(): Note {
  const [note] = NOTES;
  if (!note) throw new Error('The fixture has no note.');
  return note;
}
const NOTE = firstNote();

function hostOptions(server: FixtureServer, width: number): RunHostOptions {
  return {
    endpoint: server.endpoint,
    tool: 'show_note',
    args: { id: NOTE.id },
    width,
    expect: { appInfo: FIXTURE_INFO, appCapabilities: { availableDisplayModes: ['inline'] } },
    watchResponses: (url) => url.includes(FONTS_PATH),
    allowedOrigin: server.origin,
    // An id no note has: forwarded by a host that did not enforce visibility, it removes nothing.
    modelOnly: { tool: 'remove_note', args: { id: crypto.randomUUID() } },
    hostVariables: { variables: ['--color-text-primary', '--font-mono'], selector: 'h1' },
    theme: { surface: 'main' }
  };
}

function sizes(build: Awaited<ReturnType<typeof buildFixture>>): string {
  const views = build.views.map(
    (v) =>
      `${v.name}.html ${(v.bytes / 1024).toFixed(1)} kB · gzip ${(v.gzipBytes / 1024).toFixed(1)} kB`
  );
  return [
    ...views,
    `fonts/ ${build.fonts.files.length} files · ${(build.fonts.bytes / 1024).toFixed(1)} kB`
  ].join('\n');
}

async function green(): Promise<boolean> {
  const dist = join(DIST, 'green');
  const build = await buildFixture(dist);
  console.log(sizes(build));
  const server = startFixtureServer({ dist });
  try {
    const scenario = fixtureScenario(NOTE.id, server.origin);
    const html = await Bun.file(join(dist, 'note.html')).text();
    const reports: [string, HostReport][] = [
      [
        '/mcp · the versioned URI',
        await versionReport({
          endpoint: server.endpoint,
          tool: 'show_note',
          uri: 'ui://fixture/note',
          html,
          withoutView: 'get_note'
        })
      ],
      ['note · 700 px', await runHost(hostOptions(server, 700), scenario)],
      ['note · 390 px', await runHost(hostOptions(server, 390), scenario)],
      [
        'note · redrawn from history · 390 px',
        await runHost({ ...hostOptions(server, 390), replay: true }, scenario)
      ]
    ];
    const { ok, total } = printReports(reports);
    console.log(
      ok ? `\n✓ mcp-app test host — ${total} checks` : '\n✗ mcp-app test host with findings'
    );
    return ok;
  } finally {
    server.stop();
  }
}

async function control(sabotage: Sabotage): Promise<boolean> {
  const dist = join(DIST, sabotage.name);
  await buildFixture(dist, sabotage);
  const server = startFixtureServer({ dist, ...sabotage.server });
  try {
    const report = await runHost(hostOptions(server, 700), fixtureScenario(NOTE.id, server.origin));
    const failed = [...new Set(report.checks.filter((c) => !c.ok).map((c) => c.id))].sort();
    const expected = [...sabotage.expect].sort();
    const exact = !report.ok && JSON.stringify(failed) === JSON.stringify(expected);
    console.log(
      `${exact ? '✓' : '✗'} ${sabotage.name} — ${sabotage.what}: ${
        exact
          ? `exactly ${expected.join(', ')} red`
          : `red ${JSON.stringify(failed)}, expected ${JSON.stringify(expected)}`
      }`
    );
    if (!exact) printReports([[sabotage.name, report]]);
    return exact;
  } finally {
    server.stop();
  }
}

if (process.argv.includes('--controls')) {
  let ok = true;
  for (const sabotage of SABOTAGES) ok = (await control(sabotage)) && ok;
  console.log(
    ok
      ? `\n✓ ${SABOTAGES.length} controls, each red exactly where expected`
      : '\n✗ a control is off'
  );
  process.exit(ok ? 0 : 1);
} else {
  process.exit((await green()) ? 0 : 1);
}
