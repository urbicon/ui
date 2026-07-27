/**
 * cost.ts — was ein Turn gekostet hat, in Dollar.
 *
 * Steht hier und nicht im Loop, weil die naive Rechnung (Input × Preis) bei
 * aktivem Caching um ein Vielfaches danebenliegt: Reads kosten ein Zehntel,
 * Writes ein Viertel mehr. Genau diese Rechnung wies einen Lauf mit $9,27 statt
 * der erwarteten Größenordnung aus (BEFUNDE §11) — dort fehlte allerdings das
 * Caching selbst, nicht die Formel.
 *
 * Die drei Input-Zahlen sind disjunkt: `inputTokens` ist ausschließlich der
 * **ungecachte Rest**, nicht die Summe.
 */

/**
 * Listenpreise je Modell, $/MTok. Cache-Read ist 0,1×, Cache-Write 1,25× des
 * Input-Preises (5-Minuten-TTL) — ausgeschrieben statt gerechnet, damit die
 * Zahlen gegen die Preisseite prüfbar bleiben.
 *
 * Sonnet 5 steht mit seinem **regulären** Preis ($3/$15). Bis 2026-08-31 läuft
 * ein Einführungspreis von $2/$10; die tatsächliche Rechnung fällt also
 * niedriger aus. Ein Vorteil, der mit einer Aktion ausläuft, ist keine
 * Grundlage für eine Zahl, die länger gelten soll.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 }
};

export interface TurnUsage {
  /** Nur der ungecachte Rest — NICHT die gesamte Prompt-Größe. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export function costOf(usage: TurnUsage, model: string): number {
  const price = PRICES[model];
  if (!price) {
    // Fail-loud: eine stillschweigend falsche Kostenzahl ist schlimmer als keine
    // — genau diese Bugklasse hat den 20,7×-Input-Befund verzögert.
    throw new Error(
      `Kein Preis für "${model}" hinterlegt. Bekannt: ${Object.keys(PRICES).join(', ')}.`
    );
  }
  return (
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.input * 0.1 +
      usage.cacheCreationTokens * price.input * 1.25) /
    1_000_000
  );
}

export const KNOWN_MODELS = Object.keys(PRICES);
