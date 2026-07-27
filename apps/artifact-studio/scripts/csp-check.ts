#!/usr/bin/env bun
/**
 * csp-check.ts — der Negativtest zur Sandbox.
 *
 * Bis hierher war nur belegt, dass die CSP das Artefakt **nicht behindert**
 * (BEFUNDE §22). Das ist die uninteressante Hälfte: eine Richtlinie, die nichts
 * blockt, behindert auch nichts. Dieses Skript prüft die andere Hälfte — es baut
 * ein Artefakt, das absichtlich alles versucht, was verboten sein soll, und
 * schlägt fehl, wenn auch nur einer dieser Versuche durchkommt.
 *
 * Aufgebaut wird dafür die echte Konstellation, nicht eine Nachbildung:
 *
 *   Host    http://localhost:<PORT+1>   — bettet das Frame ein
 *   Sandbox http://127.0.0.1:5211       — liefert Frame-Dokument und Modul
 *
 * Zwei Origins auf derselben Maschine, `sandbox="allow-scripts
 * allow-same-origin"` wie im Studio. Das Frame-Dokument trägt `ARTIFACT_CSP`
 * — dieselbe Konstante, die `build-version.ts` in jedes echte Artefakt schreibt,
 * importiert statt abgeschrieben.
 *
 * Der Bericht kommt per `postMessage` zurück, weil das der einzige Kanal ist,
 * den die Richtlinie offen lässt — womit der Lauf nebenbei belegt, dass der
 * Kanal des Studios (`artifact:ready`) durch die CSP nicht stirbt.
 *
 * Playwright kommt aus den Root-devDependencies (dieselbe Installation, die die
 * e2e-Suite fährt) — fehlt sie, scheitert der Import laut, was hier richtig ist.
 *
 * Usage: bun scripts/csp-check.ts [--headed]
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { ARTIFACT_CSP } from '../src/lib/server/build-version';
import { ARTIFACTS_DIR } from '../src/lib/server/paths';
import { SANDBOX_HOST, SANDBOX_PORT, startSandboxServer } from '../src/lib/server/sandbox';

/** Eigene Sitzungs-ID mit `__`-Präfix: keine echte Sitzung, aber im selben Baum,
 *  damit der Sandbox-Server sie unverändert ausliefert. */
const SESSION = '__csp-check';
const HOST_PORT = SANDBOX_PORT + 1;

/**
 * Was das Artefakt versucht. Jeder Eintrag muss scheitern — `expect` beschreibt,
 * woran man das Scheitern erkennt, und steht hier, damit ein Fehlschlag im
 * Bericht selbsterklärend ist statt nur „false".
 */
const PROBES = [
  { id: 'fetch', why: "connect-src 'none' — kein Netzwerk aus dem Artefakt" },
  { id: 'websocket', why: "connect-src 'none' gilt auch für WebSockets" },
  {
    id: 'beacon',
    why: "connect-src 'none' gilt auch für sendBeacon",
    // Der Rückgabewert lügt (er quittiert die Queue, nicht die Zustellung), also
    // zählt hier ausschließlich, ob der Host je etwas gesehen hat.
    viaHost: '/beacon'
  },
  { id: 'external-script', why: "script-src 'self' — kein fremder Code" },
  { id: 'inline-script', why: "script-src 'self' ohne 'unsafe-inline'" },
  { id: 'eval', why: "script-src 'self' ohne 'unsafe-eval'" },
  { id: 'external-image', why: "img-src 'self' data: — kein Tracking-Pixel" },
  { id: 'parent-dom', why: 'fremde Origin — allow-same-origin gilt nur für sich selbst' }
] as const;

/**
 * Das Artefakt-Modul. Bewusst ohne Framework: getestet wird die Richtlinie des
 * Dokuments, nicht der Build. Jede Sonde meldet `blocked: true`, wenn der
 * Versuch scheiterte — und `false`, wenn er durchkam.
 */
