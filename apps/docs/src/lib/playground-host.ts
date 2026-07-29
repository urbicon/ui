import type { PlaygroundConfiguratorProps } from '@urbicon-ui/docs';

/**
 * Signatur einer `Playground.svelte` — der herausgelösten Playground-Konfiguration
 * einer Komponente (Controls, Defaults, Code-Generator, Verwendungs-Snippet).
 *
 * Die Datei liegt neben der `api.ts` der jeweiligen Doku-Seite und hat zwei
 * Konsumenten: die Doku-Seite selbst und der Landing-Hero, der sie über
 * `import.meta.glob` lazy nachlädt. Dadurch gibt es pro Komponente genau **ein**
 * gepflegtes Beispiel statt eines zweiten, das im Hero nachgebaut wird und
 * driftet.
 *
 * Durchgereicht wird nur, was die Einbettung betrifft — Dichte, Kopfzeile und
 * Slot-Klassen. Controls, Werte und Beispieldaten gehören der Komponente und
 * werden vom Aufrufer bewusst *nicht* überschrieben.
 */
export type PlaygroundHostProps = Pick<
  PlaygroundConfiguratorProps,
  'size' | 'showHeader' | 'slotClasses' | 'class'
>;
