<!--
  Die Kopfleiste der Landing — das Dach über Zeile 1, und der Kompass darunter.

  Sie ist kein neues Chrom, sondern das Kopf-Chrom der Namens-Kachel auf voller
  Breite: Eyebrow und ThemeSwitcher ziehen aus dem tile-head hierher, dazu die
  vier meistgebrauchten Türen des Footers (dessen Vokabular, dessen Typografie)
  und ein sichtbarer Trigger für die Suche, die auf der Landing bisher nur als
  Tastenkürzel existierte. Gleicher Ink wie Kachel und Footer — links verschmilzt
  die Leiste fugenlos mit der Namens-Kachel (Asphalt-Logik: die Kante ist der
  Farbwechsel, und hier wechselt nichts).

  Die Leiste ist sticky, denn ihr eigentlicher Auftrag liegt UNTER dem ersten
  Screen: die Seite ist drei Bildschirme lang, und ausgerechnet in ihrer Mitte
  (dem Inventar, wo „jetzt will ich die Doku dazu" entsteht) gab es bisher
  keine einzige Tür. Sobald die große Marke aus dem Viewport ist (`watch`,
  IntersectionObserver), blendet links die kleine Signatur ein — Wortmarke plus
  die fünf Kanal-Striche, wie im Footer; vorher stünde sie doppelt direkt über
  sich selbst. Entschieden 2026-08-12 gegen zwei mildere Varianten (statisches
  Dach ohne sticky · Tür-Zeile in der Kachel), die beide die Seitenmitte ohne
  Türen gelassen hätten.
-->
<script lang="ts">
  import { SearchIcon, ThemeSwitcher } from '@urbicon-ui/blocks';
  import { getCommandSearchToggle } from '$lib/command-search.context';
  import { CHANNELS, TILE_CHANNEL } from '$lib/landing/channels';
  import { BRAND, BRAND_SUFFIX, EYEBROW } from '$lib/landing/wordmark';
  import { REPO_URL } from '$lib/seo';

  interface Props {
    /** Das Element, dessen Verschwinden die Marken-Einblendung schaltet. */
    watch?: HTMLElement;
  }

  let { watch }: Props = $props();

  const toggleSearch = getCommandSearchToggle();

  /** Die Signatur in Kachel-Reihenfolge — dieselben fünf Kanäle wie h1 und Footer. */
  const TICKS = Object.values(TILE_CHANNEL).map((name) => CHANNELS[name].solid);

  let brandShown = $state(false);
  $effect(() => {
    if (!watch) return;
    const observer = new IntersectionObserver(([entry]) => {
      brandShown = !entry.isIntersecting;
    });
    observer.observe(watch);
    return () => observer.disconnect();
  });

  const doors = [
    { label: 'Components', href: '/blocks' },
    { label: 'Recipes', href: '/recipes', tier: 'md' },
    { label: 'Getting started', href: '/getting-started', tier: 'md' }
  ];
</script>

<header class="bar">
  <!-- Beide Schichten liegen im selben Grid-Feld und cross-faden; die
       unsichtbare ist für Leser wie Zeiger weg (`inert` wäre für Text
       Overkill — es gibt hier nichts zu fokussieren). -->
  <div class="lead">
    <p class={['eyebrow', brandShown && 'hidden']} aria-hidden={brandShown}>{EYEBROW}</p>
    <p class={['brand-sm', !brandShown && 'hidden']} aria-hidden={!brandShown}>
      {BRAND} <span class="brand-suffix">{BRAND_SUFFIX}</span><span class="ticks" aria-hidden="true"
        >{#each TICKS as color (color)}<span class="tick" style:background={color}
          ></span>{/each}</span
      >
    </p>
  </div>
  <nav class="doors" aria-label="Primary">
    {#each doors as door (door.href)}
      <a href={door.href} class={door.tier === 'md' ? 'door-md' : undefined}>{door.label}</a>
    {/each}
    <a href={REPO_URL} target="_blank" rel="noopener">GitHub <span aria-hidden="true">↗</span></a>
    <button type="button" class="search" onclick={() => toggleSearch()}>
      <SearchIcon class="h-3.5 w-3.5" />
      <span class="sr-only">Search</span>
      <kbd aria-hidden="true">⌘K</kbd>
    </button>
    <!-- Ink in beiden Modi; der `color-scheme: dark`-Scope lässt die Tokens des
         Switchers dunkel auflösen (helles Icon auf dunklem Grund), wie zuvor im
         tile-head der Kachel. Persistenz + <html>-Klasse teilen sich Landing
         und Doku-Chrome (gleicher localStorage-Key). -->
    <div style="color-scheme: dark">
      <ThemeSwitcher size="sm" />
    </div>
  </nav>
</header>

<style>
  .bar {
    background: light-dark(#141414, #191919);
    color: #f4f4f2;
    /* Waagerecht die Polster der Kachel, damit Eyebrow hier exakt dort steht,
       wo es in der Kachel stand — die Leiste IST deren Kopfzeile. */
    padding: 0.55rem clamp(20px, 2.5vw, 36px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem 2rem;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
  }
  /* Schmal wrappt die Leiste auf zwei Zeilen (~90 px) — als Dauergast am
     oberen Rand wäre das ein Viertel eines Telefon-Viewports. Dort scrollt
     sie mit weg: die Türen stehen am Anfang und im Footer. */
  @media (max-width: 40rem) {
    .bar {
      position: static;
    }
  }

  .lead {
    display: grid;
    min-width: 0;
  }
  .lead > * {
    grid-area: 1 / 1;
    transition: opacity 160ms ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lead > .hidden {
    opacity: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .lead > * {
      transition: none;
    }
  }
  .eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    opacity: 0.6;
    align-self: center;
  }
  .brand-sm {
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  .brand-suffix {
    opacity: 0.5;
  }
  .ticks {
    white-space: nowrap;
  }
  .tick {
    display: inline-block;
    width: 0.42em;
    height: 0.09em;
    margin-left: 0.06em;
    vertical-align: baseline;
  }

  /* Die Türen sprechen die Typografie der Footer-Nav — gleiche Wörter,
     gleiche Stimme, nur eine Auswahl statt der vollen Liste. */
  .doors {
    display: flex;
    align-items: center;
    gap: 0.4rem 1.4rem;
    font-size: 0.85rem;
  }
  .doors a {
    color: inherit;
    text-decoration: none;
    opacity: 0.75;
  }
  .doors a:hover,
  .doors a:focus-visible {
    opacity: 1;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .doors a:focus-visible,
  .search:focus-visible {
    outline: 2px solid #f4f4f2;
    outline-offset: 3px;
  }

  .search {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font: inherit;
    color: inherit;
    background: none;
    border: 1px solid rgb(244 244 242 / 0.28);
    border-radius: 999px;
    padding: 0.2rem 0.6rem;
    opacity: 0.75;
    cursor: pointer;
    transition: opacity 120ms ease;
  }
  .search:hover {
    opacity: 1;
  }
  .search kbd {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.68rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  /* Schmal: die mittleren Türen weichen — Components, GitHub, Suche und Theme
     sind die Leiste; der Footer behält die vollständige Liste. */
  @media (max-width: 48rem) {
    .door-md {
      display: none;
    }
  }
  @media (max-width: 30rem) {
    .search kbd {
      display: none;
    }
  }
</style>
