/**
 * Datenform des Hero-Inventars (Landing-Prototyp).
 *
 * Der Typ liegt hier statt in `+page.server.ts`, damit ihn Loader *und*
 * Komponenten importieren können, ohne den server-only-Guard zu verletzen.
 */

export type HeroStatus = 'shipped' | 'beta' | 'experimental' | 'in progress';

/** Eine Zeile des Inventars — eine Komponente des Sets. */
export interface HeroRow {
  /** `paket:name` — der Name allein ist über drei Kataloge nicht garantiert eindeutig. */
  id: string;
  name: string;
  /** Familie = erster Katalog-Tag (action, form, display …). */
  family: string;
  /** Kurzname des Pakets: `blocks` · `table` · `auth`. */
  pkg: string;
  /**
   * Katalog-Slug — zusammen mit {@link pkg} der Schlüssel, unter dem der Hero
   * den Playground der Doku-Seite findet. Bewusst ohne die Zwischenebene
   * (`primitives`/`components`): die stimmt nicht überall mit der Route überein
   * — `Table` steht im Katalog unter `primitives`, seine Seite unter
   * `/table/table`.
   */
  slug: string;
  /**
   * Was diese Komponente einem Projekt hinzufügt, das die Library schon
   * benutzt: gzip-Bytes **ohne** das Fundament (tv()-Engine + Provider-Kontext),
   * das jeder Build genau einmal enthält. `null`, wenn die Baseline die
   * Komponente nicht kennt.
   *
   * Die Rohzahl wäre irreführend: Ein `Separator` misst 5,1 kB, davon sind
   * 4,6 kB Fundament — die Spalte zeigte dann für jede Zeile im Wesentlichen
   * denselben Sockel und für keine ihren eigenen Preis.
   */
  net: number | null;
  /**
   * Wie breit die eigene API der Komponente ist — direkte und Varianten-Props,
   * ohne geerbte HTML-Attribute. Aus dem Katalog (`propCount`), also gemessen,
   * nicht geschätzt.
   *
   * Steht anstelle der früheren `Deps`-Spalte: Die zeigte 98-mal dieselbe Null
   * und war nach der zweiten Zeile kein Argument mehr, sondern Tapete. Diese
   * Spalte hat Spannweite (3 bis 59) und sagt etwas, das man der Zeile nicht
   * ansieht.
   */
  props: number;
  status: HeroStatus;
  description: string;
  /** Import-Einzeiler aus dem Katalog. */
  importLine: string;
  /** Variant-Achsen (`intent`, `size`, …) mit Wertanzahl — trägt den Fallback im Panel. */
  axes: { name: string; count: number }[];
}

/**
 * Zeilen, die sich eine Vorschau teilen, und wo die angeklickte Oberfläche
 * darin steckt.
 *
 * Heute ist das genau die Guide-Familie: neun Katalogzeilen, ein Beispiel. Der
 * Katalog hat recht — die neun sind einzeln veröffentlicht — aber ein Besucher,
 * der auf `GuideMarker` klickt und dieselbe Karte wie eben sieht, liest das als
 * Fehler und nicht als System. Der Satz beantwortet die Frage, die der zweite
 * Klick stellt: *Wo ist mein Bauteil?*
 *
 * Die zwei Oberflächen, die das Beispiel **nicht** zeigt, sagen genau das —
 * eine Vorschau, in der das eigene Teil fehlt, ohne Hinweis, ist die
 * unfreundlichere Variante desselben Problems.
 */
export const SHARED_PREVIEW_NOTES: Record<string, string> = {
  guide:
    'The system in one example: a panel of articles, markers on the UI they explain, and links running both ways.',
  'guide-provider': 'Wraps the whole example — it holds the controller every other surface reads.',
  'guide-panel': 'The panel itself, holding the two articles.',
  'guide-article': 'The two articles in the panel: “Billing & plans” and “Managing seats”.',
  'guide-marker': 'The dot beside the “Billing” heading, pointing at the plan row.',
  'guide-mention':
    'The underlined “current plan” and “seat” in the article text — each highlights the row it names.',
  'guide-ref':
    '“managing seats” at the end of the first article — an article-to-article link inside the panel.',
  'guide-beacon':
    'Not in this example — a beacon calls attention to a surface before the reader opens the panel. The docs page shows it.',
  'guide-hint':
    'Not in this example — a hint is the inline note that sits next to a control. The docs page shows it.'
};

/** kB mit einer Nachkommastelle; `null` wird zum Gedankenstrich. */
export function formatKb(bytes: number | null): string {
  return bytes == null ? '—' : (bytes / 1024).toFixed(1);
}
