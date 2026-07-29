<!--
  Landing prototype — "3-Zeilen-Journey", Stufe 1 (Layout + Vollton-Palette).
  Zeile 1: Namens-Kachel + Scroller mit fünf Kanal-Kacheln (Cusp-Palette,
  light-dark()-Paare). Zeile 2/3 sind Peek-Dummies, damit die
  "anderthalb Zeilen sichtbar"-Wirkung auf echten Displays testbar ist.
  Konzept: docs/internal/LANDING-CONCEPT-2026-07.md → "Struktur v2".
  NICHT verlinkt, noindex — reine Testroute.
-->
<!-- urbicon-ignore magic-dimension inline-style — prototype scope: the solid-colour
     channel pairs and hand-tuned row heights ARE the experiment; they move into
     the token system once the direction is confirmed -->
<script lang="ts">
  import { Avatar, Badge, Button, Scroller } from '@urbicon-ui/blocks';

  // Cusp-Palette: Vollton = Sättigungsmaximum des Hues, Tiefe einheitlich
  // L 0.32 im selben Hue. Jeder Kanal ist ein light-dark()-Paar (light:
  // Vollton-Fläche/Tiefe-Text, dark: invertiert). Werte aus der
  // OKLCH-Analyse vom 2026-07-29 (Variante B).
  const TILES = [
    {
      key: 'blocks',
      no: '01',
      title: 'Blocks',
      line: '38 primitives, one grip',
      solid: 'oklch(0.68 0.209 40)',
      deep: 'oklch(0.32 0.09 40)'
    },
    {
      key: 'table',
      no: '02',
      title: 'Table',
      line: 'An enterprise grid, zero deps',
      solid: 'oklch(0.88 0.147 200)',
      deep: 'oklch(0.32 0.054 200)'
    },
    {
      key: 'a2ui',
      no: '03',
      title: 'A2UI',
      line: 'UI inside the chat, themed',
      solid: 'oklch(0.7 0.31 330)',
      deep: 'oklch(0.32 0.09 330)'
    },
    {
      key: 'agent',
      no: '04',
      title: 'Agents',
      line: 'It builds — the gate watches',
      solid: 'oklch(0.87 0.267 145)',
      deep: 'oklch(0.32 0.09 145)'
    },
    {
      key: 'more',
      no: '05',
      title: '…and more',
      line: 'Icons · i18n · charts · chat · auth',
      solid: 'oklch(0.91 0.184 100)',
      deep: 'oklch(0.32 0.067 100)'
    }
  ];

  // Platzhalter — final build-time abgeleitet (siehe +page.server.ts der Landing).
  const PROOF = '97 components · 0 dependencies · 315 icons';
</script>

<svelte:head>
  <title>Landing-Prototyp — 3-Zeilen-Journey</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="proto">
  <!-- ── Zeile 1: erinnern + staunen ─────────────────────────────── -->
  <section class="row1" aria-label="Hero">
    <div class="name-tile">
      <div>
        <p class="brand">
          urbicon{#each TILES as tile (tile.key)}<span class="tick" style:background={tile.solid}
            ></span>{/each}
        </p>
        <p class="claim">Everything in it was made in it.</p>
      </div>
      <p class="proof">{PROOF}</p>
    </div>

    <div class="attractions">
      <Scroller label="Highlights" itemBasis="85%" indicator="dots" gap="md">
        {#each TILES as tile (tile.key)}
          <article class="tile" style:--tile-solid={tile.solid} style:--tile-deep={tile.deep}>
            <span class="no">{tile.no}</span>
            <div class="tile-body">
              {#if tile.key === 'blocks'}
                <!-- Echtheitsregel: lebende Komponenten. Stufe 1 nur hier;
                     die übrigen Kacheln bekommen ihre Inhalte in Stufe 2. -->
                <div class="specimen">
                  <Button intent="primary">Save draft</Button>
                  <Badge intent="success">shipped</Badge>
                  <Avatar name="Urbicon UI" size="sm" />
                </div>
              {/if}
            </div>
            <div>
              <h2 class="tile-title">{tile.title}</h2>
              <p class="tile-line">{tile.line}</p>
            </div>
          </article>
        {/each}
      </Scroller>
    </div>
  </section>

  <!-- ── Zeile 2: erforschen (Dummy für den Peek-Test) ───────────── -->
  <section class="row-dummy row2" aria-label="Components (placeholder)">
    <p class="dummy-label">Zeile 2 — Component-Liste mit Detailansicht</p>
  </section>

  <!-- ── Zeile 3: handeln (Dummy) ────────────────────────────────── -->
  <section class="row-dummy row3" aria-label="Getting started (placeholder)">
    <p class="dummy-label">Zeile 3 — Getting started in 3 Schritten</p>
  </section>
</main>

<style>
  .proto {
    --paper: light-dark(#f4f4f2, #0d0d0d);
    --ink: light-dark(#111111, #f4f4f2);
    background: var(--paper);
    color: var(--ink);
    padding: clamp(10px, 1.2vw, 16px);
    display: grid;
    gap: clamp(10px, 1.2vw, 16px);
  }

  /* ── Zeile 1 ─────────────────────────────────────────────────── */
  .row1 {
    display: grid;
    gap: clamp(10px, 1.2vw, 16px);
  }
  @media (min-width: 48rem) {
    .row1 {
      grid-template-columns: 1fr 1fr;
    }
  }

  .name-tile {
    background: light-dark(#141414, #191919);
    color: #f4f4f2;
    border: 1px solid light-dark(transparent, #2a2a2a);
    padding: clamp(20px, 2.5vw, 36px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 2rem;
  }
  .brand {
    font-size: clamp(2.4rem, 5vw, 4rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  .tick {
    display: inline-block;
    width: 0.42em;
    height: 0.09em;
    margin-left: 0.06em;
    vertical-align: 0.1em;
  }
  .claim {
    margin-top: 0.75rem;
    font-size: clamp(1.1rem, 1.8vw, 1.5rem);
    max-width: 24ch;
    text-wrap: balance;
  }
  .proof {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    opacity: 0.65;
  }

  .attractions {
    min-width: 0;
  }

  /* ── Kanal-Kacheln ───────────────────────────────────────────── */
  .tile {
    background: light-dark(var(--tile-solid), var(--tile-deep));
    color: light-dark(var(--tile-deep), var(--tile-solid));
    height: clamp(380px, 52vh, 580px);
    padding: clamp(16px, 1.8vw, 26px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .no {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    opacity: 0.8;
  }
  .tile-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 0;
  }
  .tile-title {
    font-size: clamp(1.5rem, 2.4vw, 2.2rem);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .tile-line {
    font-size: 0.9rem;
    opacity: 0.85;
  }

  /* Neutrale Karte für lebende Komponenten auf der Vollton-Fläche —
     das Muster der alten Landing (Farbfeld hält eine neutrale Bühne). */
  .specimen {
    background: light-dark(#ffffff, #141414);
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  /* ── Zeilen-Dummies ──────────────────────────────────────────── */
  .row-dummy {
    display: grid;
    place-items: center;
    border: 1px dashed light-dark(#c9c9c4, #333333);
    color: light-dark(#77776f, #8a8a84);
  }
  .row2 {
    min-height: 75vh;
  }
  .row3 {
    min-height: 45vh;
  }
  .dummy-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
  }
</style>
