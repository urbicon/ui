// Das Hero-Fixture nutzt exakt die Build-time-Daten der Landing (Kataloge +
// Größen-Baseline) — eine Quelle, keine Kopie: #lib/server/landing.
import { loadLandingRows } from '#lib/server/landing.js';

export function load() {
  return loadLandingRows();
}
