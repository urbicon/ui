/**
 * Kanal-Register-Generator — emittiert drei Dateien:
 *   src/lib/landing/channels.ts          — das Register (Landing + Doku)
 *   src/lib/landing/route-channel.gen.ts — Doku-Route → Kanal
 *   src/lib/style/rooms-channels.gen.css — `[data-room]` → Akzentpaar
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
 * Seit die Doku-Seiten dieselbe Logik erben, ist die Akzent-Stufe zusätzlich
 * das Doku-Raumpaar (`--room-accent`/`--room-accent-fg`) — dort trägt sie in
 * BEIDEN Rollen: als Linie/Schrift auf dem Papier und als Vollton-FLÄCHE der
 * Kopfbänder. Die zweite Wachenschleife misst genau das, gegen beide
 * Doku-Papiere (hell und dunkel).
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

/**
 * Die beiden Gründe der Doku (`--docs-paper` aus rooms-docs.css). Die Landing
 * kennt nur ihr helles Papier; die Doku hat einen ThemeSwitcher, also muss das
 * Raumpaar auf BEIDEN tragen. Deshalb die zweite Referenz — nicht als
 * Farbquelle, nur als Messlatte in den Wachen.
 */
const DOCS_PAPER_LIGHT: RGB = [0xfb / 255, 0xfa / 255, 0xf6 / 255];
const DOCS_PAPER_DARK: RGB = [0x23 / 255, 0x22 / 255, 0x20 / 255];

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
function accentStep(
  hue: number,
  chromaAt: (L: number) => number = (L) => maxChroma(L, hue)
): { L: number; C: number } {
  let lo = 0.1;
  let hi = 0.95;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(oklchToRgb(mid, chromaAt(mid), hue), PAPER_RGB) >= ACCENT_ON_PAPER) lo = mid;
    else hi = mid;
  }
  return { L: round(lo, 3), C: round(chromaAt(lo), 3) };
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

// ── Das Doku-Raumpaar ───────────────────────────────────────────────
/**
 * Was `[data-room="<kanal>"]` in der Doku auf `--room-accent`/`--room-accent-fg`
 * legt. Für die bunten Kanäle ist das buchstäblich die Akzent-Stufe: dieselbe
 * Farbe, die Zeile 2 der Landing für dieselbe Familie zeigt — genau darum geht
 * die Übung. Der unbunte Ink-Kanal kann es nicht sein: seine Akzent-Stufe IST
 * sein Vollton (L 0.35, near-black), und ein Kopfband in near-black verschwindet
 * auf dem Nachtpapier (1.4:1, gemessen). Er bekommt darum seine eigene Stufe
 * nach exakt derselben Regel — hellste Stufe mit ≥3:1 gegen das Papier, nur bei
 * fixer Neutral-Chroma statt am Gamut-Rand — und darauf seine Tiefe als Schrift
 * (5.8:1). Die Schleife darunter misst beides nach, für jeden Kanal.
 */
const INK_ROOM = accentStep(100, () => 0.006);

function roomPair(c: (typeof channels)[number]): { accent: string; fg: string } {
  if (c.hue != null) return { accent: c.accent, fg: c.accentOn };
  return { accent: `oklch(${INK_ROOM.L} ${INK_ROOM.C} 100)`, fg: c.deep };
}

// Die neue Paarung, die dieser Weg einführt: die Akzent-Stufe ist in der Doku
// nicht nur Linie auf hellem Papier, sondern auch die FLÄCHE der Kopfbänder —
// und die Doku hat einen ThemeSwitcher, das Papier also zwei Zustände. Beide
// Rollen auf beiden Papieren, sonst bricht der Lauf.
for (const c of channels) {
  const room = roomPair(c);
  const rgb = oklchToRgb(
    ...(room.accent.match(/[\d.]+/g)!.map(Number) as [number, number, number])
  );
  const fgRgb = oklchToRgb(...(room.fg.match(/[\d.]+/g)!.map(Number) as [number, number, number]));
  const onLight = contrast(rgb, DOCS_PAPER_LIGHT);
  const onDark = contrast(rgb, DOCS_PAPER_DARK);
  const onFill = contrast(rgb, fgRgb);
  if (onLight < ACCENT_ON_PAPER - 0.05)
    throw new Error(
      `room '${c.name}': accent only ${onLight.toFixed(2)}:1 on the light docs paper`
    );
  if (onDark < ACCENT_ON_PAPER - 0.05)
    throw new Error(`room '${c.name}': accent only ${onDark.toFixed(2)}:1 on the dark docs paper`);
  if (onFill < 4.5)
    throw new Error(`room '${c.name}': room-fg only ${onFill.toFixed(2)}:1 on the room accent`);
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
 * data-room → Akzentpaar. Die Werte kommen aus dem Kanal-Register
 * (src/lib/landing/channels.ts), damit eine Doku-Seite und ihre Zeile auf der
 * Landing dieselbe Farbe tragen; \`+layout.svelte\` stempelt nur den NAMEN.
 *
 * Es ist die Akzent-Stufe des Kanals: die hellste, die gegen das Papier noch
 * 3:1 schafft. Sie trägt hier zwei Rollen — Linie/Schrift auf dem Papier UND
 * die Vollton-FLÄCHE der Kopfbänder, mit \`--room-accent-fg\` darauf (≥4.5:1).
 * Beide sind im Generator gemessen, gegen das helle wie das dunkle Doku-Papier.
 */

/* Rückfall, solange kein Raum gestempelt ist (Landing, bare library skin). */
.docs-rooms {
  --room-accent: ${roomPair(channels.find((c) => c.name === DEFAULT_AREA)!).accent};
  --room-accent-fg: ${roomPair(channels.find((c) => c.name === DEFAULT_AREA)!).fg};
}

${channels
  .map((c) => {
    const room = roomPair(c);
    return (
      `:is(.docs-rooms, .docs-room-scope)[data-room='${c.name}'] {\n` +
      `  --room-accent: ${room.accent};\n` +
      `  --room-accent-fg: ${room.fg};\n` +
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
  const rgb = oklchToRgb(
    ...(room.accent.match(/[\d.]+/g)!.map(Number) as [number, number, number])
  );
  console.log(
    `  ${c.name.padEnd(8)} ${c.hue == null ? 'ink ' : `H${String(c.hue).padEnd(3)}`} solid ${c.solid.padEnd(24)} pair ${c.pairContrast}:1  on ${c.on === PAPER ? 'paper' : 'deep'}  room ${room.accent.padEnd(24)} paper ${contrast(rgb, DOCS_PAPER_LIGHT).toFixed(1)}/${contrast(rgb, DOCS_PAPER_DARK).toFixed(1)}`
  );
}
console.log(
  `route-channel.gen.ts written (${Object.keys(routeChannel).length} component routes, ` +
    `${Object.keys(AREA_CHANNEL).length} areas, default '${DEFAULT_AREA}')`
);
console.log('rooms-channels.gen.css written');