const PROBE_MODULE = `
const results = {};
const report = (id, blocked, detail) => { results[id] = { blocked, detail: String(detail ?? '') }; };

// 1. fetch auf den Host — connect-src 'none'
try {
  await fetch('http://localhost:${HOST_PORT}/ping', { mode: 'no-cors' });
  report('fetch', false, 'request went through');
} catch (e) { report('fetch', true, e.message); }

// 2. WebSocket — dieselbe Direktive, anderer Transport
try {
  const ws = new WebSocket('ws://localhost:${HOST_PORT}/socket');
  await new Promise((resolve) => {
    ws.onerror = () => resolve(report('websocket', true, 'error event'));
    ws.onopen = () => resolve(report('websocket', false, 'socket opened'));
    setTimeout(() => resolve(report('websocket', true, 'never opened')), 800);
  });
} catch (e) { report('websocket', true, e.message); }

// 3. sendBeacon — der stille Exfil-Pfad, der keine Antwort braucht. Sein
// Rückgabewert taugt nicht als Beleg (siehe unten, der Host entscheidet):
// Chromium quittiert das Einreihen in die Queue mit true und blockt erst danach.
try {
  const sent = navigator.sendBeacon('http://localhost:${HOST_PORT}/beacon', 'x');
  report('beacon', !sent, sent ? 'queued (Host entscheidet)' : 'refused');
} catch (e) { report('beacon', true, e.message); }

// 4. fremdes Script nachladen — script-src 'self'
await new Promise((resolve) => {
  const s = document.createElement('script');
  s.src = 'http://localhost:${HOST_PORT}/evil.js';
  s.onload = () => resolve(report('external-script', false, 'script executed'));
  s.onerror = () => resolve(report('external-script', true, 'error event'));
  document.head.append(s);
  setTimeout(() => resolve(report('external-script', true, 'never loaded')), 800);
});

// 5. Inline-Script injizieren — kein 'unsafe-inline' in script-src
{
  const s = document.createElement('script');
  s.textContent = 'window.__inlineRan = true;';
  document.head.append(s);
  report('inline-script', window.__inlineRan !== true, window.__inlineRan ? 'inline ran' : 'never ran');
}

// 6. eval — kein 'unsafe-eval'. Der Aufruf steht hier absichtlich: geprüft wird,
// dass die Richtlinie ihn verhindert. Er läuft im Sandbox-Frame, nicht im Host,
// und der ausgewertete Ausdruck ist die Konstante '1 + 1'.
try {
  const v = eval('1 + 1');
  report('eval', false, 'eval returned ' + v);
} catch (e) { report('eval', true, e.constructor.name); }

// 7. externes Bild — img-src 'self' data:
await new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(report('external-image', false, 'image loaded'));
  img.onerror = () => resolve(report('external-image', true, 'error event'));
  img.src = 'http://localhost:${HOST_PORT}/pixel.png';
  setTimeout(() => resolve(report('external-image', true, 'never loaded')), 800);
});

// 8. an den Host greifen — das ist die Origin-Trennung, nicht die CSP.
// Sie steht mit im Bericht, weil beide zusammen die Zusage ergeben.
try {
  const title = window.parent.document.title;
  report('parent-dom', false, 'read parent title: ' + title);
} catch (e) { report('parent-dom', true, e.constructor.name); }

document.body.textContent = 'probes done';
window.parent.postMessage({ type: 'csp-check:done', results }, '*');
`;

/**
 * Frame-Dokument + Modul schreiben — Aufbau wie in `build-version.ts`.
 *
 * `withCsp: false` lässt die Richtlinie weg. Das ist die Gegenprobe zum Test
 * selbst: acht grüne Haken belegen nur dann etwas, wenn dieselben acht Sonden
 * ohne CSP durchkommen. Ein Test, der immer grün ist, misst nichts.
 */
