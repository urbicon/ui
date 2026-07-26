/**
 * Erzeugt `board-data.js` für den Fallblatt-Prototypen aus den echten Quellen:
 * docs-gen-Kataloge (Namen, Familien) + bundle-size.baseline.json (GZIP).
 *
 * Die Kataloge sind git-ignorierte docs-gen-Artefakte. In einem frischen
 * Worktree fehlen sie, deshalb fällt der Pfad auf den Hauptbaum zurück.
 *
 *   bun prototypes/landing-board/gen-data.ts
 */
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKTREE_ROOT = join(HERE, '..', '..');
const MAIN_ROOT = '/Users/felix/Workspace/ui';

/** Kataloge liegen nur im Hauptbaum, falls docs:gen hier noch nicht lief. */
function catalogPath(pkg: string): string {
  const local = join(WORKTREE_ROOT, 'apps/docs/static', pkg, '_catalog.json');
  return existsSync(local) ? local : join(MAIN_ROOT, 'apps/docs/static', pkg, '_catalog.json');
}

interface CatalogEntry {
  name: string;
  group: string;
  package: string;
  tags?: string[];
}

interface BoardRow {
  name: string;
  family: string;
  /** min+gzip in Bytes, netto ohne Svelte. `null` = kein Baseline-Eintrag. */
  gz: number | null;
  deps: 0;
  status: 'shipped' | 'beta' | 'in progress';
}

const blocks: CatalogEntry[] = require(catalogPath('blocks'));
const table: CatalogEntry[] = require(catalogPath('table'));
const auth: CatalogEntry[] = require(catalogPath('auth'));
const baseline = require(join(WORKTREE_ROOT, 'packages/blocks/bundle-size.baseline.json'));

// PROTOTYP-HEURISTIK — der Katalog führt (noch) kein `stability`-Feld, siehe
// docs/internal/LANDING-CONCEPT-2026-07.md → "Offene Punkte". Für die echte
// Seite braucht die STATUS-Spalte eine Quelle (JSDoc-Tag → docs-gen).
const BETA = new Set(['Guide', 'GuidePanel', 'A2UIView', 'A2UIViewUrbicon', 'Conversation']);

function statusFor(name: string): BoardRow['status'] {
  return BETA.has(name) ? 'beta' : 'shipped';
}

/** Familie = erster Tag; das ist die gröbste Achse, die der Katalog hergibt. */
function familyFor(entry: CatalogEntry): string {
  const tag = entry.tags?.[0];
  if (tag) return tag;
  // Ohne Tags aus dem Paket ableiten, damit keine Zelle leer bleibt.
  if (entry.package.endsWith('/auth')) return 'auth';
  if (entry.package.endsWith('/table')) return 'data';
  return 'misc';
}

const rows: BoardRow[] = [...blocks, ...table, ...auth].map((entry) => ({
  name: entry.name,
  family: familyFor(entry),
  gz: baseline.sizes[entry.name]?.gz ?? null,
  deps: 0 as const,
  status: statusFor(entry.name)
}));

// Die Roadmap lebt in der STATUS-Spalte statt in einem "Coming soon"-Kasten.
rows.push({ name: 'Artifacts', family: 'ai', gz: null, deps: 0, status: 'in progress' });

rows.sort((a, b) => a.name.localeCompare(b.name));

const withGz = rows.filter((r) => r.gz !== null).length;
console.log(
  `${rows.length} Zeilen · ${withGz} mit GZIP-Zahl · ` +
    `${new Set(rows.map((r) => r.family)).size} Familien · ` +
    `${rows.filter((r) => r.status !== 'shipped').length} nicht "shipped"`
);

await writeFile(
  join(HERE, 'board-data.js'),
  `// Generiert von gen-data.ts — nicht von Hand bearbeiten.\n` +
    `window.BOARD_DATA = ${JSON.stringify(rows, null, 0)};\n`
);
console.log('→ board-data.js geschrieben');
