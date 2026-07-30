/**
 * Kanal-Register-Generator — emittiert `src/lib/landing/channels.ts`.
 *
 * Ein Farbrad, eine Formel, zwei Ebenen: Themen-Kanäle (die fünf
 * Landing-Kacheln) und Familien-Kanäle (die neun Katalog-Familien). Jeder
 * Kanal ist ein Hue mit drei Stufen, eine je Rolle:
 *
 *   solid  — Cusp (Sättigungsmaximum des Hues, ×0.98 Gamut-Puffer): die FLÄCHE.
 *   deep   — L 0.32 bei gedeckeltem Chroma: Text auf dieser Fläche.
 *   accent — der Kanal auf hellem Grund (Linie, Marke, Indikator): die HELLSTE
 *            Stufe mit ≥ ACCENT_ON_PAPER gegen das Papier.
 *
 * Nichts davon ist gewählt, alles gemessen. Die on-Farbe des Volltons: Tiefe,
 * wenn das Paar ≥ 4:1 schafft (helle Cusps, Gelb→Cyan-Zone), sonst Paper
 * (dunkle Cusps, Blau→Rot-Zone). Die Wachen unten brechen den Lauf, wenn eine
 * Stufe ihre Rolle nicht trägt.
 *
 * Aufruf: `bun apps/docs/scripts/channels-gen.ts` (vom Repo-Root).
 * Die emittierte Datei ist eingecheckt — Regeneration nur bei
 * Registeränderung hier. Konzept:
 * docs/internal/LANDING-CONCEPT-2026-07.md → "Struktur v2".
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type RGB = [number, number, number];

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklchToRgb(L: number, C: number, H: number): RGB {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const [l, m, s] = [l_, m_, s_].map((x) => x ** 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ].map(linearToSrgb) as RGB;
}

const inGamut = (rgb: RGB) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

function maxChroma(L: number, H: number): number {
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb(L, mid, H))) lo = mid;
    else hi = mid;
  }
  return lo;
}

function relLum(rgb: RGB): number {
  const [r, g, b] = rgb.map((c) => srgbToLinear(Math.min(1, Math.max(0, c))));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Landing-Paper (Light) — Referenz für die on-Farben-Messung. */
const PAPER = 'oklch(0.97 0.002 100)';
const PAPER_RGB: RGB = oklchToRgb(0.97, 0.002, 100);
const ON_PAIR_FLOOR = 4;

/**
 * Kontrastziel der Akzent-Stufe gegen das Papier. 3:1 ist die WCAG-Schwelle für
 * Nicht-Text (Linien, Indikatoren, Marken) und für großen Text — genau die
 * Rollen, in denen der Kanal auf hellem Grund auftritt. Höher zu gehen kostet
 * genau das, was diese Stufe liefern soll: der Ton würde wieder ins Tiefe
 * rutschen, wo alle zehn Hues gleich aussehen.
 */
const ACCENT_ON_PAPER = 3;
/** Dunkle Schrift auf der Akzent-Fläche — dieselbe Rolle wie `on` beim Vollton. */
const ACCENT_INK_L = 0.2;

const round = (x: number, d: number) => Number(x.toFixed(d));

interface RegisterEntry {
  /** Farbname des Kanals (Registerschlüssel). */
  name: string;
  /** `null` = unbunter Ink-Kanal (Gerüst hat keine Farbe). */
  hue: number | null;
}

// ── Das Register ────────────────────────────────────────────────────
// Grün (145) und Gelb (100) sind Erzählfarben der Kacheln und werden
// keiner Familie gegeben (Intent-Nähe zu success/warning in den Docs).
const REGISTER: RegisterEntry[] = [
  { name: 'orange', hue: 40 },
  { name: 'yellow', hue: 100 },
  { name: 'green', hue: 145 },
  { name: 'teal', hue: 175 },
  { name: 'cyan', hue: 200 },
  { name: 'azure', hue: 230 },
  { name: 'blue', hue: 255 },
  { name: 'purple', hue: 310 },
  { name: 'magenta', hue: 330 },
  { name: 'red', hue: 15 },
  { name: 'ink', hue: null }
];

/** Kachel → Kanal (Ebene 1: Erzählung). */
const TILE_CHANNEL: Record<string, string> = {
  blocks: 'orange',
  table: 'cyan',
  a2ui: 'magenta',
  agents: 'green',
  more: 'yellow'
};

/** Familie → Kanal (Ebene 2: Struktur). Geteilte Hues, wo Thema = Familie. */
const FAMILY_CHANNEL: Record<string, string> = {
  action: 'orange',
  data: 'cyan',
  ai: 'magenta',
  form: 'blue',
  display: 'azure',
  navigation: 'teal',
  overlay: 'purple',
  feedback: 'red',
  layout: 'ink'
};

