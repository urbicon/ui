<!--
  Hero-Prototyp: Inventar links, lebende Vorschau rechts.

  Gegenentwurf zum verworfenen Fallblatt-Board. Die These handelt von
  Abwesenheit — nichts Fremdes drin, kein Ballast —, also darf die Form nicht
  Masse ausdrücken: keine Rahmen, keine Karten, keine Schatten, keine
  Signage-Nostalgie. Eine Haarlinie trennt die beiden Hälften, sonst trägt
  Weißraum.

  Was aus dem gescheiterten Entwurf überlebt und hier weiterlebt:
  · Selbstreferenz — der Inhalt ist das Set selbst.
  · Der Beweis vor der Behauptung — die Liste steht oben, der Satz dazu unten
    als Bildunterschrift. (Bis 2026-07-27 war der Beweis eine `Deps`-Spalte mit
    98 Nullen; hundertmal dieselbe Zahl überzeugt nach dem zweiten Mal nicht
    mehr, sie füllt nur Breite. Jetzt trägt der Fußsatz die Aussage und die
    Spalte zeigt die API-Größe, die tatsächlich variiert.)
  · Master/Detail — Zeile anklicken heißt: die echte Komponente steht daneben.

  Links läuft die echte `Table` (Sortieren, Suchen, Keyboard-Nav,
  Virtualisierung) — kein Nachbau. Konzept:
  docs/internal/LANDING-CONCEPT-2026-07.md
