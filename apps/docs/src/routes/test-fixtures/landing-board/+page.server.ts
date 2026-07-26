// Build-time-Daten für das Fallblatt-Board. Dieselben Quellen, aus denen der
// MCP-Katalog und die Icon-Seite gebaut werden, plus die Größen-Baseline —
// die Zahlen auf dem Board können damit nie von der ausgelieferten Menge
// abweichen. Nichts hiervon ist handgepflegt.
//
// `_catalog.json` ist ein docs-gen-Artefakt (git-ignoriert): In einem frischen
// Worktree erst `bun run docs:gen:all` laufen lassen.

import type { BoardRow } from '$lib/landing/FlapBoard.svelte';
import baseline from '../../../../../../packages/blocks/bundle-size.baseline.json';
import authCatalog from '../../../../static/auth/_catalog.json';
import blocksCatalog from '../../../../static/blocks/_catalog.json';
import tableCatalog from '../../../../static/table/_catalog.json';

interface CatalogEntry {
  name: string;
  group: string;
  package: string;
  tags?: string[];
}

// ÜBERGANGSLÖSUNG — der docs-gen-Katalog führt kein `stability`-Feld, also
// steht die Statusspalte hier auf einer Namensliste. Für die echte Landing
// braucht es ein JSDoc-Tag, das docs-gen in den Katalog schreibt; sonst ist
// ausgerechnet auf einer Seite, die mit Nicht-Driften wirbt, eine Spalte
// handgepflegt. Vermerkt in docs/internal/LANDING-CONCEPT-2026-07.md.
const BETA = new Set(['Guide', 'GuidePanel', 'A2UIView', 'A2UIViewUrbicon', 'Conversation']);

/** Familie = erster Tag; die gröbste Achse, die der Katalog hergibt. */
function familyFor(entry: CatalogEntry): string {
  const tag = entry.tags?.[0];
  if (tag) return tag;
  if (entry.package.endsWith('/auth')) return 'auth';
  if (entry.package.endsWith('/table')) return 'data';
  return 'misc';
}

export function load(): { rows: BoardRow[] } {
  const sizes = (baseline as { sizes: Record<string, { gz: number }> }).sizes;
  const catalog = [
    ...(blocksCatalog as CatalogEntry[]),
    ...(tableCatalog as CatalogEntry[]),
    ...(authCatalog as CatalogEntry[])
  ];

  const rows: BoardRow[] = catalog.map((entry) => ({
    name: entry.name,
    family: familyFor(entry),
    // `table` und `auth` stehen nicht in der blocks-Baseline; diese Zeilen
    // zeigen "—". Entweder Baselines für die anderen Pakete erzeugen oder die
    // Spalte anders schneiden — offener Punkt im Konzept.
    gz: sizes[entry.name]?.gz ?? null,
    deps: 0,
    status: BETA.has(entry.name) ? 'beta' : 'shipped'
  }));

  // Die Roadmap lebt in der Statusspalte, nicht in einem "Coming soon"-Kasten.
  rows.push({ name: 'Artifacts', family: 'ai', gz: null, deps: 0, status: 'in progress' });
  rows.sort((a, b) => a.name.localeCompare(b.name));

  return { rows };
}