/**
 * Die hellste Stufe dieses Hues, die gegen das Papier noch `ACCENT_ON_PAPER`
 * schafft — bei jeweils maximaler Chroma. Frischer geht es bei diesem Ziel
 * nicht, und genau darum geht es: der Cusp ist auf Papier unlesbar (1.2:1 bei
 * Teal), eine feste tiefe Stufe lässt alle zehn Hues gleich aussehen.
 */
function accentStep(hue: number): { L: number; C: number } {
  let lo = 0.1;
  let hi = 0.95;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(oklchToRgb(mid, maxChroma(mid, hue), hue), PAPER_RGB) >= ACCENT_ON_PAPER) lo = mid;
    else hi = mid;
  }
  return { L: round(lo, 3), C: round(maxChroma(lo, hue), 3) };
}

function buildChannel({ name, hue }: RegisterEntry) {
  if (hue == null) {
    // Ink: leicht warmes Unbunt, Paar fest — kein Cusp nötig.
    return {
      name,
      hue,
      solid: 'oklch(0.35 0.006 100)',
      deep: 'oklch(0.2 0.006 100)',
      on: PAPER,
      accent: 'oklch(0.35 0.006 100)',
      accentOn: PAPER,
      accentOnPaper: round(contrast(oklchToRgb(0.35, 0.006, 100), PAPER_RGB), 1),
      pairContrast: 0
    };
  }
  let cusp = { L: 0, C: 0 };
  for (let L = 0.3; L <= 0.95; L += 0.005) {
    const c = maxChroma(L, hue);
    if (c > cusp.C) cusp = { L, C: c };
  }
  const solidL = round(cusp.L, 2);
  const solidC = round(cusp.C * 0.98, 3);
  const deepC = round(Math.min(0.09, maxChroma(0.32, hue)), 3);
  const solidRgb = oklchToRgb(solidL, solidC, hue);
  const deepRgb = oklchToRgb(0.32, deepC, hue);
  const pairContrast = round(contrast(solidRgb, deepRgb), 1);
  const solid = `oklch(${solidL} ${solidC} ${hue})`;
  const deep = `oklch(0.32 ${deepC} ${hue})`;
  const acc = accentStep(hue);
  const accRgb = oklchToRgb(acc.L, acc.C, hue);
  const accInkC = round(Math.min(0.05, maxChroma(ACCENT_INK_L, hue)), 3);
  return {
    name,
    hue,
    solid,
    deep,
    // Gemessen statt gewählt: dunkle Cusps (Blau→Rot) kontrastieren nicht
    // gegen ihre eigene Tiefe — dort ist Paper die on-Farbe.
    on: pairContrast >= ON_PAIR_FLOOR ? deep : PAPER,
    accent: `oklch(${acc.L} ${acc.C} ${hue})`,
    // Auf der Akzent-Fläche trägt dunkle Schrift (≈5.3:1), helle nicht (≈3.4:1).
    accentOn: `oklch(${ACCENT_INK_L} ${accInkC} ${hue})`,
    accentOnPaper: round(contrast(accRgb, PAPER_RGB), 1),
    pairContrast
  };
}

const channels = REGISTER.map(buildChannel);

// Fail-loud: jedes Mapping-Ziel muss im Register existieren, jede on-Farbe
// muss auf ihrem Vollton mindestens Großtext-Kontrast (3:1) erreichen.
const names = new Set(channels.map((c) => c.name));
for (const [key, target] of [...Object.entries(TILE_CHANNEL), ...Object.entries(FAMILY_CHANNEL)]) {
  if (!names.has(target)) throw new Error(`mapping '${key}' → unknown channel '${target}'`);
}
for (const c of channels) {
  if (c.hue == null) continue;
  const solidRgb = oklchToRgb(
    ...(c.solid.match(/[\d.]+/g)!.map(Number) as [number, number, number])
  );
  const onRgb =
    c.on === PAPER
      ? PAPER_RGB
      : oklchToRgb(...(c.on.match(/[\d.]+/g)!.map(Number) as [number, number, number]));
  const ratio = contrast(solidRgb, onRgb);
  if (ratio < 3)
    throw new Error(`channel '${c.name}': on-colour only ${ratio.toFixed(1)}:1 on its solid`);

  // Dieselbe Wache für die Akzent-Stufe, in beiden Rollen: gegen das Papier
  // (Linie, Marke, große Schrift) und gegen ihre eigene on-Farbe (Fläche).
  const accRgb = oklchToRgb(
    ...(c.accent.match(/[\d.]+/g)!.map(Number) as [number, number, number])
  );
  const accOnRgb = oklchToRgb(
    ...(c.accentOn.match(/[\d.]+/g)!.map(Number) as [number, number, number])
  );
  const accPaper = contrast(accRgb, PAPER_RGB);
  const accOn = contrast(accRgb, accOnRgb);
  if (accPaper < ACCENT_ON_PAPER - 0.05)
    throw new Error(`channel '${c.name}': accent only ${accPaper.toFixed(2)}:1 on paper`);
  if (accOn < 4.5)
    throw new Error(`channel '${c.name}': accent-on only ${accOn.toFixed(2)}:1 on the accent`);
}

