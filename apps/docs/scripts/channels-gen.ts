/**
 * Kanal-Register-Generator — emittiert drei Dateien:
 *   src/lib/landing/channels.ts          — das Register (Landing + Doku)
 *   src/lib/landing/route-channel.gen.ts — Doku-Route → Kanal
 *   src/lib/style/rooms-channels.gen.css — `[data-room]` → Akzentpaar
 *
 * Ein Farbrad, eine Formel, zwei Ebenen: Themen-Kanäle (die fünf
 * Landing-Kacheln) und Familien-Kanäle (die neun Katalog-Familien). Jeder
 * Kanal ist ein Hue mit vier Stufen, eine je Rolle:
 *
 *   solid      — Cusp (Sättigungsmaximum des Hues, ×0.98 Gamut-Puffer): die FLÄCHE.
 *   deep       — L 0.32 bei gedeckeltem Chroma: Text auf dieser Fläche.
 *   accent     — der Kanal auf hellem Grund als FLÄCHE, LINIE, MARKE: die
 *                HELLSTE Stufe mit ≥ ACCENT_ON_PAPER (3:1) gegen das Papier.
 *   accentText — derselbe Kanal als kleiner FLIESSTEXT auf hellem Grund: die
 *                hellste Stufe mit ≥ TEXT_ON_PAPER (4.5:1).
 *
 * Zwei Stufen, weil es zwei Rollen mit zwei WCAG-Schwellen sind, nicht weil
 * zwei Farben hübscher wären. 3:1 ist die Schwelle für Nicht-Text und großen
 * Text — Kopfband, Linie, Indikator, Titel. 4.5:1 ist die Schwelle für kleinen
 * Text — Fließtext-Link, aktiver Navigationseintrag, Krume. Eine einzige Stufe
 * müsste die schärfere Schwelle nehmen und wäre für die Flächenrolle unnötig
 * dunkel; genau das war der Grund, `accent` überhaupt auf 3:1 zu legen.
 *
 * Nichts davon ist gewählt, alles gemessen. Die on-Farbe des Volltons: Tiefe,
 * wenn das Paar ≥ 4:1 schafft (helle Cusps, Gelb→Cyan-Zone), sonst Paper
 * (dunkle Cusps, Blau→Rot-Zone). Die Wachen unten brechen den Lauf, wenn eine
 * Stufe ihre Rolle nicht trägt.
 *
 * Seit die Doku-Seiten dieselbe Logik erben, ist das Raumtripel
 * (`--room-accent`/`--room-accent-fg`/`--room-accent-text`) genau diese
 * Rollenteilung: `accent` bleibt die Vollton-FLÄCHE der Kopfbänder und die
 * Linie, `accentText` trägt die Schrift. Die zweite Wachenschleife misst beide
 * gegen beide Doku-Papiere (hell und dunkel).
 *
 * Warum die Textrolle im Dunkelmodus wieder `accent` ist: eine EINZIGE Farbe
 * kann auf beiden Doku-Papieren nicht AA sein. Gegen das helle Papier verlangt
 * 4.5:1 eine Luminanz ≤ 0.173, gegen das dunkle ≥ 0.247 — ein leerer
 * Schnitt. Die Textrolle ist darum ein `light-dark()`-Paar: `accentText` auf
 * dem hellen Papier (4.7:1), `accent` auf dem dunklen (4.9:1). Die Wache misst
 * die Rolle, nicht die Farbe: jede Stufe gegen das Papier, auf dem sie steht.
 *
 * Aufruf: `bun apps/docs/scripts/channels-gen.ts` (vom Repo-Root).
 * Die emittierten Dateien sind eingecheckt — Regeneration bei Registeränderung
 * hier ODER wenn der Katalog neue Komponenten/Familien bekommt. Konzept:
 * docs/internal/LANDING-CONCEPT-2026-07.md → "Struktur v2".
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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

/**
 * Ein `oklch(L C H)`-String zurück nach sRGB — für die Wachen, die die eben
 * emittierten Strings gegen ihre Papiere messen. Fail-loud statt `!`: ein
 * String, der nicht drei Zahlen hergibt, ist ein Emissionsfehler und soll den
 * Lauf abbrechen, nicht als NaN durch die Kontrastrechnung wandern.
 */
