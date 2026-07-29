// Build-time-Daten für den Hero-Prototyp: dieselben Kataloge, aus denen der
// MCP-Katalog und die Doku-Seiten gebaut werden, plus die Größen-Baseline.
// Die Zahlen im Hero können damit nicht von der ausgelieferten Menge abweichen
// — nichts hiervon ist handgepflegt.
//
// `_catalog.json` ist ein docs-gen-Artefakt (git-ignoriert): In einem frischen
// Worktree erst `bun run docs:gen:all` laufen lassen.

import type { HeroRow, HeroStatus } from '$lib/landing/hero';
import baseline from '../../../../../../bundle-size.baseline.json';
import authCatalog from '../../../../static/auth/_catalog.json';
import blocksCatalog from '../../../../static/blocks/_catalog.json';
import tableCatalog from '../../../../static/table/_catalog.json';

interface CatalogEntry {
  name: string;
  slug: string;
  package: string;
  description: string;
  summary?: string;
  stability?: HeroStatus | 'stable';
  import: string;
  tags?: string[];
  variants?: { name: string; values: string[] }[];
  propCount?: number;
}

/** `@stability` → Statusspalte. Ohne Tag gilt die Komponente als stabil. */
function toStatus(stability: string | undefined): HeroStatus {
  if (stability === 'beta' || stability === 'experimental') return stability;
  return 'shipped';
}

/** Ein Wort, klein geschrieben: `@urbicon-ui/blocks` → `blocks`. */
function shortPkg(pkg: string): string {
  return pkg.split('/').pop() ?? pkg;
}

interface BaselineEntry {
  net?: { gz: number };
  /** Komponenten, die dieser Messwert mit abdeckt (Guide-Familie, DateRangePicker). */
  exports?: string[];
}

export function load(): { rows: HeroRow[]; foundationGz: number } {
  const { sizes, foundation } = baseline as unknown as {
    sizes: Record<string, BaselineEntry>;
    foundation: { gz: number };
  };

  /**
   * Eine Gruppe teilt sich ihren Code, also gilt ihre eine Messung für alle
   * Komponenten darin: Die neun Guide-Oberflächen sind als `Guide` gemessen,
   * `DateRangePicker` innerhalb von `DatePicker`. Ohne diese Auflösung zeigten
   * genau die neun Zeilen einen Gedankenstrich, obwohl die Zahl existiert.
   *
   * Der eigene Eintrag schlägt jede Abdeckung, und zwar in zwei Durchläufen
   * statt in einem: `A2UIViewUrbicon` ist eine Messvariante, die `A2UIView`
   * unter ihren Exports führt — in einem Durchlauf überschrieb sie dessen
   * eigene Zahl mit ihrer eigenen (89 kB wurden zu 114 kB).
   */
  const netByComponent = new Map<string, number>();
  for (const [name, entry] of Object.entries(sizes)) {
    if (entry.net) netByComponent.set(name, entry.net.gz);
  }
  for (const entry of Object.values(sizes)) {
    if (!entry.net) continue;
    for (const covered of entry.exports ?? []) {
      if (!netByComponent.has(covered)) netByComponent.set(covered, entry.net.gz);
    }
  }

  const catalog = [
    ...(blocksCatalog as CatalogEntry[]),
    ...(tableCatalog as CatalogEntry[]),
    ...(authCatalog as CatalogEntry[])
  ];

  const rows: HeroRow[] = catalog.map((entry) => ({
    id: `${shortPkg(entry.package)}:${entry.name}`,
    name: entry.name,
    family: entry.tags?.[0] ?? 'form',
    pkg: shortPkg(entry.package),
    slug: entry.slug,
    // Netto, nicht brutto: siehe `HeroRow.net`. Ein fehlender Eintrag bleibt
    // `null` (→ "—") statt still auf 0 zu fallen; `bun run size` benennt in
    // seinem Bericht jede Katalogkomponente, die keine Messung hat.
    net: netByComponent.get(entry.name) ?? null,
    // Der Katalog liefert die Zahl für alle 97; die Null greift nur, wenn ein
    // Eintrag sie verliert — dann steht sie da und fällt auf, statt still eine
    // plausible Zahl zu erfinden.
    props: entry.propCount ?? 0,
    // Der Reifegrad kommt aus dem `@stability`-JSDoc der Komponente. Vorher
    // stand hier eine handgepflegte Namensliste mit vier Einträgen — bei
    // 38 nicht-stabilen Komponenten. Ausgerechnet auf einer Seite, die mit
    // Nicht-Driften wirbt.
    status: toStatus(entry.stability),
    // `summary` ist der eine Satz für Menschen, `description` der Kontrakt für
    // Agenten (llm.txt, MCP). Der Hero zeigt den kurzen; ohne ihn fiele er auf
    // den langen zurück und schnitte ihn wieder mitten im Satz ab.
    description: (entry.summary ?? entry.description).replace(/\s+/g, ' ').trim(),
    importLine: entry.import,
    axes: (entry.variants ?? []).map((v) => ({ name: v.name, count: v.values.length }))
  }));

  // Die Roadmap lebt in der Statusspalte, nicht in einem "Coming soon"-Kasten.
  rows.push({
    id: 'blocks:Artifacts',
    name: 'Artifacts',
    family: 'ai',
    pkg: 'blocks',
    slug: 'artifacts',
    net: null,
    // Noch nicht ausgeliefert, also gibt es auch keine API zu zählen.
    props: 0,
    status: 'in progress',
    description:
      'Chat-driven generation of whole pages, rendered live in a sandboxed frame — on this set, checked by this linter.',
    importLine: '// not shipped yet',
    axes: []
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));
  // Das Fundament reicht mit, damit die Fußnote seine Größe nennen kann, statt
  // eine Zahl zu wiederholen, die anderswo gemessen wird.
  return { rows, foundationGz: foundation.gz };
}