const out = `/**
 * GENERATED by apps/docs/scripts/channels-gen.ts — do not edit by hand.
 * Regenerate with \`bun apps/docs/scripts/channels-gen.ts\`.
 *
 * Kanal-Register der Landing (Struktur v2): ein Farbrad, eine Formel
 * (Cusp-Vollton + Tiefe L 0.32), on-Farbe per Kontrastmessung. Themen-Kanäle
 * (Kacheln) und Familien-Kanäle (Katalog-Familien) referenzieren dieselben
 * Einträge. Grün/Gelb sind Erzählfarben und keiner Familie zugeordnet.
 *
 * Drei Stufen pro Hue, weil der Kanal drei Rollen hat:
 *   solid  — die Vollton-FLÄCHE (Kacheln). Auf Papier unlesbar, per Konstruktion.
 *   deep   — Text auf dem Vollton, Fläche im Dark Mode.
 *   accent — der Kanal auf hellem Grund: Linie, Marke, Indikator, große Schrift.
 * Die Akzent-Stufe ist die hellste, die gegen Papier noch 3:1 schafft — jede
 * dunklere lässt die zehn Hues ineinanderlaufen, jede hellere ist nicht mehr
 * lesbar.
 */

export interface Channel {
  name: string;
  /** \`null\` = unbunter Ink-Kanal. */
  hue: number | null;
  /** Cusp-Vollton — die Fläche. */
  solid: string;
  /** Tiefe im selben Hue — Text auf hellen Cusps, Fläche im Dark Mode. */
  deep: string;
  /** Gemessene on-Farbe für Text auf dem Vollton (Tiefe oder Paper). */
  on: string;
  /**
   * Der Kanal auf hellem Grund: die hellste Stufe mit ≥ 3:1 gegen Papier.
   * Für Linien, Indikatoren, Marken und große Schrift — NICHT für kleinen
   * Fließtext, der 4.5:1 braucht.
   */
  accent: string;
  /** Dunkle on-Farbe für Text auf der Akzent-FLÄCHE (helle trägt dort nicht). */
  accentOn: string;
  /** Gemessener Kontrast der Akzent-Stufe gegen das Papier. */
  accentOnPaper: number;
  /** WCAG-Kontrast Vollton↔Tiefe (0 beim Ink-Kanal). */
  pairContrast: number;
}

export const CHANNELS = {
${channels
  .map(
    (c) =>
      `  ${c.name}: {\n` +
      `    name: '${c.name}',\n` +
      `    hue: ${c.hue},\n` +
      `    solid: '${c.solid}',\n` +
      `    deep: '${c.deep}',\n` +
      `    on: '${c.on}',\n` +
      `    accent: '${c.accent}',\n` +
      `    accentOn: '${c.accentOn}',\n` +
      `    accentOnPaper: ${c.accentOnPaper},\n` +
      `    pairContrast: ${c.pairContrast}\n` +
      `  }`
  )
  .join(',\n')}
} as const satisfies Record<string, Channel>;

export type ChannelName = keyof typeof CHANNELS;

/** Ebene 1 — Kachel → Kanal (Erzählung). */
export const TILE_CHANNEL = {
${Object.entries(TILE_CHANNEL)
  .map(([k, v]) => `  ${k}: '${v}'`)
  .join(',\n')}
} as const satisfies Record<string, ChannelName>;

/** Ebene 2 — Familie → Kanal (Struktur: Zeile 2, künftig die Docs-Seiten). */
export const FAMILY_CHANNEL = {
${Object.entries(FAMILY_CHANNEL)
  .map(([k, v]) => `  ${k}: '${v}'`)
  .join(',\n')}
} as const satisfies Record<string, ChannelName>;

/** Kanal einer Katalog-Zeile — unbekannte Familien fallen ehrlich auf Ink. */
export function channelForFamily(family: string): Channel {
  return CHANNELS[(FAMILY_CHANNEL as Record<string, ChannelName>)[family] ?? 'ink'];
}
`;

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '../src/lib/landing/channels.ts');
writeFileSync(target, out);
console.log(`channels.ts written (${channels.length} channels):`);
for (const c of channels) {
  console.log(
    `  ${c.name.padEnd(8)} ${c.hue == null ? 'ink ' : `H${String(c.hue).padEnd(3)}`} solid ${c.solid.padEnd(24)} pair ${c.pairContrast}:1  on ${c.on === PAPER ? 'paper' : 'deep'}`
  );
}