-->
<script lang="ts">
  import HeroSpecimen from '$lib/landing/HeroSpecimen.svelte';
  import { formatKb, type HeroRow, SHARED_PREVIEW_NOTES } from '$lib/landing/hero';
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Input } from '@urbicon-ui/blocks';
  import { I18nProvider } from '@urbicon-ui/i18n';
  import { useUrlParam } from '@urbicon-ui/sveltekit-utils/url.svelte';
  import { Table } from '@urbicon-ui/table';
  import type { Component } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Die Vorschau ist der gepflegte Playground der Doku-Seite, nicht ein
  // zweites Beispiel: `Playground.svelte` liegt neben der `api.ts` jeder
  // Komponente und hat zwei Konsumenten (Doku-Seite + Hero). Lazy, damit der
  // Hero nicht die halbe Library ins erste Bundle zieht — geladen wird nur,
  // was angeklickt wurde.
  // Nicht jede Komponente verträgt Regler: Die Auth-Familie hat keine Varianten,
  // sondern API-Pfade und Callbacks — dort ist das gepflegte statische Beispiel
  // (`examples/Basic.svelte`, ggf. mit einem vorschau-sicheren `BasicDemo`
  // davor) die geteilte Wahrheit. Der Hero nimmt beides, in dieser Reihenfolge.
  const MODULES = import.meta.glob([
    '/src/routes/blocks/**/Playground.svelte',
    '/src/routes/table/**/Playground.svelte',
    '/src/routes/auth/**/Playground.svelte',
    '/src/routes/auth/**/examples/BasicDemo.svelte',
    '/src/routes/auth/**/examples/Basic.svelte'
  ]) as Record<string, () => Promise<{ default: Component }>>;

  /**
   * Schlüssel ist `paket:slug` — beides steht in der Zeile und beides steckt im
   * Glob-Pfad. Über `group` liefe es nicht: `Table` steht im Katalog unter
   * `primitives`, seine Doku-Seite aber unter `/table/table`. So bleibt der
   * Zusammenhang ohne handgepflegte Pfadtabelle bestehen.
   */
  function keyOf(path: string): string {
    const segments = path.split('/');
    const slug = segments[segments.indexOf('examples') - 1] ?? segments[segments.length - 2];
    return `${segments[3]}:${slug}`;
  }

  interface Specimen {
    load: () => Promise<{ default: Component }>;
    /** Nur ein Playground nimmt Host-Props (Größe, Slot-Klassen) entgegen. */
    interactive: boolean;
    /** Route der Doku-Seite — steckt schon im Pfad des Beispiels. */
    docsHref: string;
    rank: number;
  }

  /**
   * Die Doku-Route ist der Ordner, in dem das Beispiel liegt. Kein Mapping,
   * keine zweite Liste: Wer die Datei verschiebt, verschiebt den Link mit.
   *
   * Die acht Guide-Oberflächen haben keine eigene Seite (ihr `Playground.svelte`
   * zeigt auf die Familie), also zeigt auch ihr Link dorthin.
   */
  function docsHrefOf(path: string): string {
    const route = path.replace('/src/routes', '').replace(/\/(examples\/)?[^/]+\.svelte$/, '');
    return route.startsWith('/blocks/components/guide-') ? '/blocks/components/guide' : route;
  }

  /**
   * Rang statt Reihenfolge: `import.meta.glob` liefert seine Schlüssel
   * alphabetisch sortiert, nicht in der Reihenfolge der Muster — nach Pfad
   * käme `Basic.svelte` vor `BasicDemo.svelte`, also die Fassung ohne die
   * vorschau-sicheren Links.
   */
  function rankOf(path: string): number {
    if (path.endsWith('/Playground.svelte')) return 0;
    if (path.endsWith('/BasicDemo.svelte')) return 1;
    return 2;
  }

  // `Partial<Record<…>>`, damit der Index-Zugriff ehrlich `| undefined` liefert.
  const SPECIMENS: Partial<Record<string, Specimen>> = {};
  for (const [path, load] of Object.entries(MODULES)) {
    const key = keyOf(path);
    const rank = rankOf(path);
    const current = SPECIMENS[key];
    if (!current || rank < current.rank) {
      SPECIMENS[key] = { load, interactive: rank === 0, docsHref: docsHrefOf(path), rank };
    }
  }

  let query = $state('');

  /**
   * Die Auswahl steht in der URL, nicht im Komponenten-State. Ohne das war die
   * Vorschau weder teilbar noch überlebte sie den Zurück-Knopf: Wer eine
   * Komponente anklickte, in ihre Doku sprang und zurückging, landete wieder
   * beim Vorausgewählten.
   *
   * `replaceState: false` ist genau dieser Punkt — jede Zeilenauswahl ist ein
   * eigener History-Eintrag, damit „zurück" zur vorher angesehenen Komponente
   * führt statt aus dem Hero heraus.
   *
   * Schlüssel ist der Slug, nicht die Zeilen-ID (`paket:Name`): `?c=sankey`
   * liest sich, und über die drei Kataloge sind Slugs kollisionsfrei (geprüft).
   */
  const [selectedSlug, setSelectedSlug] = useUrlParam<string | null>('c', {
    parse: (sp) => sp.get('c'),
    serialize: (value) => new URLSearchParams(value ? { c: value } : {}),
    initial: null,
    replaceState: false
  });

  // Vorausgewählt ist ein Schwergewicht: Der erste Eindruck soll das
  // "ihr shipped WAS umsonst?" sein, nicht ein Button. Die Zeile wird aus dem
  // Slug abgeleitet, statt als Kopie im State zu hängen — ein unbekannter Slug
  // fällt still auf denselben Startpunkt zurück, weil eine kaputte URL kein
  // Grund ist, dem Besucher eine leere Seite zu zeigen.
  const selected = $derived<HeroRow>(
    data.rows.find((r) => r.slug === selectedSlug()) ??
      data.rows.find((r) => r.name === 'Sankey') ??
      data.rows[0]
  );

  const specimen = $derived(SPECIMENS[`${selected.pkg}:${selected.slug}`]);

  const sharedNote = $derived(SHARED_PREVIEW_NOTES[selected.slug]);

  // Zwei Eingriffe, mehr nicht.
  //
  // 1. **Kanten bleiben.** Der erste Versuch hat sie abgeräumt (`!border-0
  //    !bg-transparent` überall) — das Ergebnis waren drei Blöcke ohne Grenze,
  //    in denen "? HINTS" im Nichts hing. Der Configurator trennt Bühne, Regler
  //    und Code bereits: Haarlinien plus ein eigener Grund unter dem
  //    Reglerfeld. Genau das trägt hier auch; abgeräumt wird nur die äußere
  //    Rahmung, die im Hero doppelt wäre.
  // 2. **Linke Kante.** Auf der Doku-Seite zentriert der Configurator Bühne und
  //    Regler in einer 36rem-Spalte, was dort richtig ist. Im Hero läuft daneben
  //    eine linksbündige Tabelle — zentriert entstünden drei verschiedene linke
  //    Kanten und links davon ein Loch. Die Regler bleiben untereinander; nur
  //    ihre Spalte rückt an die Kante.
  const PLAYGROUND_SLOTS = {
    root: '!border-0 !bg-transparent !p-0 !shadow-none !gap-0',
    // Die Bühne bekommt ihren eigenen Grund: Ein Specimen, das auf demselben
    // Weiß steht wie der Text darüber, liest sich als Fortsetzung des Textes,
    // nicht als das Ding, um das es geht.
    preview: '!bg-surface-elevated !rounded-t-xl !px-5 !py-6',
    previewContent: '!justify-start',
    controlsPanel: '!bg-transparent !px-5 !pb-5 !pt-0',
    controlsHeader: '!mx-0 !px-0',
    controlsGrid: '!mx-0 !px-0',
    codePanel: '!bg-transparent !px-0',
    codeToolbar: '!px-0'
  };