function parseOklch(css: string): RGB {
  const parts = css.match(/[\d.]+/g)?.map(Number);
  if (!parts || parts.length < 3 || parts.some(Number.isNaN))
    throw new Error(`not an oklch() triple: '${css}'`);
  return oklchToRgb(parts[0], parts[1], parts[2]);
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
/**
 * Kontrastziel der Text-Stufe: WCAG AA für kleinen Text. Alles, was der Kanal
 * als Fließtext trägt — Link im Absatz, aktiver Navigationseintrag, Krume,
 * Code-Span — misst gegen diese Schwelle, nicht gegen die 3:1 der Flächen.
 */
const TEXT_ON_PAPER = 4.5;
/** Dunkle Schrift auf der Akzent-Fläche — dieselbe Rolle wie `on` beim Vollton. */
const ACCENT_INK_L = 0.2;

/**
 * Die beiden Gründe der Doku (`--docs-paper` aus rooms-docs.css). Die Doku hat
 * einen ThemeSwitcher, also muss das Raumtripel auf BEIDEN tragen. Deshalb die
 * zweite Referenz — nicht als Farbquelle, nur als Messlatte in den Wachen.
 */
const DOCS_PAPER_LIGHT: RGB = [0xfb / 255, 0xfa / 255, 0xf6 / 255];
const DOCS_PAPER_DARK: RGB = [0x23 / 255, 0x22 / 255, 0x20 / 255];

/**
 * Das helle Papier der Landing (`--paper` in routes/+page.svelte). Es ist der
 * DUNKELSTE helle Grund, auf dem ein Kanal Schrift trägt (Y 0.904 gegen 0.913
 * beim Register-Papier und 0.955 beim Doku-Papier) — für eine dunkle Schrift
 * ist der dunkelste Grund der schwerste Fall. Die Text-Stufe wird deshalb
 * gegen dieses Papier gesucht: dann trägt sie auf allen dreien.
 */
const TEXT_PAPER: RGB = [0xf4 / 255, 0xf4 / 255, 0xf2 / 255];

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
 * Die hellste Stufe dieses Hues, die gegen `paper` noch `target` schafft — bei
 * jeweils maximaler Chroma. Frischer geht es beim jeweiligen Ziel nicht, und
 * genau darum geht es: der Cusp ist auf Papier unlesbar (1.2:1 bei Teal), eine
 * feste tiefe Stufe lässt alle zehn Hues gleich aussehen.
 *
 * Eine Suche, zwei Aufrufe: `accent` (3:1 gegen das Register-Papier) und
 * `accentText` (4.5:1 gegen das dunkelste helle Papier). Dieselbe Methode für
 * beide Rollen, nur die Schwelle unterscheidet sie.
 */
function accentStep(
  hue: number,
  {
    target = ACCENT_ON_PAPER,
    paper = PAPER_RGB,
    chromaAt = (L: number) => maxChroma(L, hue)
  }: { target?: number; paper?: RGB; chromaAt?: (L: number) => number } = {}
): { L: number; C: number } {
  let lo = 0.1;
  let hi = 0.95;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(oklchToRgb(mid, chromaAt(mid), hue), paper) >= target) lo = mid;
    else hi = mid;
  }
  return { L: round(lo, 3), C: round(chromaAt(lo), 3) };
}