function writeFixture(includeCsp: boolean): string {
  const dist = join(ARTIFACTS_DIR, SESSION, 'dist');
  rmSync(join(ARTIFACTS_DIR, SESSION), { recursive: true, force: true });
  mkdirSync(join(dist, 'v1'), { recursive: true });
  writeFileSync(join(dist, 'v1', 'v1.js'), PROBE_MODULE);
  writeFileSync(
    join(dist, 'frame-v1.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>CSP probe</title>
${includeCsp ? `    <meta http-equiv="Content-Security-Policy" content="${ARTIFACT_CSP}" />` : '    <!-- deliberately no CSP: --without-csp -->'}
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./v1/v1.js"></script>
  </body>
</html>
`
  );
  return dist;
}

/**
 * Der Host: liefert die einbettende Seite und beantwortet jede Sonde, die
 * durchkäme. Antwortet also willig — wenn trotzdem nichts ankommt, war es die
 * Richtlinie und nicht ein toter Server.
 *
 * **Er führt Protokoll, und das ist der eigentliche Beweis.** Was das Artefakt
 * über sich selbst berichtet, ist Hörensagen: `navigator.sendBeacon` gibt `true`
 * zurück, sobald der Browser den Request eingereiht hat, und blockt ihn erst
 * danach — die Sonde meldete „durchgekommen", während die Konsole den Verstoß
 * protokollierte. Nur der Empfänger weiß, ob etwas ankam.
 */
function startHost(log: string[]): Promise<ReturnType<typeof createServer>> {
  const server = createServer((req, res) => {
    if (req.url && req.url !== '/') log.push(req.url);
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>CSP check host</title></head>
  <body>
    <iframe
      src="http://${SANDBOX_HOST}:${SANDBOX_PORT}/${SESSION}/dist/frame-v1.html"
      sandbox="allow-scripts allow-same-origin"
      style="width: 600px; height: 300px"
    ></iframe>
    <script>
      window.__result = null;
      addEventListener('message', (e) => {
        if (e.data?.type === 'csp-check:done') window.__result = e.data.results;
      });
    </script>
  </body>
</html>`);
      return;
    }
    if (req.url === '/evil.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end('window.__evilRan = true;');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });
  return new Promise((resolve, reject) => {
    server.once('listening', () => resolve(server));
    server.once('error', reject);
    server.listen(HOST_PORT, 'localhost');
  });
}

const { values } = parseArgs({
  options: { headed: { type: 'boolean' }, 'without-csp': { type: 'boolean' } },
  strict: true
});
const withCsp = !values['without-csp'];

writeFixture(withCsp);
/** Alles, was den Host trotz `connect-src 'none'` erreicht hat — muss leer bleiben. */
const received: string[] = [];
const sandbox = await startSandboxServer();
const host = await startHost(received);
const browser = await chromium.launch({ headless: !values.headed });

const violations: string[] = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (/content security policy|refused to/i.test(t)) violations.push(t);
  });

  await page.goto(`http://localhost:${HOST_PORT}/`);
  await page.waitForFunction(() => (window as { __result?: unknown }).__result !== null, {
    timeout: 20_000
  });
  const results = (await page.evaluate(
    () => (window as { __result?: unknown }).__result
  )) as Record<string, { blocked: boolean; detail: string }>;

  let failed = 0;

  if (withCsp) {
    console.log('\nCSP-Negativtest — jede Zeile muss „blockiert" sein\n');
    for (const probe of PROBES) {
      const r = results[probe.id];
      const viaHost = 'viaHost' in probe ? probe.viaHost : undefined;
      const ok = viaHost ? !received.some((u) => u.startsWith(viaHost)) : r?.blocked === true;
      if (!ok) failed++;
      const detail = viaHost ? `Host sah nichts auf ${viaHost}` : (r?.detail ?? 'keine Antwort');
      console.log(
        `  ${ok ? '✓ blockiert  ' : '✗ DURCHGEKOMMEN'} ${probe.id.padEnd(16)} ${detail}\n` +
          `${' '.repeat(20)}${probe.why}`
      );
    }

    // Die harte Prüfung: nicht was das Artefakt über sich sagt, sondern was den
    // Host erreicht hat. Alles außer der eingebetteten Seite selbst ist ein Leck.
    if (received.length > 0) {
      console.error(`\n✗ Der Host wurde trotzdem erreicht: ${received.join(', ')}`);
      failed++;
    } else {
      console.log('\n  ✓ Der Host hat keine einzige Anfrage aus dem Artefakt gesehen.');
    }

    console.log(`\n  ${violations.length} CSP-Verstöße in der Konsole gemeldet:`);
    for (const v of new Set(violations)) console.log(`    · ${v.slice(0, 140)}`);

    // Ein Lauf ohne einen einzigen Konsolen-Verstoß wäre verdächtig: dann hätten
    // die Sonden vermutlich gar nicht erst gefeuert, und acht grüne Haken wären
    // ein Trugschluss.
    if (violations.length === 0) {
      console.error('\n✗ Kein einziger CSP-Verstoß gemeldet — hat das Artefakt überhaupt geladen?');
      failed++;
    }

    console.log(
      failed === 0
        ? '\n✓ Die Richtlinie blockt, was sie blocken soll.\n'
        : `\n✗ ${failed} Prüfung(en) fehlgeschlagen.\n`
    );
  } else {
    // Gegenprobe: ohne Richtlinie müssen dieselben Sonden ankommen. Gemessen wird
    // am Host und an den zwei Sonden, die keinen Server brauchen — `parent-dom`
    // bleibt auch hier blockiert, denn dahinter steht die Origin-Trennung, nicht
    // die CSP. Genau diese Zeile zeigt, was die CSP beiträgt und was nicht.
    console.log('\nGegenprobe ohne CSP — dieselben Sonden müssen jetzt DURCHKOMMEN\n');
    for (const probe of PROBES) {
      const r = results[probe.id];
      console.log(
        `  ${r?.blocked ? 'blockiert     ' : 'durchgekommen '} ${probe.id.padEnd(16)} ${r?.detail ?? ''}`
      );
    }
    console.log(`\n  Host sah: ${received.length ? received.join(', ') : 'nichts'}`);
    console.log(`  CSP-Verstöße in der Konsole: ${violations.length}`);

    const inlineRan = results['inline-script']?.blocked === false;
    const evalRan = results.eval?.blocked === false;
    const ok = received.length > 0 && inlineRan && evalRan && violations.length === 0;
    if (!ok) failed++;
    console.log(
      ok
        ? '\n✓ Die Sonden feuern wirklich — der grüne Lauf oben misst also etwas.\n'
        : '\n✗ Die Sonden kommen auch ohne CSP nicht durch — der Test misst nicht, was er behauptet.\n'
    );
  }

  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  await browser.close();
  host.close();
  sandbox.close();
  rmSync(join(ARTIFACTS_DIR, SESSION), { recursive: true, force: true });
}
