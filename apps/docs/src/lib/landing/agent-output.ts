/**
 * Die Ausgabe des Design-Gates für `src/lib/salon/BookingCard.svelte` — EINE
 * Wahrheit, zwei Konsumenten: das Terminal-Replay der Agents-Kachel
 * (AgentReplay.svelte, wo der Agent die Karte baut) und der dritte Schritt der
 * Getting-started-Zeile (+page.svelte, wo derselbe Vorgang dem Besucher
 * gehört). Dieselben Zeilen an beiden Stellen, oder sie driften.
 *
 * Ehrlichkeitsvertrag: beide Zeilen sind WÖRTLICH zitierte, echt
 * aufgezeichnete Ausgabe von
 *
 *   bunx urbicon validate src/lib/salon/BookingCard.svelte
 *
 * minus dem wiederholten Dateipfad. Aufgezeichnet 2026-07-31 bei Version
 * 6.45.0 gegen die BEREINIGTE BookingCard (ohne `step`-Demo-Gerüst — die Datei
 * wird seitdem wörtlich in der Source-Ansicht der Agents-Kachel gezeigt); die
 * Ausgabe ist byte-identisch zur Aufzeichnung vom 2026-07-30.
 *
 * Ändert sich BookingCard, wird der Befehl neu ausgeführt und werden diese
 * beiden Zeilen ERSETZT — nicht umformuliert, nicht gekürzt, nicht
 * zusammengezogen.
 */
export const VALIDATE_SCORE =
  'correctness 100/100 · craft 100/100 · 0 error(s), 0 warning(s), 0 craft note(s)';

export const VALIDATE_OK = '✓ no issues';
