#!/usr/bin/env bun
/**
 * build-version.ts — eine Version einer Sitzung in abspielbare Form bringen.
 *
 * Läuft als **eigener Prozess**, aufgerufen von `session.ts`. Der Grund ist
 * nicht Sauberkeit, sondern Vite: die App ist selbst ein laufender Vite-Dev-
 * Server, und `build()` aus ihm heraus aufzurufen hieße, eine zweite Vite-Instanz
 * in denselben Modulgraphen zu setzen. Ein Subprozess kostet ~200 ms Start und
 * ist dafür vollständig isoliert.
 *
 * Ausgabe je Sitzung:
 *
 *   dist/shared-<hash>.css     ein Stylesheet für ALLE Versionen der Sitzung
 *   dist/v<n>/…                Entry + Chunks + Komponenten-CSS
 *   dist/frame-v<n>.html       das Sandbox-Dokument
 *
 * Drei Entscheidungen stecken hier drin, alle in W0 gemessen (BEFUNDE.md):
 *  - **EIN gemeinsames Stylesheet** statt eines pro Version. Das CSS ist zu
 *    98,5 % Token-Layer, also für jede Version fast identisch; der Content-Hash
 *    macht `immutable` ehrlich. (Sitzungslokal statt global: für eine lokale App
 *    zählt die Iterationszeit, nicht der Cache über Sitzungen hinweg — das
 *    Format bleibt dasselbe.)
 *  - **Kein `inlineDynamicImports`** — es hebt den lazy Mint-Registry-Import aus
 *    seiner Reihenfolge und das Artefakt stirbt beim Start mit
 *    `init_registry is not a function`.
 *  - **Das Komponenten-CSS muss mit.** Die blocks-Komponenten bringen eigene
 *    `<style>`-Blöcke mit (Icon-Animationen, Checkbox-/Progress-Details). Wer
 *    sie vergisst, liefert Artefakte mit fehlenden Animationen aus — in W0 fiel
 *    es nur nicht auf, weil das erste Artefakt sie nicht brauchte.
 *
 * Usage: bun build-version.ts --session <id> --version <n>
 *        → JSON auf stdout, Fortschritt auf stderr
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { build } from 'vite';
import { REPO_ROOT, sessionDir } from './paths';

const APP_ROOT = join(REPO_ROOT, 'apps/artifact-studio');

/**
 * Die Richtlinie des Frame-Dokuments — default-deny, und alles Weitere einzeln
 * erlaubt: eigene Skripte und Stile, Bilder und Schriften auch als `data:`
 * (Svelte inlinet kleine Assets), **kein** Netzwerk (`connect-src 'none'`),
 * **kein** Formularziel, **keine** `<base>`-Umleitung.
 *
 * `style-src` braucht `'unsafe-inline'`: Svelte setzt `style=`-Attribute, und
 * Tailwind-Utilities landen zwar in Dateien, die Komponenten-Animationen aber
 * teils inline. Das ist die eine bewusste Lockerung — sie erlaubt Aussehen,
 * keinen Code.
 *
 * Als Konstante und nicht im Template, damit `scripts/csp-check.ts` **genau
 * diese** Richtlinie prüft statt einer Abschrift, die auseinanderlaufen kann.
 */
export const ARTIFACT_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self' data:; connect-src 'none'; " +
  "form-action 'none'; base-uri 'none'";

export interface BuildResult {
  version: number;
  /** Dateiname des Sandbox-Dokuments, relativ zu `dist/`. */
  frame: string;
  sharedCss: string;
  entry: string;
  chunks: string[];
  componentCss: string[];
}

/**
 * Die Version bauen. Exportiert, damit ein Test sie ohne Subprozess aufrufen
 * kann — der Serverpfad geht trotzdem über `spawn` (siehe Kopf).
 */