function buildChannel({ name, hue }: RegisterEntry) {
  if (hue == null) {
    // Ink: leicht warmes Unbunt, Paar fest — kein Cusp nötig. Seine
    // Akzent-Stufe IST sein Vollton (L 0.35, near-black) und liegt damit weit
    // hinter beiden Schwellen; Fläche und Schrift fallen hier zusammen, weil
    // eine unbunte Stufe nichts an Frische zu verlieren hat. Der Doku-RAUM
    // rechnet trotzdem anders — siehe INK_ROOM / INK_ROOM_TEXT unten.
    return {
      name,
      hue,
      solid: 'oklch(0.35 0.006 100)',
      deep: 'oklch(0.2 0.006 100)',
      on: PAPER,
      accent: 'oklch(0.35 0.006 100)',
      accentOn: PAPER,
      accentOnPaper: round(contrast(oklchToRgb(0.35, 0.006, 100), PAPER_RGB), 1),
      accentText: 'oklch(0.35 0.006 100)',
      accentTextOnPaper: round(contrast(oklchToRgb(0.35, 0.006, 100), TEXT_PAPER), 1),
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
  const accText = accentStep(hue, { target: TEXT_ON_PAPER, paper: TEXT_PAPER });
  const accTextRgb = oklchToRgb(accText.L, accText.C, hue);
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
    // Rund L 0.53–0.59 je nach Hue: eine gute Stufe unter `accent`, aber weit
    // über der Tiefe — die zehn Hues bleiben als Farben unterscheidbar.
    accentText: `oklch(${accText.L} ${accText.C} ${hue})`,
    accentTextOnPaper: round(contrast(accTextRgb, TEXT_PAPER), 1),
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
  const solidRgb = parseOklch(c.solid);
  const onRgb = c.on === PAPER ? PAPER_RGB : parseOklch(c.on);
  const ratio = contrast(solidRgb, onRgb);
  if (ratio < 3)
    throw new Error(`channel '${c.name}': on-colour only ${ratio.toFixed(1)}:1 on its solid`);

  // Dieselbe Wache für die Akzent-Stufe, in beiden Rollen: gegen das Papier
  // (Linie, Marke, große Schrift) und gegen ihre eigene on-Farbe (Fläche).
  const accRgb = parseOklch(c.accent);
  const accOnRgb = parseOklch(c.accentOn);
  const accPaper = contrast(accRgb, PAPER_RGB);
  const accOn = contrast(accRgb, accOnRgb);
  if (accPaper < ACCENT_ON_PAPER - 0.05)
    throw new Error(`channel '${c.name}': accent only ${accPaper.toFixed(2)}:1 on paper`);
  if (accOn < 4.5)
    throw new Error(`channel '${c.name}': accent-on only ${accOn.toFixed(2)}:1 on the accent`);

  // Die Text-Stufe gegen JEDES helle Papier, auf dem sie Schrift trägt: das
  // Register-Papier (Landing) und das dunkelste (`TEXT_PAPER`). Gesucht wird
  // gegen das dunkelste, also ist der erste Test der lockere — er steht hier,
  // damit ein späterer Wechsel der Suchreferenz nicht still durchrutscht.
  const accTextRgb = parseOklch(c.accentText);
  for (const [where, ground] of [
    ['the register paper', PAPER_RGB],
    ['the darkest light paper', TEXT_PAPER]
  ] as const) {
    const textRatio = contrast(accTextRgb, ground);
    if (textRatio < TEXT_ON_PAPER - 0.05)
      throw new Error(
        `channel '${c.name}': accent-text only ${textRatio.toFixed(2)}:1 on ${where} — ` +
          `small body text needs ${TEXT_ON_PAPER}:1`
      );
  }
}

// ── Das Doku-Raumpaar ───────────────────────────────────────────────
/**
 * Was `[data-room="<kanal>"]` in der Doku auf `--room-accent`, `--room-accent-fg`
 * und `--room-accent-text` legt. Für die bunten Kanäle sind das buchstäblich die
 * Register-Stufen: dieselben Farben, die Zeile 2 der Landing für dieselbe Familie
 * zeigt — genau darum geht die Übung. Der unbunte Ink-Kanal kann es nicht sein:
 * seine Akzent-Stufe IST sein Vollton (L 0.35, near-black), und ein Kopfband in
 * near-black verschwindet auf dem Nachtpapier (1.4:1, gemessen). Er bekommt darum
 * seine eigenen Stufen nach exakt denselben Regeln — hellste Stufe mit ≥3:1 bzw.
 * ≥4.5:1 gegen das Papier, nur bei fixer Neutral-Chroma statt am Gamut-Rand — und
 * darauf seine Tiefe als Schrift (5.8:1). Die Schleife darunter misst alles nach,
 * für jeden Kanal.
 */
const INK_ROOM = accentStep(100, { chromaAt: () => 0.006 });
const INK_ROOM_TEXT = accentStep(100, {
  target: TEXT_ON_PAPER,
  paper: TEXT_PAPER,
  chromaAt: () => 0.006
});

function roomPair(c: (typeof channels)[number]): { accent: string; fg: string; text: string } {
  if (c.hue != null) return { accent: c.accent, fg: c.accentOn, text: c.accentText };
  return {
    accent: `oklch(${INK_ROOM.L} ${INK_ROOM.C} 100)`,
    fg: c.deep,
    text: `oklch(${INK_ROOM_TEXT.L} ${INK_ROOM_TEXT.C} 100)`
  };
}

// Drei Rollen, drei Wachen — und die Doku hat einen ThemeSwitcher, das Papier
// also zwei Zustände:
//
//   FLÄCHE/LINIE  `--room-accent` ≥3:1 auf beiden Papieren (Kopfband, Rail,
//                 Fokusring, Chart-Serie). Auf der Fläche selbst muss
//                 `--room-accent-fg` ≥4.5:1 tragen.
//   TEXT hell     `--room-accent-text` ≥4.5:1 auf dem hellen Papier. Dasselbe
//                 Maß deckt die Gegenrolle mit ab: das helle Papier IST die
//                 on-Farbe der Textstufe als Füllung (`text-on-primary` hell).
//   TEXT dunkel   auf dem Nachtpapier ist es wieder `--room-accent` — die
//                 Textstufe wäre dort mit 3.2:1 zu dunkel, der Akzent misst
//                 4.9:1. Deshalb steht die 4.5er-Schwelle hier auf dem Akzent.
for (const c of channels) {
  const room = roomPair(c);
  const rgb = parseOklch(room.accent);
  const fgRgb = parseOklch(room.fg);
  const textRgb = parseOklch(room.text);
  const onLight = contrast(rgb, DOCS_PAPER_LIGHT);
  const onDark = contrast(rgb, DOCS_PAPER_DARK);
  const onFill = contrast(rgb, fgRgb);
  const textLight = contrast(textRgb, DOCS_PAPER_LIGHT);
  if (onLight < ACCENT_ON_PAPER - 0.05)
    throw new Error(
      `room '${c.name}': accent only ${onLight.toFixed(2)}:1 on the light docs paper`
    );
  if (onDark < ACCENT_ON_PAPER - 0.05)
    throw new Error(`room '${c.name}': accent only ${onDark.toFixed(2)}:1 on the dark docs paper`);
  if (onFill < 4.5)
    throw new Error(`room '${c.name}': room-fg only ${onFill.toFixed(2)}:1 on the room accent`);
  if (textLight < TEXT_ON_PAPER - 0.05)
    throw new Error(
      `room '${c.name}': accent-text only ${textLight.toFixed(2)}:1 on the light docs paper — ` +
        'body links and the active nav entry need AA'
    );
  if (onDark < TEXT_ON_PAPER - 0.05)
    throw new Error(
      `room '${c.name}': accent only ${onDark.toFixed(2)}:1 on the dark docs paper — ` +
        'it is the DARK-mode text step (no single colour is AA on both papers)'
    );
}

// ── Doku-Route → Kanal ──────────────────────────────────────────────
interface CatalogEntry {
  name: string;
  slug: string;
  group: string;
  package: string;
  tags?: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../..');

/**
 * Wo die Seiten eines dokumentierten Pakets liegen. Eine Tabelle statt einer
 * Heuristik: ein neues Paket muss seine URL-Form hier nennen, sonst bricht der
 * Lauf — stiller Verlust der Familienfarbe an den Bereichs-Rückfall wäre genau
 * die Art Drift, gegen die dieser Generator existiert.
 */
const ROUTE_SHAPE: Record<string, (e: CatalogEntry) => string> = {
  '@urbicon-ui/blocks': (e) => `/blocks/${e.group}/${e.slug}`,
  '@urbicon-ui/table': (e) => `/table/${e.slug}`,
  '@urbicon-ui/auth': (e) => `/auth/${e.group}/${e.slug}`
};

/**
 * Bereich → Kanal für alles, was keine Komponentenseite ist (Übersichten,
 * /recipes, /icons, /getting-started …). Die drei Produktbereiche erben ihren
 * Kachel-Kanal aus Zeile 1 der Landing; `/auth` hat keine Kachel und bekommt
 * den `form`-Kanal, weil 8 seiner 14 Komponenten die Form-Familie tragen (der
 * Rest verteilt sich auf feedback/display/data) — die Bereichsfarbe ist damit
 * die Farbe, die man auf seinen Seiten am häufigsten sieht, statt einer elften
 * gewählten. Alles Übrige nimmt den blocks-Kanal, wie vorher.
 */
const AREA_CHANNEL: Record<string, string> = {
  blocks: TILE_CHANNEL.blocks,
  table: TILE_CHANNEL.table,
  ai: TILE_CHANNEL.a2ui,
  auth: FAMILY_CHANNEL.form
};
const DEFAULT_AREA = TILE_CHANNEL.blocks;

for (const [key, target] of [...Object.entries(AREA_CHANNEL), ['<default>', DEFAULT_AREA]]) {
  if (!names.has(target)) throw new Error(`area '${key}' → unknown channel '${target}'`);
}

// The loop above already proved this channel exists, but the type does not carry
// that — and the CSS below wanted it three times, which was three `!` assertions
// on the same lookup and three places for a future rename to slip an `undefined`
// through. Resolved once, loudly, and reused.
const defaultChannel = channels.find((c) => c.name === DEFAULT_AREA);
if (!defaultChannel) throw new Error(`default area '${DEFAULT_AREA}' → unknown channel`);
const defaultRoom = roomPair(defaultChannel);

function loadCatalog(pkg: 'blocks' | 'table' | 'auth'): CatalogEntry[] {
  const file = join(here, `../static/${pkg}/_catalog.json`);
  if (!existsSync(file))
    throw new Error(
      `catalogue ${relative(repoRoot, file)} is missing. The _catalog.json files are ` +
        'git-ignored docs-gen artefacts — run `bun run docs:gen:all` first.'
    );
  return JSON.parse(readFileSync(file, 'utf8')) as CatalogEntry[];
}

const routeChannel: Record<string, string> = {};
for (const pkg of ['blocks', 'table', 'auth'] as const) {
  for (const entry of loadCatalog(pkg)) {
    const shape = ROUTE_SHAPE[entry.package];
    if (!shape)
      throw new Error(
        `catalogue '${pkg}' entry '${entry.name}': package '${entry.package}' has no route shape`
      );
    const family = entry.tags?.[0];
    if (!family)
      throw new Error(`catalogue '${pkg}' entry '${entry.name}': no family (tags[0] is empty)`);
    const target = FAMILY_CHANNEL[family];
    if (!target)
      throw new Error(
        `catalogue '${pkg}' entry '${entry.name}': family '${family}' has no channel — ` +
          'add it to FAMILY_CHANNEL in this file.'
      );
    routeChannel[shape(entry)] = target;
  }
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
 * Vier Stufen pro Hue, weil der Kanal vier Rollen hat:
 *   solid      — die Vollton-FLÄCHE (Kacheln). Auf Papier unlesbar, per Konstruktion.
 *   deep       — Text auf dem Vollton, Fläche im Dark Mode.
 *   accent     — der Kanal auf hellem Grund als Fläche, Linie, Marke, Indikator,
 *                große Schrift: die hellste Stufe mit ≥3:1 gegen Papier.
 *   accentText — derselbe Kanal als kleiner Fließtext: die hellste Stufe mit
 *                ≥4.5:1 gegen das dunkelste helle Papier.
 * Zwei Stufen für zwei WCAG-Schwellen. Jede dunklere Stufe lässt die zehn Hues
 * ineinanderlaufen, jede hellere ist in ihrer Rolle nicht mehr lesbar.
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
   * Für Flächen, Linien, Indikatoren, Marken und große Schrift — NICHT für
   * kleinen Fließtext, der 4.5:1 braucht: dafür ist \`accentText\` da.
   *
   * Auf DUNKLEM Grund ist diese Stufe auch die Textfarbe (4.9:1 gegen das
   * Doku-Nachtpapier) — dort wäre \`accentText\` mit 3.2:1 zu dunkel.
   */
  accent: string;
  /** Dunkle on-Farbe für Text auf der Akzent-FLÄCHE (helle trägt dort nicht). */
  accentOn: string;
  /** Gemessener Kontrast der Akzent-Stufe gegen das Papier. */
  accentOnPaper: number;
  /**
   * Der Kanal als kleiner Fließtext auf HELLEM Grund: die hellste Stufe mit
   * ≥ 4.5:1. Rund L 0.53–0.59 — satter als \`accent\`, aber weit über der
   * Tiefe, die zehn Hues bleiben unterscheidbar. Als FÜLLUNG trägt sie das
   * helle Papier als on-Farbe (dieselbe Messung, andere Richtung).
   */
  accentText: string;
  /** Gemessener Kontrast der Text-Stufe gegen das dunkelste helle Papier. */
  accentTextOnPaper: number;
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
      `    accentText: '${c.accentText}',\n` +
      `    accentTextOnPaper: ${c.accentTextOnPaper},\n` +
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

/** Ebene 2 — Familie → Kanal (Struktur: Zeile 2 der Landing UND die Doku-Räume). */
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

const routeOut = `/**
 * GENERATED by apps/docs/scripts/channels-gen.ts — do not edit by hand.
 * Regenerate with \`bun apps/docs/scripts/channels-gen.ts\`.
 *
 * Doku-Route → Kanal. Eine Komponentenseite trägt die Farbe ihrer FAMILIE
 * (\`tags[0]\` im docs-gen-Katalog), nicht die ihres Produktbereichs — dieselbe
 * Zuordnung, die Zeile 2 der Landing zeigt. Alles andere (Übersichten,
 * /recipes, /icons, /getting-started …) fällt auf den Kanal seines Bereichs
 * zurück; \`/blocks\`, \`/table\` und \`/ai\` erben dabei den Kachel-Kanal aus
 * Zeile 1.
 *
 * Die Tabelle ist aus den Katalogen erzeugt und eingecheckt: die
 * \`_catalog.json\` sind git-ignorierte docs-gen-Artefakte, ein frischer
 * Worktree hätte sie nicht. Neue Komponente ⇒ \`bun run docs:gen:all\`, dann
 * diesen Generator.
 */

import { CHANNELS, type Channel, type ChannelName } from './channels';

/** Pfad → Kanal, für jede Komponentenseite im Katalog. */
export const ROUTE_CHANNEL = {
${Object.entries(routeChannel)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `  '${k}': '${v}'`)
  .join(',\n')}
} as const satisfies Record<string, ChannelName>;

/** Bereich (oberstes Routensegment) → Kanal, für alles andere. */
export const AREA_CHANNEL = {
${Object.entries(AREA_CHANNEL)
  .map(([k, v]) => `  ${k}: '${v}'`)
  .join(',\n')}
} as const satisfies Record<string, ChannelName>;

/** Kanal für jede Seite ohne eigenen Bereich (Impressum, Changelog, /icons …). */
export const DEFAULT_CHANNEL: ChannelName = '${DEFAULT_AREA}';

/**
 * Der Kanalname einer Doku-Route — das, was \`+layout.svelte\` als
 * \`data-room\` stempelt. Erst die Komponentenseite (Familie), dann der
 * Bereich, dann der Default.
 */
export function channelNameForRoute(pathname: string): ChannelName {
  const path = pathname.replace(/\\/+$/, '') || '/';
  const exact = (ROUTE_CHANNEL as Record<string, ChannelName>)[path];
  if (exact) return exact;
  const area = path.split('/')[1] ?? '';
  return (AREA_CHANNEL as Record<string, ChannelName>)[area] ?? DEFAULT_CHANNEL;
}

/** Derselbe Aufschlag als voller Registereintrag (Stufen, Hue, Messwerte). */
export function channelForRoute(pathname: string): Channel {
  return CHANNELS[channelNameForRoute(pathname)];
}
`;

const cssOut = `/*
 * GENERATED by apps/docs/scripts/channels-gen.ts — do not edit by hand.
 * Regenerate with \`bun apps/docs/scripts/channels-gen.ts\`.
 *
 * data-room → Akzent-Tripel. Die Werte kommen aus dem Kanal-Register
 * (src/lib/landing/channels.ts), damit eine Doku-Seite und ihre Zeile auf der
 * Landing dieselbe Farbe tragen; \`+layout.svelte\` stempelt nur den NAMEN.
 *
 * Drei Rollen, drei Variablen — weil sie drei verschiedene WCAG-Schwellen
 * haben und eine einzige Farbe nicht alle drei trägt:
 *
 *   --room-accent       die Akzent-Stufe (≥3:1 gegen beide Doku-Papiere): die
 *                       Vollton-FLÄCHE der Kopfbänder, die Linie, der Fokusring,
 *                       die Chart-Serie. Auf dunklem Papier zusätzlich die
 *                       Textfarbe (4.9:1 — dort ist sie hell genug).
 *   --room-accent-fg    die dunkle on-Farbe auf dieser Fläche (≥4.5:1).
 *   --room-accent-text  die Text-Stufe (≥4.5:1 gegen helles Papier): kleiner
 *                       Fließtext im Hellmodus — Link im Absatz, aktiver
 *                       Navigationseintrag, Krume.
 *
 * Alle drei sind im Generator gemessen, nicht gewählt.
 */

/* Rückfall, solange kein Raum gestempelt ist (Landing, bare library skin). */
.docs-rooms {
  --room-accent: ${defaultRoom.accent};
  --room-accent-fg: ${defaultRoom.fg};
  --room-accent-text: ${defaultRoom.text};
}

${channels
  .map((c) => {
    const room = roomPair(c);
    return (
      `:is(.docs-rooms, .docs-room-scope)[data-room='${c.name}'] {\n` +
      `  --room-accent: ${room.accent};\n` +
      `  --room-accent-fg: ${room.fg};\n` +
      `  --room-accent-text: ${room.text};\n` +
      `}`
    );
  })
  .join('\n')}
`;

writeFileSync(join(here, '../src/lib/landing/channels.ts'), out);
writeFileSync(join(here, '../src/lib/landing/route-channel.gen.ts'), routeOut);
writeFileSync(join(here, '../src/lib/style/rooms-channels.gen.css'), cssOut);
console.log(`channels.ts written (${channels.length} channels):`);
for (const c of channels) {
  const room = roomPair(c);
  const rgb = parseOklch(room.accent);
  const textRgb = parseOklch(room.text);
  console.log(
    `  ${c.name.padEnd(8)} ${c.hue == null ? 'ink ' : `H${String(c.hue).padEnd(3)}`} solid ${c.solid.padEnd(24)} pair ${c.pairContrast}:1  on ${c.on === PAPER ? 'paper' : 'deep'}  room ${room.accent.padEnd(24)} paper ${contrast(rgb, DOCS_PAPER_LIGHT).toFixed(1)}/${contrast(rgb, DOCS_PAPER_DARK).toFixed(1)}  text ${room.text.padEnd(24)} ${contrast(textRgb, DOCS_PAPER_LIGHT).toFixed(1)}/${contrast(rgb, DOCS_PAPER_DARK).toFixed(1)}`
  );
}
console.log(
  `route-channel.gen.ts written (${Object.keys(routeChannel).length} component routes, ` +
    `${Object.keys(AREA_CHANNEL).length} areas, default '${DEFAULT_AREA}')`
);
console.log('rooms-channels.gen.css written');