</script>

<svelte:head><title>Hero-Prototyp — Inventar + Vorschau</title></svelte:head>

<!--
  Der Hero ist englisch, auch wenn die Doku-Chrome auf Deutsch steht: Ein
  eigener Provider hält diesen Teilbaum auf `en`, sonst rutschen die Labels der
  Vorschau ("HINWEISE", "KOPIEREN") und die Monatsnamen von Calendar/Planner in
  die Nutzersprache — mitten in eine englische Seite. Der Provider ist
  request-scoped, die Sprachwahl der übrigen Doku bleibt unberührt.
-->
<I18nProvider locale="en">
  <div class="hero" lang="en">
    <header>
      <p class="wordmark">Urbicon <span>UI</span></p>
      <div class="search">
        <Input
          bind:value={query}
          variant="underline"
          size="sm"
          placeholder="Filter {data.rows.length} components"
          aria-label="Filter components"
        />
      </div>
    </header>

    <main>
      <!-- Kein Blättern durch das eigene Inventar: Die Spalte aus Nullen wirkt,
           weil sie nicht aufhört. Alle Zeilen auf einmal, der leere
           `pagination`-Snippet nimmt dem Fuß das Chrom. -->
      <section class="inventory" aria-label="Component inventory">
        <Table
          items={data.rows}
          searchTerm={query}
          enableSmartFilter={false}
          variant="flush"
          size="sm"
          ariaLabel="Every component in the set"
          itemsPerPage={data.rows.length}
          onRowClick={(row) => setSelectedSlug((row as HeroRow).slug)}
          activeRowId={selected.id}
          initialSort={{ column: 'name', direction: 'asc' }}
          slotClasses={{
            headerCell: '!py-2 !text-[0.6875rem] !font-medium !uppercase !tracking-[0.14em]',
            // Keine Zeilentrenner: 98 Haarlinien ergeben ein Gitter, und ein
            // Gitter ist genau die Schwere, die dieser Entwurf vermeidet. Die
            // Spaltenausrichtung trägt die Lesbarkeit, der Hover die Führung.
            row: '!border-b-0',
            cell: '!py-[0.3rem] !align-middle',
            table: '!min-w-0'
          }}
          columns={[
            {
              accessor: 'name',
              title: 'Component',
              sortable: true,
              searchable: true,
              // Feste Breite am längsten Namen (`PushPermissionPrompt`, 20
              // Zeichen) statt `flex`: Als flexible Spalte nahm sie jeden
              // Überhang der Inventar-Hälfte auf und riss auf breiten Schirmen
              // ein Loch zwischen Name und Familie.
              width: '15rem',
              cell: nameCell
            },
            {
              accessor: 'family',
              title: 'Family',
              sortable: true,
              searchable: true,
              width: '6rem',
              cell: quietCell
            },
            {
              id: 'kb',
              // `-1` statt `0` für Zeilen ohne Baseline: Sonst beginnt die
              // aufsteigende Sortierung mit den Gedankenstrichen, und der
              // interessante Klick (größte zuerst) hätte sie oben stehen.
              accessor: (row) => (row as HeroRow).net ?? -1,
              title: 'kB',
              sortable: true,
              align: 'right',
              width: '4rem',
              cell: sizeCell
            },
            // Stand hier bis 2026-07-27 als `Deps` mit 98-mal derselben Null:
            // Ein Beweis, der sich hundertmal wiederholt, ist nach dem zweiten
            // Mal Tapete. `Props` hat Spannweite (3 bis 59) und sagt etwas,
            // das man der Zeile nicht ansieht — wie tief die Komponente geht.
            {
              accessor: 'props',
              title: 'Props',
              sortable: true,
              align: 'right',
              width: '4rem',
              cell: propsCell
            }
          ]}
        >
          {#snippet pagination()}{/snippet}
        </Table>
      </section>

      <section class="preview" aria-label="Component preview">
        <!-- `aria-live` sitzt am Kopf, nicht am ganzen Panel: Sonst liest ein
             Screenreader bei jeder Zeile das komplette Specimen-Markup vor. -->
        <div class="preview-head" aria-live="polite">
          <!-- Name und Kennzahlen teilen sich eine Zeile: Die Zahl gehört zum
               Namen, und die gesparte Zeile bringt die Bühne näher an den Titel.
               Ohne "0 deps" — das ist der Grundsatz des Sets, den die Spalte
               links schon Zeile für Zeile beweist; im Kopf jeder Komponente
               wiederholt wird er zur Floskel. -->
          <div class="title-row">
            <!-- Der Name IST der Weg in die Doku. Ein Link unten im Panel war
                 zu leise für den einzigen Ausgang aus der Vorschau; als
                 Überschrift kostet er kein zusätzliches Chrome und liegt da,
                 wo der Blick ohnehin zuerst hinfällt. -->
            <h1>
              {#if specimen}
                <a href={specimen.docsHref}>
                  {selected.name}<span class="arrow" aria-hidden="true">↗</span>
                </a>
              {:else}
                {selected.name}
              {/if}
            </h1>
            <!-- Ohne Baseline fällt die Größe weg, statt als "— kB" dazustehen:
                 Ein Gedankenstrich mit Einheit sieht aus wie eine Messung, die
                 null ergeben hat. -->
            <p class="meta">
              {selected.family} · {selected.pkg}{selected.net == null
                ? ''
                : ` · ${formatKb(selected.net)} kB`}
            </p>
          </div>
          <p class="desc">{selected.description}</p>
          <!-- Nur für Zeilen, die sich ein Beispiel teilen (heute: die neun
               Guide-Oberflächen). Siehe `SHARED_PREVIEW_NOTES`. -->
          {#if sharedNote}
            <p class="shared-note">{sharedNote}</p>
          {/if}
        </div>

        <!-- `{#key}` setzt den lokalen Zustand der Vorschau (Control-Werte,
             Toggle, Slider) beim Wechsel zurück. -->
        {#key selected.id}
          <div class={['stage', specimen?.interactive && 'has-playground']}>
            {#if specimen}
              {#await specimen.load() then module}
                {@const Specimen = module.default}
                {#if specimen.interactive}
                  <Specimen size="sm" slotClasses={PLAYGROUND_SLOTS} />
                {:else}
                  <Specimen />
                {/if}
              {/await}
            {:else}
              <!-- Kein geteiltes Beispiel (die acht Guide-Oberflächen ohne
                   eigene Route, `Artifacts` als Roadmap-Zeile): die
                   Achsen-Ansicht statt einer erfundenen Vorschau. -->
              <HeroSpecimen row={selected} />
            {/if}
          </div>
        {/key}

        <!-- Nur ohne Playground: Der bringt sein eigenes Code-Panel mit, und
             zwei Codezeilen untereinander wären eine Dublette. -->
        {#if !specimen?.interactive}
          <code>{selected.importLine}</code>
        {/if}
      </section>
    </main>

    <!-- Claim als Bildunterschrift, nicht als Überschrift: Die Liste hat das
         Argument schon gemacht.

         Der Satz zeigte auf die `Deps`-Spalte („which is why that column reads
         zero, all the way down"), solange es sie gab. Sie ist raus — hundertmal
         dieselbe Null beweist nach dem zweiten Mal nichts mehr —, also trägt
         der Satz die Aussage jetzt selbst, statt auf eine Spalte zu deuten. -->
    <footer>
      <p>
        {data.rows.length} components, one package, nothing else in your lockfile. Everything in the set
        was made in it.
      </p>
      <!-- Die kB-Spalte behauptet etwas Präzises und muss sagen, was sie misst.
           Ohne den Abzug stünde in jeder Zeile im Wesentlichen derselbe Sockel:
           ein Separator misst 5,1 kB, davon 4,6 kB Fundament. -->
      <p class="fineprint">
        kB is gzipped, measured on every build: what a component adds to a project already using the
        library. Counted once and not per row — the {formatKb(data.foundationGz)} kB foundation (variant
        engine, provider context) and the Svelte runtime your app bundles anyway.
      </p>
    </footer>
  </div>
</I18nProvider>

{#snippet nameCell(item: unknown, value: unknown)}
  {@const status = (item as HeroRow).status}
  <span class="name">{value}</span>{#if status !== 'shipped'}<span class="status">{status}</span
    >{/if}
{/snippet}

{#snippet quietCell(_item: unknown, value: unknown)}
  <span class="quiet">{value}</span>
{/snippet}

{#snippet sizeCell(item: unknown)}
  <span class="num">{formatKb((item as HeroRow).net)}</span>
{/snippet}

{#snippet propsCell(item: unknown)}
  <span class="num">{(item as HeroRow).props}</span>
{/snippet}

<style>
  .hero {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    /* `height`, nicht `min-height`: Sonst wächst die mittlere Zeile mit den
       98 Zeilen mit, die Seite selbst scrollt und der Fuß rutscht davon. */
    height: 100dvh;
    overflow: hidden;
    padding: 1.5rem clamp(1rem, 3vw, 2.5rem) 0;
    background: var(--color-surface-base);
    color: var(--color-text-primary);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding-bottom: 1.25rem;
  }
  .wordmark {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .wordmark span {
    color: var(--color-text-quaternary);
  }
  .search {
    width: min(18rem, 42vw);
  }

  /* Das Inventar ist halb Navigation, halb Beweis — es braucht die Breite
     seiner fünf Spalten und keine mehr. Als 8fr-Hälfte wuchs es mit dem
     Fenster, obwohl sein Inhalt das nicht tut, und die Vorschau blieb bei der
     Hälfte stehen. Jetzt eine gedeckelte Spalte: sie folgt dem Fenster, aber
     hört bei der Breite ihrer Spalten auf.

     Absolute Einheiten, nicht `min(…, max-content)` — intrinsische Größen sind
     in `grid-template-columns` innerhalb von `min()` ungültig, die ganze
     Deklaration fällt weg und das Grid wird einspaltig. */
  main {
    display: grid;
    grid-template-columns: clamp(26rem, 36vw, 34rem) minmax(0, 1fr);
    gap: clamp(2rem, 5vw, 4.5rem);
    min-height: 0;
  }

  /* Das Inventar scrollt in seiner Spalte, die Seite selbst steht still.
     Der Kopf bleibt dabei stehen: `sticky` (page-relativ) und `fit="viewport"`
     (eigene Scrollbox) treffen beide diesen Fall nicht, also pinnt ihn hier
     ein Zweizeiler gegen den Scroll-Container, den diese Spalte ohnehin ist. */
  .inventory {
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .inventory :global(thead th) {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--color-surface-base);
  }

  /* Die einzige Kante der Seite. `min-height: 0` + eigener Scroll, weil der
     eingebettete Playground (Vorschau + Controls + Code) höher wird als der
     Viewport — ohne das bläht er die Grid-Zeile auf und schiebt die Liste
     unter den Fuß. */
  .preview {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    border-left: 1px solid var(--color-border-hairline);
    padding-left: clamp(2rem, 5vw, 4.5rem);
    margin-left: calc(clamp(2rem, 5vw, 4.5rem) * -1);
  }

  /* Name links, Kennzahlen rechts auf derselben Grundlinie. `baseline`, nicht
     `center`: Die Meta-Zeile soll auf der Schriftlinie des Namens sitzen, nicht
     in seiner optischen Mitte schweben. */
  .title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  .preview-head h1 {
    margin: 0;
    font-size: clamp(1.75rem, 3vw, 2.5rem);
    font-weight: 300;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  /* Der Link trägt keine eigene Farbe und keine Unterstreichung im Ruhezustand
     — die Überschrift soll eine Überschrift bleiben. Der Pfeil ist die
     Affordance, er kommt beim Hover heran statt aufzutauchen (kein Sprung). */
  .preview-head h1 a {
    color: inherit;
    text-decoration: none;
  }
  .preview-head h1 .arrow {
    display: inline-block;
    margin-left: 0.35em;
    font-size: 0.5em;
    vertical-align: 0.5em;
    color: var(--color-text-quaternary);
    transform: translateX(-0.15em);
    transition:
      transform 160ms ease,
      color 160ms ease;
  }
  .preview-head h1 a:hover {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.16em;
  }
  .preview-head h1 a:hover .arrow {
    transform: translateX(0);
    color: var(--color-primary);
  }
  .preview-head h1 a:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
    border-radius: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .preview-head h1 .arrow {
      transition: none;
    }
  }
  .meta {
    margin: 0;
    font-size: 0.6875rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-quaternary);
    white-space: nowrap;
  }
  .desc {
    margin: 0.9rem 0 0;
    max-width: 52ch;
    font-size: 0.9375rem;
    line-height: 1.55;
    color: var(--color-text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Eine Stufe leiser als die Beschreibung und mit einer Kante davor: Der Satz
     redet über die *Vorschau*, nicht über die Komponente — er darf nicht als
     zweiter Beschreibungssatz gelesen werden. */
  .shared-note {
    margin: 0.6rem 0 0;
    max-width: 52ch;
    padding-left: 0.7rem;
    border-left: 1px solid var(--color-border-subtle);
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--color-text-tertiary);
  }

  /* Die Bühne ist keine Box: nur Platz, in dem etwas steht. Oben ausgerichtet
     statt mittig — vertikal zentriert hängt ein kleines Specimen mitten im
     Nichts, während der Text weit darüber steht. */
  .stage {
    display: grid;
    align-content: start;
    justify-items: start;
    padding: clamp(1.25rem, 3vh, 2.25rem) 0 1.5rem;
    animation: rise 240ms ease-out;
  }
  /* Der Playground füllt die Breite; die handgeschriebenen Specimen dürfen
     nicht über die Lesebreite hinauslaufen. */
  .stage > :global(*) {
    width: 100%;
  }
  .stage:not(.has-playground) > :global(*) {
    max-width: 32rem;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .stage {
      animation: none;
    }
  }

  .preview code {
    font-size: 0.75rem;
    color: var(--color-text-quaternary);
    padding-bottom: 1.25rem;
    overflow-x: auto;
    white-space: nowrap;
  }

  /* Claim und Fußnote nebeneinander, nicht untereinander: gestapelt kostete
     die Erläuterung drei Zeilen Fußhöhe, und die nimmt sich das Grid von der
     Liste. Dieselbe Spaltenteilung wie `main`, damit der Claim unter dem
     Inventar steht (das seine Nullspalte beweist) und die Fußnote zur kB-Zahl
     an der Kante der Vorschau beginnt. */
  footer {
    display: grid;
    grid-template-columns: clamp(26rem, 36vw, 34rem) minmax(0, 1fr);
    align-items: start;
    gap: clamp(2rem, 5vw, 4.5rem);
    padding: 1rem 0 1.5rem;
    border-top: 1px solid var(--color-border-hairline);
  }
  footer p {
    margin: 0;
    max-width: 60ch;
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--color-text-quaternary);
  }
  /* Eine Stufe leiser als der Claim daneben: Es ist die Fußnote zu einer
     Spalte, nicht das zweite Argument der Seite. Die Lesebreite des Claims
     gilt hier nicht — bei dieser Schriftgröße bliebe sonst die halbe Spalte
     leer und der Fuß eine Zeile höher, die dem Inventar fehlt. */
  .fineprint {
    max-width: none;
    font-size: 0.75rem;
    line-height: 1.55;
    opacity: 0.75;
  }

  /* ── Zellen ─────────────────────────────────────────────────────────── */

  .name {
    font-weight: 450;
  }
  .quiet,
  .num {
    color: var(--color-text-quaternary);
  }
  /* Zwei Zahlenspalten untereinander lesen sich nur, wenn die Ziffern
     fluchten. */
  .num {
    font-variant-numeric: tabular-nums;
  }
  /* Der Reifegrad steht neben dem Namen statt in einer eigenen Spalte: Er ist
     bei 60 der 98 Zeilen leer, kostete aber überall Breite — in der Hälfte,
     die schmaler werden sollte. Neben dem Namen nutzt er den Platz, den kurze
     Namen ohnehin frei lassen. Kleinbuchstaben, weil es eine Einordnung ist
     wie die Familie daneben, keine Warnung. */
  .status {
    margin-left: 0.5em;
    font-size: 0.6875rem;
    letter-spacing: 0.02em;
    color: var(--color-text-quaternary);
  }

  /* Die Table markiert die gezeigte Zeile selbst (`activeRowId` → `aria-current`
     + `data-active` + eigener Grund), ohne dafür eine Checkbox-Spalte
     einzuschalten. Hier bleibt nur die redaktionelle Zuspitzung: In einer Liste
     ohne Zeilentrenner trägt der Name die Markierung deutlicher als die Fläche. */
  .inventory :global(tbody tr[data-active] .name) {
    color: var(--color-text-primary);
    font-weight: 550;
  }

  @media (max-width: 60rem) {
    /* Gestapelt darf die Seite nicht mehr auf Viewport-Höhe gedeckelt sein —
       sonst schneidet sie die Vorschau unter der Liste ab. Stattdessen
       scrollt das Dokument, und die Liste behält ihren eigenen Ausschnitt. */
    .hero {
      height: auto;
      overflow: visible;
    }
    .inventory {
      max-height: 55vh;
    }
    main {
      grid-template-columns: minmax(0, 1fr);
    }
    .preview {
      border-left: none;
      border-top: 1px solid var(--color-border-hairline);
      padding-left: 0;
      margin-left: 0;
      padding-top: 2rem;
    }
    /* Gestapelt ist Höhe kein knappes Gut mehr — die Seite scrollt ohnehin. */
    footer {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.6rem;
    }
  }
</style>
