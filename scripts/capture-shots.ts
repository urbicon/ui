/**
 * Nimmt die Bilder auf, die das Projekt außerhalb der Doku-Site zeigt: die vier
 * README-Ansichten und das Social-Bild.
 *
 * Bis 2026-08-04 entstanden sie von Hand. Das Ergebnis war das erwartbare — sie
 * lagen ein halbes Dutzend Landing-Umbauten zurück, das Social-Bild warb noch
 * mit einem Anspruch, den die Seite nicht mehr erhob, und niemand konnte sagen,
 * bei welcher Fenstergröße sie einmal aufgenommen worden waren. Die Maße hier
 * sind die der alten Bilder (1440 × 830 bei doppelter Pixeldichte), damit ein
 * neuer Lauf sie ersetzt statt sie zu verschieben.
 *
 * Das Social-Bild hatte eine Vorlage — `apps/docs/scripts/og.html`, ein Stück
 * Hand-HTML mit einem Playwright-Aufruf im Kommentarkopf. Sie ist mit diesem
 * Skript entfallen, weil sie Anspruch, Fußzeile und alle fünf Kanalfarben als
 * Literale trug: eine zweite Kopie der Namens-Kachel, die niemand anfasst,
 * solange das Bild nicht neu gebaut wird. Genau daran ist sie veraltet. Die
 * Fixture liest stattdessen `$lib/landing/wordmark` und `TILE_CHANNEL`.
 *
 *     bun run shots                     # gegen einen laufenden Dev-Server
 *     SHOTS_BASE=http://localhost:4173 bun run shots
 *
 * Der Server wird bewusst nicht selbst gestartet: zwei Vite-Server im selben
 * Worktree kommen sich in die Quere, und welcher gemeint ist, weiß nur, wer den
 * Lauf anstößt. Läuft keiner, bricht das Skript ab, statt ein leeres Bild zu
 * schreiben.
 *
 * Die og.png hat einen zweiten Standort, den dieses Repo nicht kennt: die
 * Urbicon-Website zeigt sie auf ihrer /ui-Seite und hält dafür eine eigene
 * Kopie (`static/img/urbicon-ui.png`), damit die Seite nicht an einer fremden
 * Domain hängt. Nach einem Neuentwurf gehört sie dorthin kopiert — samt
 * Alt-Text, der den Anspruch wörtlich zitiert.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium, type Page } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SHOTS_BASE ?? 'http://localhost:5174';

/** Die Fensterbreite, in der die README-Bilder gerahmt sind. */
const VIEWPORT = { width: 1440, height: 830 };

const README_DIR = join(ROOT, '.github/assets');
const OG_PATH = join(ROOT, 'apps/docs/static/og.png');

