<!--
  Vorschau des Landing-Heros: Fallblatt-Board + Specimen-Panel.

  Liegt unter test-fixtures, weil das kein Produktivinhalt ist — die Route ist
  aus Sitemap und Suchindex ausgeschlossen (sitemap.xml/+server.ts).

  Konzept und Gestaltungsbegründungen:
  docs/internal/LANDING-CONCEPT-2026-07.md, prototypes/landing-board/DESIGN.md
-->
<script lang="ts">
  import '@fontsource-variable/archivo';
  import '@fontsource-variable/martian-mono';
  import '$lib/style/rooms.css';
  import '$lib/landing/board.css';
  import FlapBoard, { type BoardRow } from '$lib/landing/FlapBoard.svelte';
  import { DonutChart, Sankey } from '@urbicon-ui/blocks';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  /** Drei Kanäle, je eine Signage-Tradition. Kein Rot: Die Farbe steht auf
      einer Null, und eine rote Null liest sich als Fehler. */
  const LIVERIES = [
    { key: 'halle', label: 'Halle', value: '#e8a33d' },
    { key: 'radar', label: 'Radar', value: '#3fa9a0' },
    { key: 'linie', label: 'Linie', value: '#9d7ae0' }
  ] as const;

  let livery = $state<(typeof LIVERIES)[number]['key']>('halle');
  let selected = $state<BoardRow | null>(null);

  const liveryValue = $derived(LIVERIES.find((l) => l.key === livery)?.value ?? '#e8a33d');

  function formatGz(row: BoardRow): string {
    return row.gz == null ? 'kein Baseline-Wert' : `${(row.gz / 1024).toFixed(1)} kB`;
  }

  // Echte Komponenten, kuratiert: Alle 98 dynamisch zu laden würde die ganze
  // Library ins Bundle ziehen. Gezeigt werden die Schwergewichte — die
  // "ihr shipped WAS umsonst?"-Momente. Für alles andere trägt das Panel die
  // Katalogdaten, ohne eine Vorschau vorzutäuschen.
  const SANKEY_NODES = [
    { id: 'src', label: 'Source' },
    { id: 'parse', label: 'Parse' },
    { id: 'lint', label: 'Lint' },
    { id: 'ship', label: 'Ship' },
    { id: 'fix', label: 'Fix' }
  ];
  const SANKEY_LINKS = [
    { source: 'src', target: 'parse', value: 32 },
    { source: 'parse', target: 'lint', value: 26 },
    { source: 'parse', target: 'fix', value: 6 },
    { source: 'lint', target: 'ship', value: 21 },
    { source: 'lint', target: 'fix', value: 5 }
  ];
  const DONUT_DATA = [
    { label: 'Primitives', value: 38 },
    { label: 'Components', value: 44 },
    { label: 'Auth', value: 14 },
    { label: 'Table', value: 1 }
  ];
</script>

<svelte:head><title>Landing-Board — Vorschau</title></svelte:head>

<div class="board-stage" data-livery={livery}>
  <header>
    <p class="eyebrow">Urbicon UI — the set</p>
    <nav aria-label="Livery">
      {#each LIVERIES as l (l.key)}
        <button
          type="button"
          class={['livery', l.key === livery && 'on']}
          aria-pressed={l.key === livery}
          onclick={() => (livery = l.key)}
        >
          <span class="dot" style:background={l.value}></span>{l.label}
        </button>
      {/each}
    </nav>
  </header>

  <div class="stage">
    <FlapBoard rows={data.rows} onselect={(row) => (selected = row)} />

    <aside
      class="specimen poster-card room-accent"
      style:--room-accent={liveryValue}
      style:--room-accent-fg="#17150f"
      aria-live="polite"
    >
      {#if selected}
        <h2>{selected.name}</h2>
        <p class="spec-meta">{selected.family} · {formatGz(selected)} · {selected.status}</p>

        <div class="spec-stage">
          <!-- `intent="primary"` ist nötig, nicht kosmetisch: Sankey steht per
               Default auf `neutral` (sankey.variants.ts) und bliebe sonst grau.
               Der Livery-Durchgriff greift nur bei Komponenten, die die
               Primary-Familie überhaupt anfassen. -->
          {#if selected.name === 'Sankey'}
            <Sankey nodes={SANKEY_NODES} links={SANKEY_LINKS} intent="primary" height={200} />
          {:else if selected.name === 'DonutChart'}
            <DonutChart data={DONUT_DATA} />
          {:else}
            <p class="spec-none">Für diese Komponente ist hier noch keine Vorschau hinterlegt.</p>
          {/if}
        </div>

        <code>
          {selected.status === 'in progress'
            ? '// noch nicht ausgeliefert'
            : `import { ${selected.name} } from '@urbicon-ui/blocks';`}
        </code>
      {/if}
    </aside>
  </div>

  <div class="claim-block">
    <p class="claim">Everything in it was made <em>in it</em>.</p>
    <p class="claim-sub">
      That is why the deps column reads zero, {data.rows.length} times over.
    </p>
  </div>
</div>

<style>
  .board-stage {
    min-height: 100vh;
    padding: 20px 0 0;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 20px;
    padding: 0 20px 16px;
  }
  .eyebrow {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--dim);
  }
  nav {
    display: flex;
    gap: 6px;
  }
  .livery {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font: inherit;
    font-size: 11.5px;
    background: var(--flap);
    color: var(--bone);
    border: 1px solid #33343a;
    padding: 4px 10px;
    cursor: pointer;
  }
  .livery.on {
    background: var(--bone);
    color: var(--deck);
    border-color: var(--bone);
  }
  .livery:focus-visible {
    outline: 2px solid var(--livery);
    outline-offset: 2px;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  .stage {
    display: flex;
    align-items: stretch;
    gap: 28px;
    padding: 0 20px;
  }

  /* Der helle Gegenpol. `poster-card` pinnt die Surface-/Text-Tokens auf warme
     Werte, `room-accent` leitet die gesamte Primary-Familie aus der Livery ab
     — beide aus rooms.css, wo das Verfahren schon erprobt ist. */
  .specimen {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 20px 22px 18px;
    border-radius: 3px;
  }
  .specimen h2 {
    margin: 0;
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -0.025em;
  }
  .spec-meta {
    margin: 3px 0 0;
    font-size: 11px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    opacity: 0.62;
  }
  .spec-stage {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    margin: 16px 0;
    padding: 18px;
    background: #fbfaf7;
    border: 1px solid #e2ded4;
    border-radius: 2px;
    overflow: hidden;
  }
  .spec-none {
    margin: 0;
    font-size: 13px;
    opacity: 0.55;
    text-align: center;
    max-width: 30ch;
  }
  .specimen code {
    font-size: 11.5px;
    background: #eae7df;
    padding: 8px 10px;
    border-radius: 2px;
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }

  .claim-block {
    padding: 46px 20px 56px;
    margin-top: 30px;
    border-top: 1px solid #1e2220;
  }
  .claim {
    margin: 0;
    font-size: clamp(1.75rem, 3.6vw, 3.1rem);
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.04;
    max-width: 20ch;
  }
  .claim em {
    font-style: normal;
    color: var(--livery);
    transition: color 0.45s ease;
  }
  .claim-sub {
    margin: 14px 0 0;
    font-size: 14.5px;
    color: var(--dim);
    max-width: 46ch;
  }

  @media (max-width: 900px) {
    .stage {
      flex-direction: column;
    }
  }
</style>
