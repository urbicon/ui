/**
 * Der Text der Namens-Kachel — Eyebrow, Anspruch, Fußzeile.
 *
 * Steht hier und nicht in `+page.svelte`, weil ihn zwei Oberflächen tragen:
 * die Kachel selbst und das Social-Bild (`test-fixtures/og`, aus dem
 * `apps/docs/static/og.png` aufgenommen wird). Bis 2026-08-04 waren es zwei
 * Kopien, und sie sind auseinandergelaufen: das Bild warb noch mit „Depends on
 * nothing." und „one package · one grammar · one gate", während die Kachel
 * schon den heutigen Anspruch trug. Aus einer Quelle gelesen kann das nicht
 * mehr passieren — ein Gate, das die beiden vergleicht, braucht es dann nicht.
 */

export const EYEBROW = 'UI platform for Svelte 5 + Tailwind 4';

/** Die Marke; „ui" ist die Gattung und tritt in der Darstellung zurück. */
export const BRAND = 'urbicon';
export const BRAND_SUFFIX = 'ui';

/**
 * Der Anspruch in zwei Hälften: die erste ist die Eintrittskarte (0 Deps hat
 * nicht nur diese Bibliothek), die zweite das Argument — also trägt nur sie
 * die volle Helligkeit.
 */
export const CLAIM_LEAD = 'Zero dependencies.';
export const CLAIM_POINT = 'No drift.';

/**
 * Die Fußzeile der Kachel. Bis 2026-08-03 stand hier „one package · one
 * grammar · one gate". Die Dreizahl war nicht das Problem, die dreifache
 * Anapher war es: `one … one … one …` ist die Figur einer Parole, und
 * gesperrte Mono-Versalie auf Ink liefert die Optik dazu. Der Satz sagt jetzt
 * dasselbe (alles darin wurde darin gemacht) ohne die Figur — und er ist die
 * These der Seite, nicht ihre Aufzählung.
 */
export const PROOF = 'Everything in it was made in it.';