export async function buildVersion(sessionId: string, version: number): Promise<BuildResult> {
  const dir = sessionDir(sessionId);
  const dist = join(dir, 'dist');
  const tmp = join(dir, '.build');
  const source = join(dir, 'versions', `v${version}.svelte`);
  if (!existsSync(source)) {
    throw new Error(`Kein Quelltext für Version ${version} unter ${source}.`);
  }

  mkdirSync(dist, { recursive: true });
  mkdirSync(tmp, { recursive: true });

  // ── 1. JS-Entry dieser Version ────────────────────────────────────────────
  // Der Entry meldet sich nach dem Mounten beim Host (SEP-1865-Kanal). Das ist
  // nicht nur Telemetrie: ein Frame, der nichts meldet, ist der einzige Weg, ein
  // stilles Scheitern (CSP blockt das Modul) von „lädt noch" zu unterscheiden.
  const entrySrc = join(tmp, `v${version}-entry.ts`);
  writeFileSync(
    entrySrc,
    [
      `import { mount } from 'svelte';`,
      `import Artifact from ${JSON.stringify(source)};`,
      ``,
      `const t0 = performance.now();`,
      `mount(Artifact, { target: document.getElementById('app') as HTMLElement });`,
      `requestAnimationFrame(() =>`,
      `  requestAnimationFrame(() => {`,
      `    parent.postMessage(`,
      `      {`,
      `        type: 'artifact:ready',`,
      `        version: ${version},`,
      `        mountToPaintMs: Math.round((performance.now() - t0) * 10) / 10,`,
      `        nodes: document.getElementById('app')?.querySelectorAll('*').length ?? 0`,
      `      },`,
      `      '*'`,
      `    );`,
      `  })`,
      `);`,
      ''
    ].join('\n')
  );

  const outDir = join(dist, `v${version}`);
  await build({
    root: APP_ROOT,
    logLevel: 'error',
    // `configFile: false` auf beiden Ebenen: die App hat eine `svelte.config.js`
    // mit einem `kit`-Block und eine `vite.config.ts` mit dem SvelteKit-Plugin.
    // Beides würde dieser Build mitladen und daran scheitern — er baut eine
    // nackte Svelte-Komponente, keine SvelteKit-App.
    configFile: false,
    plugins: [svelte({ configFile: false, compilerOptions: { runes: true } })],
    build: {
      outDir,
      emptyOutDir: true,
      minify: 'esbuild',
      cssCodeSplit: false,
      rollupOptions: {
        input: entrySrc,
        output: { entryFileNames: `v${version}.js`, chunkFileNames: `v${version}-[name].js` }
      }
    }
  });

  const jsFiles = readdirSync(outDir).filter((f) => f.endsWith('.js'));
  const assetsDir = join(outDir, 'assets');
  const componentCss = existsSync(assetsDir)
    ? readdirSync(assetsDir).filter((f) => f.endsWith('.css'))
    : [];

  // ── 2. Das gemeinsame Stylesheet, über ALLE Versionen der Sitzung ─────────
  // Neu gebaut bei jeder Version, weil ein neuer Wunsch neue Utilities bringen
  // kann (`grid-cols-3`, `gap-8`). Kamen keine dazu, ist der Content-Hash
  // derselbe und der Browser lädt nichts nach.
  const builtEntries = readdirSync(dist)
    .filter((d) => /^v\d+$/.test(d))
    .map((d) => join(dist, d, `${d}.js`))
    .filter((f) => existsSync(f));

  const sharedEntry = join(tmp, 'shared.css');
  writeFileSync(
    sharedEntry,
    [
      `@import 'tailwindcss' source(none);`,
      `@import '@urbicon-ui/blocks/style/index.css';`,
      `@source '${join(REPO_ROOT, 'packages/blocks/dist')}';`,
      // Die artefakt-eigenen Klassen (max-w-xl, min-h-screen …) stehen nicht in
      // blocks/dist. Gescannt wird das gebaute Bundle, nicht die Quelle: nach
      // dem Build stehen dort genau die Klassen, die wirklich gerendert werden.
      ...builtEntries.map((f) => `@source '${f}';`),
      ''
    ].join('\n')
  );

  const cssOut = join(tmp, 'css');
  await build({
    root: APP_ROOT,
    logLevel: 'error',
    configFile: false,
    plugins: [tailwindcss()],
    build: {
      outDir: cssOut,
      emptyOutDir: true,
      cssMinify: true,
      rollupOptions: { input: sharedEntry, output: { assetFileNames: 'shared.[ext]' } }
    }
  });

  const sharedCss = readFileSync(join(cssOut, 'shared.css'));
  const hash = createHash('sha256').update(sharedCss).digest('hex').slice(0, 8);
  const sharedName = `shared-${hash}.css`;
  writeFileSync(join(dist, sharedName), sharedCss);
  // Ältere Stylesheets derselben Sitzung räumen — sie sind durch den Hash
  // eindeutig, aber niemand liest sie mehr, und jede Version ließe sonst eines
  // liegen. Die Frame-Dokumente werden gleich neu geschrieben.
  for (const f of readdirSync(dist)) {
    if (f.startsWith('shared-') && f.endsWith('.css') && f !== sharedName) {
      rmSync(join(dist, f), { force: true });
    }
  }

  // ── 3. Die Sandbox-Dokumente ──────────────────────────────────────────────
  // Statisch geschrieben statt zur Laufzeit zusammengesetzt: ein Loader-Script
  // bräuchte entweder inline-JS (das die CSP verbietet) oder eine weitere
  // Anfrage vor dem ersten Byte Artefakt.
  //
  // Alle Versionen neu, nicht nur die aktuelle: der Stylesheet-Name kann sich
  // geändert haben, und ein Frame, der auf ein gelöschtes Stylesheet zeigt,
  // rendert ungestylt.
  for (const d of readdirSync(dist).filter((x) => /^v\d+$/.test(x))) {
    const n = Number(d.slice(1));
    const vAssets = join(dist, d, 'assets');
    const vCss = existsSync(vAssets) ? readdirSync(vAssets).filter((f) => f.endsWith('.css')) : [];
    writeFileSync(
      join(dist, `frame-v${n}.html`),
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Artifact v${n}</title>
    <meta http-equiv="Content-Security-Policy" content="${ARTIFACT_CSP}" />
    <link rel="stylesheet" href="./${sharedName}" />
${vCss.map((f) => `    <link rel="stylesheet" href="./${d}/assets/${f}" />`).join('\n')}
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./${d}/${d}.js"></script>
  </body>
</html>
`
    );
  }

  rmSync(tmp, { recursive: true, force: true });

  return {
    version,
    frame: `frame-v${version}.html`,
    sharedCss: sharedName,
    entry: `v${version}/v${version}.js`,
    chunks: jsFiles.filter((f) => f !== `v${version}.js`).map((f) => `v${version}/${f}`),
    componentCss: componentCss.map((f) => `v${version}/assets/${f}`)
  };
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { session: { type: 'string' }, version: { type: 'string' } },
    strict: true
  });
  if (!values.session || !values.version) {
    console.error('Usage: bun build-version.ts --session <id> --version <n>');
    process.exit(1);
  }
  const result = await buildVersion(values.session, Number(values.version));
  // Die einzige Zeile auf stdout ist das Ergebnis — Vite schreibt seine
  // Meldungen auf stderr, der Aufrufer parst also nie versehentlich Prosa.
  process.stdout.write(JSON.stringify(result));
}