/**
 * Wartet, bis die Seite still steht: Netz ruhig, Schriften geladen, ein Frame
 * für den Rest. Ohne die Schriften trifft der erste Screenshot die
 * Fallback-Schrift und jeder Lauf sähe anders aus als der vorige.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

async function openPage(target: Browser, path: string, scale: number): Promise<Page> {
  const context = await target.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: scale,
    colorScheme: 'light',
    // Die Doku-Chrome ist zweisprachig und folgt der Browser-Sprache; ohne den
    // Pin trägt sie die des aufnehmenden Rechners, und die Bilder in einer
    // englischen README zeigten eine deutsche Seitenleiste. Der Landing-Hero
    // pinnt Englisch selbst, das Doku-Gerüst tut es nicht.
    locale: 'en-US',
    // Der Terminal-Replay der Agents-Kachel springt unter `reduce` sofort auf
    // seinen Endzustand — genau den zeigt das Bild, und er ist der einzige
    // Zustand, den zwei Läufe garantiert teilen.
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) {
    throw new Error(`${path} antwortete mit ${response?.status() ?? 'keiner Antwort'}`);
  }
  await settle(page);
  return page;
}

async function assertServerRunning(): Promise<void> {
  try {
    const response = await fetch(BASE);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (cause) {
    throw new Error(
      `Kein Server auf ${BASE}. Erst \`bun --filter='@urbicon-ui/docs-app' run dev\` starten ` +
        `(oder SHOTS_BASE auf einen laufenden Server setzen).`,
      { cause }
    );
  }
}

await assertServerRunning();
await mkdir(README_DIR, { recursive: true });

const browser = await chromium.launch({
  // Wie in playwright.config.ts: `headless_shell` rendert Text um rund ein Pixel
  // anders als das volle Chromium. Welchen man bekommt, hängt sonst davon ab,
  // wie der Lauf angestoßen wurde.
  channel: 'chromium'
});

const shots: { name: string; run: () => Promise<void> }[] = [
  {
    // Die Landing im Fenster: Namens-Kachel und Kachelband oben, der Anfang des
    // Katalogs darunter — das Bild soll zeigen, dass die Seite weitergeht.
    name: 'landing.png',
    run: async () => {
      const page = await openPage(browser, '/', 2);
      await page.screenshot({ path: join(README_DIR, 'landing.png') });
      await page.context().close();
    }
  },
  {
    name: 'specimen-book.png',
    run: async () => {
      const page = await openPage(browser, '/blocks', 2);
      await page.screenshot({ path: join(README_DIR, 'specimen-book.png') });
      await page.context().close();
    }
  },
  {
    // Die Agents-Kachel steht im waagerechten Kachelband an vierter Stelle. Der
    // Element-Screenshot scrollt selbst hin; die Kachel bringt ihren eigenen
    // Rahmen mit, deshalb keine Bildschirmfläche drumherum.
    name: 'agents-tile.png',
    run: async () => {
      const page = await openPage(browser, '/', 2);

      // Die Steuerleiste des Scrollers liegt als Overlay über den Kacheln
      // (Pfeile am Rand, Dots als Chip unten) und schnitte hier quer durchs
      // Terminal. Sie gehört zum Kachelband, nicht zur Kachel — im Porträt der
      // einen Kachel ist sie fremde Bedienung.
      await page.addStyleTag({
        content: `.attractions > div > div:not([role='group']) { visibility: hidden }`
      });

      const tile = page.locator('article.tile').nth(3);
      await tile.scrollIntoViewIfNeeded();
      // Der Replay läuft erst an, wenn die Kachel im Bild ist
      // (IntersectionObserver), und legt dabei die Vorschau an.
      await page.waitForTimeout(600);

      // Der Quelltext, nicht das Ergebnis: der README-Satz daneben handelt
      // davon, dass die Ansicht die erzeugte Datei zeigt, wortwörtlich.
      await tile.getByRole('button', { name: 'Source' }).click();
      await page.waitForTimeout(400);

      await tile.screenshot({ path: join(README_DIR, 'agents-tile.png') });
      await page.context().close();
    }
  },
  {
    name: 'install-ask-ship.png',
    run: async () => {
      const page = await openPage(browser, '/', 2);
      const row = page.locator('section[aria-label="Getting started"]');
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await row.screenshot({ path: join(README_DIR, 'install-ask-ship.png') });
      await page.context().close();
    }
  },
  {
    // Das Social-Bild bei einfacher Pixeldichte: die Fixture ist bereits in
    // Zielgröße gebaut (1200 × 630), Verdoppeln würde nur die Datei aufblähen.
    name: 'og.png',
    run: async () => {
      const page = await openPage(browser, '/test-fixtures/og', 1);
      await page.locator('[data-og-card]').screenshot({ path: OG_PATH });
      await page.context().close();
    }
  }
];

for (const shot of shots) {
  await shot.run();
  console.log(`✓ ${shot.name}`);
}

await browser.close();
console.log(`\n${shots.length} Bilder aufgenommen (${BASE}).`);
