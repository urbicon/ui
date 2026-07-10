<!--
  Landing page — "Color Rooms" (ported from the Claude Design project
  "Direction 3c — Color Rooms v2"). A fixed Mid-Century poster whose accent
  palette is swapped at runtime by a "channel" switcher. Each product tile is a
  saturated colour field holding a neutral card of REAL @urbicon-ui components;
  the room's field colour is scoped as their `--color-primary` family, so
  switching the channel repaints the whole building — including the live
  switches, date pickers and table rows — through the token system, not a
  mockup. See lib/style/rooms.css for the scoping contract.

  The landing brings its own chrome (it is exempt from the SidebarLayout in
  +layout.svelte); the skip-link and ⌘K stay global.
-->
<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset, resolve } from '$app/paths';
  import { REPO_URL } from '$lib/seo';
  import { onMount } from 'svelte';
  import {
    Avatar,
    Badge,
    Button,
    CheckIcon,
    Combobox,
    CopyIcon,
    CurrencyInput,
    DateRangePicker,
    LocaleSwitcher,
    NumberInput,
    PasskeyIcon,
    SegmentGroup,
    SegmentItem,
    Sparkline,
    Spinner
  } from '@urbicon-ui/blocks';
  import { Table } from '@urbicon-ui/table';
  import type { PageData } from './$types';
  import '$lib/style/rooms.css';

  // Build-time counts (catalog + icon registry, see +page.server.ts) — the
  // poster's numbers are derived, never hand-maintained.
  let { data }: { data: PageData } = $props();
  const counts = $derived(data.counts);

  // ── Palette channels ──────────────────────────────────────────────
  // Three Mid-Century palettes; each has four "fields" (a saturated bg + an
  // ink/cream fg picked for contrast). Switching the channel repaints the page.
  const INK = '#17150f';
  const CREAM = '#f6f3ec';

  type ChannelKey = 'gallery' | 'terrazza' | 'motel';
  type Field = { bg: string; fg: string };
  interface Channel {
    label: string;
    fields: [Field, Field, Field, Field];
    bright: string;
  }

  const CHANNELS: Record<ChannelKey, Channel> = {
    gallery: {
      label: "Gallery '52",
      fields: [
        { bg: '#e8500f', fg: INK },
        { bg: '#00845c', fg: CREAM },
        { bg: '#e3a31c', fg: INK },
        { bg: '#7c1f2d', fg: CREAM }
      ],
      bright: '#ff8a50'
    },
    terrazza: {
      label: "Terrazza '58",
      fields: [
        { bg: '#7c7e4a', fg: CREAM },
        { bg: '#d2a017', fg: INK },
        { bg: '#6e2b33', fg: CREAM },
        { bg: '#b4653f', fg: CREAM }
      ],
      bright: '#c9cc7e'
    },
    motel: {
      label: "Motel '64",
      fields: [
        { bg: '#e45a12', fg: INK },
        { bg: '#1f9e96', fg: INK },
        { bg: '#6b4423', fg: CREAM },
        { bg: '#e0b040', fg: INK }
      ],
      bright: '#ff9550'
    }
  };
  const CHANNEL_ORDER: ChannelKey[] = ['gallery', 'terrazza', 'motel'];

  let channel = $state<ChannelKey>('gallery');
  const active = $derived(CHANNELS[channel]);
  const fields = $derived(active.fields);

  // Room → field mapping (from the mockup). Hero + AI share f[0]; Table + install
  // share f[2]. Each room repaints with a staggered delay for the room-by-room
  // "repaint the building" effect. `id` doubles as the hero index-panel anchor.
  const hero = $derived(fields[0]);
  const rooms = $derived([
    { key: 'blocks', id: 'blocks', field: fields[1], delay: '0.04s' },
    { key: 'table', id: 'table', field: fields[2], delay: '0.08s' },
    { key: 'auth', id: 'auth', field: fields[3], delay: '0.12s' },
    { key: 'ai', id: 'machines', field: fields[0], delay: '0.16s' }
  ] as const);
  const install = $derived(fields[2]);

  // Hero index panel — the inverted "what's in the set" register. One row per
  // room, anchored to the tiles below.
  const PANEL_ITEMS = $derived([
    { href: '#blocks', name: 'Blocks', sub: `${counts.blocks} components, one grammar` },
    { href: '#table', name: 'Table', sub: 'live remote mode' },
    { href: '#auth', name: 'Auth', sub: 'passkeys, Web Crypto only' },
    { href: '#machines', name: 'For machines', sub: 'your agent gets reviewed' }
  ] as const);

  // ── Blocks specimen: the studio plans its offsite ─────────────────
  // A relatable composition instead of a settings form: SegmentGroup swaps the
  // destination list AND the fare curve, so every control visibly talks to the
  // others — not a static screenshot.
  let uiLocale = $state<'en' | 'de'>('en');
  const dpLocale = $derived(uiLocale === 'de' ? 'de-DE' : 'en-US');

  type Vibe = 'city' | 'coast' | 'alps';
  const DESTINATIONS: Record<Vibe, { label: string; value: string }[]> = {
    city: [
      { label: 'Copenhagen', value: 'cph' },
      { label: 'Kraków', value: 'krk' },
      { label: 'Porto', value: 'opo' },
      { label: 'Vienna', value: 'vie' }
    ],
    coast: [
      { label: 'Lisbon', value: 'lis' },
      { label: 'Palermo', value: 'pmo' },
      { label: 'Split', value: 'spu' },
      { label: 'Biarritz', value: 'biq' }
    ],
    alps: [
      { label: 'Innsbruck', value: 'ibk' },
      { label: 'Chamonix', value: 'cmx' },
      { label: 'Bolzano', value: 'bzo' },
      { label: 'Kranjska Gora', value: 'kgo' }
    ]
  };
  // Deterministic 12-week fare curves per vibe (no Math.random — SSR and
  // client must agree).
  const FARES: Record<Vibe, number[]> = {
    city: [172, 168, 171, 160, 156, 149, 151, 144, 138, 141, 133, 129],
    coast: [148, 152, 143, 139, 141, 132, 128, 131, 122, 118, 114, 109],
    alps: [196, 189, 192, 181, 176, 179, 168, 161, 158, 152, 149, 143]
  };
  let vibe = $state('coast');
  let destination = $state<string | null>('lis');
  // Fixed literals — deterministic across SSR/hydration (no `new Date()` drift).
  let range = $state({
    start: new Date('2027-05-03T00:00:00'),
    end: new Date('2027-05-07T00:00:00')
  });
  let budget = $state<number | null>(128000); // minor units: €1,280.00
  let team = $state<number | null>(12);
  const vibeKey = $derived((vibe in DESTINATIONS ? vibe : 'coast') as Vibe);
  const fares = $derived(FARES[vibeKey]);
  const destinationLabel = $derived(
    DESTINATIONS[vibeKey].find((d) => d.value === destination)?.label ?? 'anywhere'
  );
  function onVibeChange(next: string) {
    destination = DESTINATIONS[(next in DESTINATIONS ? next : 'coast') as Vibe][0].value;
  }

  function persistLocale(locale: string) {
    uiLocale = locale === 'de' ? 'de' : 'en';
    try {
      localStorage.setItem('urbicon-locale', locale);
    } catch {
      /* SSR / private mode — non-fatal */
    }
  }

  // ── Table specimen: today's departures, fully interactive ─────────
  // The wow is feature richness you can SEE and touch: the SmartFilterBar
  // (on by default), header menus (sort/group/hide), live status churn.
  // Deliberately NOT virtualized: grouping silently disables virtualization
  // and the two-table virtual layout drifts column widths — both logged in
  // docs/technical-debt.md (2026-07-11).
  interface Departure {
    id: string;
    flight: string;
    to: string;
    departs: string;
    status: 'boarding' | 'on time' | 'departed';
  }
  const AIRLINES = ['UB', 'NX', 'TZ', 'GL', 'MO'];
  const DEST_CITIES = [
    'Lisbon',
    'Copenhagen',
    'Palermo',
    'Reykjavík',
    'Kraków',
    'Porto',
    'Vienna',
    'Athens',
    'Split',
    'Biarritz',
    'Tromsø',
    'Valletta'
  ];
  // Today's board, 06:00–23:55 in 5-minute slots (216 rows) — enough for the
  // pager to show scale while grouping by city stays legible. Generated
  // deterministically (no Math.random: SSR and client must agree), pre-sorted
  // by slot (the table has no initial-sort API yet — see
  // docs/technical-debt.md). "06:35" sorts lexicographically.
  const DEPARTURES: Departure[] = Array.from({ length: 216 }, (_, i) => {
    const hh = String(6 + Math.floor(i / 12)).padStart(2, '0');
    const mm = String((i % 12) * 5).padStart(2, '0');
    return {
      id: `dep-${i}`,
      flight: `${AIRLINES[i % AIRLINES.length]} ${100 + ((i * 37) % 900)}`,
      to: DEST_CITIES[(i * 7) % DEST_CITIES.length],
      departs: `${hh}:${mm}`,
      status: 'on time' as const
    };
  });
  const DEPARTURE_COUNT = DEPARTURES.length.toLocaleString('en-US');
  // One row preselected so the selected state shows the room accent on load.
  // Controlled selection is the table's only preselection path, so row clicks
  // must be synced back via onSelectionChange — a static array would freeze
  // the selection (the provider re-asserts the prop over internal clicks).
  let tableSelected = $state<Array<string | number>>(['dep-2']);
  // Columns live in the template (inline on <Table>) because the status
  // column renders through the `statusCell` snippet, which only exists there.
  // Deterministic status churn (no Math.random — no SSR/hydration mismatch).
  let tick = $state(0);
  const statusFor = (i: number): Departure['status'] => {
    const phase = (i * 11 + tick * 3) % 29;
    return phase < 5 ? 'boarding' : phase < 8 ? 'departed' : 'on time';
  };
  const departures = $derived(DEPARTURES.map((d, i) => ({ ...d, status: statusFor(i) })));

  // ── Auth specimen: a real passkey sign-in flow ────────────────────
  let authState = $state<'idle' | 'pending' | 'ok'>('idle');
  let authTimers: ReturnType<typeof setTimeout>[] = [];
  function doAuth() {
    authTimers.forEach(clearTimeout);
    authState = 'pending';
    authTimers = [
      setTimeout(() => (authState = 'ok'), 900),
      setTimeout(() => (authState = 'idle'), 3400)
    ];
  }

  // ── "View source" flip ────────────────────────────────────────────
  // Each specimen card can flip to the handful of Svelte lines that render
  // it — result, code and theming in one screen. The excerpts are honest
  // abridgements of this very file (state wiring elided, no invented API).
  let sourceShown = $state({ blocks: false, table: false, auth: false });
  type SpecimenKey = keyof typeof sourceShown;
  const SPECIMEN_SOURCE: Record<SpecimenKey, string> = {
    blocks: `<SegmentGroup bind:value={vibe} size="sm">
  <SegmentItem value="city">City</SegmentItem>
  <SegmentItem value="coast">Coast</SegmentItem>
  <SegmentItem value="alps">Alps</SegmentItem>
</SegmentGroup>

<Combobox label="Destination" options={destinations[vibe]}
  bind:value={destination} size="sm" />
<DateRangePicker label="Dates" bind:value={range} size="sm" />
<CurrencyInput label="Budget / person" currency="EUR"
  bind:value={budget} size="sm" />
<NumberInput label="Team" bind:value={team} min={1} size="sm" />

<Sparkline data={fares[vibe]} area showEndPoint />`,
    table: `<!-- filter bar, header menus, grouping: on by default -->
<Table
  items={departures}
  columns={[
    { accessor: 'flight', title: 'Flight', sortable: true },
    { accessor: 'to', title: 'To', sortable: true },
    { accessor: 'departs', title: 'Departs', sortable: true },
    { accessor: 'status', title: 'Status', cell: statusCell }
  ]}
  selectionMode="single"
  selectedIds={selected}
  itemsPerPage={6}
/>`,
    auth: `<Avatar name="Nora Ackermann" size="sm" />

<Button intent="primary" class="w-full" onclick={signIn}>
  {#if authState === 'ok'}
    <CheckIcon /> nora@atelier.de
  {:else if authState === 'pending'}
    <Spinner size="sm" /> Verifying…
  {:else}
    <PasskeyIcon /> Continue with passkey
  {/if}
</Button>

<Badge intent="neutral" variant="outlined">
  WebAuthn
</Badge>`
  };

  // ── Feature ticker: the "also in the box" register ────────────────
  // Counts ride the build (see +page.server.ts); everything else is a claim
  // the docs actually back. Rendered twice for the seamless marquee loop.
  const TICKER_ITEMS = $derived([
    `${counts.set} components`,
    `${counts.icons} original icons`,
    'Svelte 5 + Tailwind 4',
    'zero runtime dependencies',
    'i18n with usage audit',
    'virtualized table',
    'passkeys + web push',
    'command palette',
    'charts · calendar · planner',
    'dark mode = one token',
    'MIT'
  ]);

  // ── Install specimen: copy-to-clipboard ───────────────────────────
  const INSTALL_COMMAND = 'bun add @urbicon-ui/blocks';
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 2000);
    } catch (err) {
      console.warn('Clipboard unavailable:', err);
    }
  }

  // Entrance + live-latency timer.
  let ready = $state(false);
  onMount(() => {
    const raf = setTimeout(() => (ready = true), 60);
    const iv = setInterval(() => (tick += 1), 2400);
    return () => {
      clearTimeout(raf);
      clearInterval(iv);
      authTimers.forEach(clearTimeout);
      clearTimeout(copyTimer);
    };
  });

  const footerYear = 2026;
</script>

<SeoMeta />

{#snippet statusCell(_item: Departure, value: unknown)}
  <!-- Palette-true status: `primary` rides the room accent, `neutral` stays
       warm grey — no foreign intent hues inside a room (same rule as the
       chart tokens in rooms.css). -->
  <Badge
    intent={value === 'boarding' ? 'primary' : 'neutral'}
    variant={value === 'on time' ? 'outlined' : 'soft'}
    class="font-mono text-[10px] whitespace-nowrap">{String(value)}</Badge
  >
{/snippet}

<!-- Source flip — the ink chip on each specimen card's corner and the dark
     code pane it toggles to. Result, code and theming share one screen. -->
{#snippet sourceFlip(key: SpecimenKey)}
  <button
    type="button"
    class="absolute -top-3 -right-3 flex h-7 items-center border px-2 font-mono text-[11px] font-bold transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    style="background: {INK}; color: {CREAM}; border-color: rgb(246 243 236 / 0.25)"
    aria-pressed={sourceShown[key]}
    aria-label={sourceShown[key] ? 'Show the rendered result' : 'Show the source code'}
    onclick={() => (sourceShown[key] = !sourceShown[key])}
  >
    {sourceShown[key] ? 'UI' : '</>'}
  </button>
{/snippet}

{#snippet sourcePane(code: string)}
  <div class="poster-term p-5 font-mono text-[12px] leading-[1.75]">
    <p class="mb-3 opacity-55"># this card, verbatim</p>
    <pre class="overflow-x-auto whitespace-pre">{code}</pre>
  </div>
{/snippet}

<!-- Palette channel switcher — reused in the hero (compact) and the repaint
     section (with labels). Real control: repaints the whole page. -->
{#snippet paletteSwitcher(withLabel: boolean, onField: boolean)}
  <div class="flex flex-wrap gap-3">
    {#each CHANNEL_ORDER as key (key)}
      {@const c = CHANNELS[key]}
      {@const isActive = key === channel}
      <button
        type="button"
        onclick={() => (channel = key)}
        aria-pressed={isActive}
        title={c.label}
        class={[
          'flex flex-col gap-2 p-2 transition-opacity',
          withLabel ? 'items-start' : 'items-center',
          !isActive && 'opacity-80 hover:opacity-100'
        ]}
        style="border: {isActive
          ? '2px solid currentColor'
          : onField
            ? '1px solid color-mix(in srgb, currentColor 32%, transparent)'
            : '1px solid rgb(246 243 236 / 0.3)'}"
      >
        <span class="flex" aria-hidden="true">
          {#each c.fields as field (field.bg)}
            <span
              class={withLabel ? 'h-[30px] w-[30px]' : 'h-4 w-4'}
              style="background: {field.bg}; transition: background 0.5s ease"
            ></span>
          {/each}
        </span>
        {#if withLabel}
          <span class="text-[13.5px] font-medium">{c.label}</span>
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

<div class="rooms-landing min-h-screen">
  <main id="main-content">
    <!-- ─────────────────────────── Hero ─────────────────────────── -->
    <section
      class="rooms-field flex min-h-[70svh] flex-col justify-between px-[var(--rooms-gutter)] pt-7 pb-10 lg:min-h-[72vh]"
      style="background: {hero.bg}; color: {hero.fg}"
    >
      <div class="flex items-center justify-between gap-4">
        <span class="text-[17px] font-bold tracking-[-0.01em]">Urbicon UI</span>
        <nav
          aria-label="Landing"
          class="flex items-center gap-5 text-[14.5px] font-medium sm:gap-8"
        >
          <a href={resolve('/blocks')} class="transition-opacity hover:opacity-70">Docs</a>
          <a href="#set" class="hidden transition-opacity hover:opacity-70 sm:inline">The set</a>
          <a href="#repaint" class="hidden transition-opacity hover:opacity-70 sm:inline">Palette</a
          >
          <a href="#machines" class="hidden transition-opacity hover:opacity-70 sm:inline"
            >For machines</a
          >
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            class="transition-opacity hover:opacity-70">Codeberg ↗</a
          >
        </nav>
      </div>

      <div
        class="flex flex-1 flex-col justify-center gap-12 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16"
      >
        <div
          class={[
            'max-w-[600px] transition-[transform,opacity] duration-700',
            ready ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
          ]}
        >
          <!-- The eyebrow names the what + the stack; the H1 keeps the claim
               deadpan (no "0 dependencies" here — that would tell the joke
               before the punchline). -->
          <p class="font-mono text-[11px] tracking-[0.14em] text-balance uppercase opacity-70">
            The component set for Svelte 5 + Tailwind 4
          </p>
          <h1 class="mt-4 text-[clamp(2.75rem,6.5vw,5.25rem)]">Depends on nothing.</h1>
        </div>

        <!-- Inverted index panel — answers "what's in it?" without a scroll.
             The arrows carry the hero field colour, so the panel repaints with
             the channel like everything else. -->
        <nav
          aria-label="The set"
          class={[
            'w-full max-w-[440px] shrink-0 p-6 transition-[transform,opacity] delay-100 duration-700 sm:p-7',
            ready ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
          ]}
          style="background: {INK}; color: {CREAM}"
        >
          <p class="font-mono text-[11px] tracking-[0.14em] uppercase opacity-60">The set</p>
          <ul class="mt-1.5">
            {#each PANEL_ITEMS as item, i (item.href)}
              <li style={i > 0 ? 'border-top: 1px solid rgb(246 243 236 / 0.18)' : ''}>
                <a
                  href={item.href}
                  class="group flex items-baseline gap-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  <span class="text-[clamp(1.1rem,1.5vw,1.35rem)] font-semibold tracking-[-0.01em]"
                    >{item.name}</span
                  >
                  <span class="flex-1 text-right text-[12.5px] opacity-65">{item.sub}</span>
                  <span
                    aria-hidden="true"
                    class="font-bold group-hover:translate-x-1"
                    style="color: {hero.bg}; transition: color 0.5s ease, transform 0.15s ease"
                    >→</span
                  >
                </a>
              </li>
            {/each}
          </ul>
        </nav>
      </div>

      <div
        class={[
          'flex flex-wrap items-end justify-between gap-x-10 gap-y-8 transition-[transform,opacity] delay-150 duration-700',
          ready ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        ]}
      >
        <div>
          <div class="flex items-baseline gap-3">
            <span
              class="text-[clamp(1.75rem,4vw,2.5rem)] font-medium tracking-[-0.03em] line-through opacity-50 [text-decoration-thickness:3px]"
              >1,000</span
            >
            <span class="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em]">1</span>
          </div>
          <p class="mt-2 max-w-[280px] text-[12.5px] opacity-80">
            Replace an endless supply chain with 1 package
          </p>
        </div>

        <div>
          {@render paletteSwitcher(false, true)}
          <p class="mt-2 text-[12.5px] opacity-80">
            {active.label}
          </p>
        </div>

        <a
          href={resolve('/getting-started')}
          class="border-b-2 border-current pb-[3px] text-[17px] font-bold transition-opacity hover:opacity-70"
          >Get the set →</a
        >
      </div>
    </section>

    <!-- ────────────────────── Product rooms ─────────────────────── -->
    <h2 class="sr-only" id="set">The set</h2>
    <section class="grid grid-cols-1 md:grid-cols-2">
      {#each rooms as room, i (room.key)}
        <div
          class={[
            'rooms-field flex min-h-[560px] flex-col px-[var(--rooms-gutter)] py-10',
            // Wide screens: the outer edge keeps the growing gutter, the edge
            // toward the grid's center falls back to the fixed poster margin.
            i % 2 === 0 ? 'md:pr-12' : 'md:pl-12'
          ]}
          id={room.id}
          style="background: {room.field.bg}; color: {room.field.fg}; --room-delay: {room.delay}"
        >
          {#if room.key === 'blocks'}
            <!-- Blocks — the studio plans its offsite -->
            <div class="flex items-baseline justify-between gap-5">
              <h3 class="text-[clamp(2rem,4vw,2.5rem)]">Blocks</h3>
              <span class="text-[13.5px] opacity-80"
                >{counts.primitives} primitives + {counts.composed} composed</span
              >
            </div>
            <p class="mt-2.5 max-w-[420px] text-[15.5px] leading-relaxed opacity-90">
              Forms, overlays, navigation, charts — themable down to the slot. Flip the vibe and
              watch every control follow.
            </p>

            <div class="my-7 flex-1">
              <div class="relative max-w-[540px]">
                {#if sourceShown.blocks}
                  {@render sourcePane(SPECIMEN_SOURCE.blocks)}
                {:else}
                  <div
                    class="poster-card room-accent p-5"
                    style="--room-accent: {room.field.bg}; --room-accent-fg: {room.field.fg}"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <span class="text-[13px] font-bold text-text-primary">Offsite '27</span>
                      <SegmentGroup
                        bind:value={vibe}
                        size="sm"
                        ariaLabel="Trip vibe"
                        onValueChange={onVibeChange}
                      >
                        <SegmentItem value="city">City</SegmentItem>
                        <SegmentItem value="coast">Coast</SegmentItem>
                        <SegmentItem value="alps">Alps</SegmentItem>
                      </SegmentGroup>
                    </div>

                    <div class="mt-4 grid gap-4 sm:grid-cols-2">
                      <Combobox
                        label="Destination"
                        options={DESTINATIONS[vibeKey]}
                        bind:value={destination}
                        size="sm"
                        placeholder="Search…"
                      />
                      <DateRangePicker
                        label="Dates"
                        bind:value={range}
                        locale={dpLocale}
                        size="sm"
                        clearable={false}
                      />
                      <CurrencyInput
                        label="Budget / person"
                        bind:value={budget}
                        currency="EUR"
                        locale={dpLocale}
                        size="sm"
                      />
                      <NumberInput label="Team" bind:value={team} min={1} max={48} size="sm" />
                    </div>

                    <div class="mt-4">
                      <div class="flex items-baseline justify-between gap-4">
                        <span class="text-[12px] font-semibold text-text-secondary"
                          >Fares to {destinationLabel}</span
                        >
                        <span class="font-mono text-[11px] text-text-tertiary">12-week trend</span>
                      </div>
                      <Sparkline
                        data={fares}
                        area
                        showEndPoint
                        width={460}
                        height={44}
                        ariaLabel="Fare trend to {destinationLabel}, 12 weeks"
                        class="mt-1 w-full"
                      />
                    </div>

                    <div class="mt-5 flex justify-end gap-2.5">
                      <Button variant="outlined" size="sm">Share draft</Button>
                      <Button intent="primary" size="sm">Book the week</Button>
                    </div>
                  </div>
                {/if}
                {@render sourceFlip('blocks')}
              </div>
            </div>

            <div class="mt-auto flex items-baseline justify-between gap-5">
              <span class="text-[13px] opacity-75"
                >SegmentGroup · Combobox · DateRangePicker · CurrencyInput · NumberInput · Sparkline</span
              >
              <a
                href={resolve('/blocks')}
                class="border-b-2 border-current pb-0.5 text-[15px] font-bold whitespace-nowrap transition-opacity hover:opacity-70"
                >Browse →</a
              >
            </div>
          {:else if room.key === 'table'}
            <!-- Table — today's departures board, fully interactive -->
            <div class="flex items-baseline justify-between gap-5">
              <h3 class="text-[clamp(2rem,4vw,2.5rem)]">Table</h3>
              <span class="text-[13.5px] opacity-80">Filter · group · live</span>
            </div>
            <p class="mt-2.5 max-w-[420px] text-[15.5px] leading-relaxed opacity-90">
              Smart filter, header menus, grouping, selection, remote mode — try them all on today's
              board.
            </p>

            <div class="my-7 flex-1">
              <div class="relative max-w-[540px]">
                {#if sourceShown.table}
                  {@render sourcePane(SPECIMEN_SOURCE.table)}
                {:else}
                  <div
                    class="poster-card room-accent p-4"
                    style="--room-accent: {room.field.bg}; --room-accent-fg: {room.field.fg}"
                  >
                    <div
                      class="mb-2 flex items-center justify-between px-1 font-mono text-[11px] tracking-[0.04em] text-text-secondary"
                    >
                      <span>departures.board — {DEPARTURE_COUNT} flights today</span>
                      <span class="inline-flex items-center gap-1.5">
                        <span class="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary"
                        ></span>
                        live
                      </span>
                    </div>
                    <Table
                      items={departures}
                      columns={[
                        { accessor: 'flight', title: 'Flight', sortable: true },
                        { accessor: 'to', title: 'To', sortable: true },
                        { accessor: 'departs', title: 'Departs', sortable: true },
                        { accessor: 'status', title: 'Status', sortable: true, cell: statusCell }
                      ]}
                      selectionMode="single"
                      selectedIds={tableSelected}
                      onSelectionChange={(items) => (tableSelected = items.map((r) => r.id))}
                      itemsPerPage={6}
                      slotClasses={{ table: '!min-w-0' }}
                    />
                  </div>
                {/if}
                {@render sourceFlip('table')}
              </div>
            </div>

            <div class="mt-auto flex items-baseline justify-between gap-5">
              <span class="text-[13px] opacity-75"
                >Type a city in the filter, group via a header menu — it's all real</span
              >
              <a
                href={resolve('/table/table')}
                class="border-b-2 border-current pb-0.5 text-[15px] font-bold transition-opacity hover:opacity-70"
                >Explore →</a
              >
            </div>
          {:else if room.key === 'auth'}
            <!-- Auth — a real passkey sign-in flow -->
            <div class="flex items-baseline justify-between gap-5">
              <h3 class="text-[clamp(2rem,4vw,2.5rem)]">Auth</h3>
              <span class="text-[13.5px] opacity-80">Passkeys + Web Crypto</span>
            </div>
            <p class="mt-2.5 max-w-[420px] text-[15.5px] leading-relaxed opacity-90">
              Passkeys, JWT rotation, web push — on the Web Crypto API alone.
            </p>

            <div class="my-7 flex flex-1 items-start">
              <div class={['relative max-w-full', sourceShown.auth ? 'w-[460px]' : 'w-[340px]']}>
                {#if sourceShown.auth}
                  {@render sourcePane(SPECIMEN_SOURCE.auth)}
                {:else}
                  <div
                    class="poster-card room-accent w-[340px] max-w-full p-6"
                    style="--room-accent: {room.field.bg}; --room-accent-fg: {room.field.fg}"
                  >
                    <div class="flex items-center gap-3">
                      <Avatar name="Nora Ackermann" size="sm" />
                      <div>
                        <p class="text-[15px] font-bold text-text-primary">
                          Sign in to Atelier Nord
                        </p>
                        <p class="text-[12.5px] text-text-secondary">
                          No passwords stored, nothing to leak.
                        </p>
                      </div>
                    </div>

                    <div class="mt-5">
                      <Button
                        intent="primary"
                        class="w-full"
                        onclick={doAuth}
                        disabled={authState === 'pending'}
                      >
                        {#if authState === 'ok'}
                          <CheckIcon class="h-4 w-4" /> nora@atelier.de
                        {:else if authState === 'pending'}
                          <Spinner size="sm" /> Verifying…
                        {:else}
                          <PasskeyIcon class="h-4 w-4" /> Continue with passkey
                        {/if}
                      </Button>
                    </div>

                    <div class="mt-4 flex items-center justify-between">
                      {#if authState === 'ok'}
                        <span class="text-[12.5px] text-text-secondary"
                          >passkey verified · session started</span
                        >
                      {:else}
                        <a
                          href={resolve('/auth')}
                          class="text-[12.5px] text-text-secondary underline"
                          >or email a magic link</a
                        >
                      {/if}
                      <Badge intent="neutral" variant="outlined" class="font-mono text-[10px]"
                        >WebAuthn</Badge
                      >
                    </div>
                  </div>
                {/if}
                {@render sourceFlip('auth')}
              </div>
            </div>

            <div class="mt-auto flex items-baseline justify-between gap-5">
              <span class="text-[13px] opacity-75">Try it — the passkey flow is real UI</span>
              <a
                href={resolve('/auth')}
                class="border-b-2 border-current pb-0.5 text-[15px] font-bold transition-opacity hover:opacity-70"
                >Read the docs →</a
              >
            </div>
          {:else}
            <!-- Design — the closed loop: an agent generates, `urbicon validate`
                 reviews, the fix ships. The CLI + llms.txt are the serving channels. -->
            <div class="flex items-baseline justify-between gap-5">
              <h3 class="text-[clamp(2rem,4vw,2.5rem)]">For machines</h3>
              <span class="text-[13.5px] opacity-80">urbicon CLI · Hook & CI · llms.txt</span>
            </div>
            <p class="mt-2.5 max-w-[420px] text-[15.5px] leading-relaxed opacity-90">
              Hook the library into your AI workflow to give your model a deep understanding of all
              its aspects. You wire it once; the agent runs the loop.
            </p>

            <div class="my-7 flex-1">
              <div
                class="poster-term room-accent max-w-[540px] p-5 font-mono text-[12.5px] leading-[1.9]"
                style="--room-accent: {room.field.bg}; --room-accent-fg: {room.field.fg}"
              >
                <p class="opacity-55"># the design gate — in CI, or as an agent hook</p>
                <p>
                  <span class="opacity-55">$</span> urbicon validate routes/pricing/+page.svelte
                </p>
                <p class="pl-4">✗ [raw-tailwind-color] `bg-green-500`</p>
                <p class="pl-8 opacity-75">↳ use intent="success" — tokens, not raw palette</p>
                <p class="pl-4">! [focus-not-visible] `focus:ring-2`</p>
                <p class="pl-8 opacity-75">↳ use focus-visible: — keyboard-only rings</p>
                <p class="mt-3 opacity-55"># your agent fixes, re-runs —</p>
                <p>
                  <span class="text-primary">✓ no issues</span><span
                    class="term-caret ml-1 inline-block h-3 w-[7px] translate-y-[2px] bg-primary"
                  ></span>
                </p>
              </div>
            </div>

            <div class="mt-auto flex items-baseline justify-between gap-5">
              <span class="text-[13px] opacity-75"
                >Agents don’t just read the manual — they get a review</span
              >
              <a
                href={resolve('/ai')}
                class="border-b-2 border-current pb-0.5 text-[15px] font-bold transition-opacity hover:opacity-70"
                >Set up →</a
              >
            </div>
          {/if}
        </div>
      {/each}
    </section>

    <!-- ─────────────────────── Feature ticker ────────────────────── -->
    <!-- The "also in the box" register — full-bleed marquee. The separator
         squares ride the hero field colour, so the band repaints with the
         channel like everything else. -->
    <section
      aria-label="Also in the box"
      class="rooms-ticker py-4"
      style="background: {INK}; color: {CREAM}"
    >
      <div class="rooms-ticker-track">
        {#each [0, 1] as copy (copy)}
          <ul class="flex shrink-0 items-center" aria-hidden={copy === 1}>
            {#each TICKER_ITEMS as item (item)}
              <li
                class="flex items-center gap-7 pr-7 text-[clamp(1rem,1.6vw,1.35rem)] font-bold tracking-[-0.01em] whitespace-nowrap uppercase"
              >
                <span>{item}</span>
                <span
                  class="h-2.5 w-2.5"
                  style="background: {hero.bg}; transition: background 0.5s ease"
                  aria-hidden="true"
                ></span>
              </li>
            {/each}
          </ul>
        {/each}
      </div>
    </section>

    <!-- ──────────────────── Repaint the building ─────────────────── -->
    <section
      id="repaint"
      class="px-[var(--rooms-gutter)] py-20"
      style="background: #17150f; color: #f6f3ec"
    >
      <div class="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-[72px]">
        <div>
          <h2 class="text-[clamp(2.5rem,5vw,3.9rem)] !leading-[1.02]">Repaint the building.</h2>
          <p class="mt-6 max-w-[460px] text-[17px] leading-relaxed opacity-90">
            One token ramp — foundation, semantic, interaction. Pick a palette and every room on
            this page re-renders, down to the switches and table rows above. Dark mode is one more
            token, not a rewrite.
          </p>
          <div class="mt-9">
            {@render paletteSwitcher(true, false)}
          </div>
        </div>

        <div>
          <div
            class="room-accent border p-6 font-mono text-[13px] leading-loose"
            style="border-color: rgb(246 243 236 / 0.3); --room-accent: {active.bright}; --room-accent-fg: {INK}"
          >
            <p class="opacity-50"># the whole system is also plain text</p>
            <p><span class="opacity-50">$</span> bun add -d @urbicon-ui/design</p>
            <p style="color: {active.bright}; transition: color 0.5s ease">
              ✓ installed — design intelligence, pinned to your version
            </p>
            <p class="mt-3"><span class="opacity-50">$</span> urbicon find "pricing table"</p>
            <p class="opacity-85">→ Table + Badge + Button · recipe: pricing-grid</p>
            <p class="mt-3"><span class="opacity-50">$</span> curl ui.urbicon.de/llms.txt</p>
            <p class="opacity-85">→ {counts.set} components, plain text, no auth</p>
          </div>
          <p class="mt-4 text-[14.5px] opacity-70">
            Agents read the same manual you do —
            <a href={asset('/llms.txt')} class="underline hover:opacity-70">llms.txt</a>,
            <a href={asset('/llms-full.txt')} class="underline hover:opacity-70">llms-full.txt</a>,
            <a href={resolve('/ai')} class="underline hover:opacity-70">.cursorrules</a>.
          </p>
        </div>
      </div>
    </section>

    <!-- ─────────────────────────── Install ───────────────────────── -->
    <section
      class="rooms-field room-accent px-[var(--rooms-gutter)] pt-24 pb-10"
      style="background: {install.bg}; color: {install.fg}; --room-accent: {install.fg}; --room-accent-fg: {install.bg}"
    >
      <div class="text-center">
        <h2 class="text-[clamp(3rem,8vw,6rem)] !leading-none">One package.</h2>
        <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a href={resolve('/getting-started')}>
            <Button intent="primary" size="lg" class="!h-[54px] !px-8 !text-[17px]"
              >Get the set</Button
            >
          </a>
          <div
            class="flex items-center gap-3 border-[1.5px] border-current px-5 py-3.5 font-mono text-[14px]"
          >
            <code>{INSTALL_COMMAND}</code>
            <button
              type="button"
              onclick={copyInstall}
              aria-label={copied ? 'Copied' : 'Copy install command'}
              class="transition-opacity hover:opacity-70"
            >
              {#if copied}
                <CheckIcon class="h-4 w-4" />
              {:else}
                <CopyIcon class="h-4 w-4" />
              {/if}
            </button>
          </div>
        </div>
        <p class="mt-6 text-[14px] opacity-80">No subscription · no telemetry · no dependencies</p>
      </div>

      <footer
        class="on-field mt-24 flex flex-col gap-4 text-[13px] opacity-80 sm:flex-row sm:items-center sm:justify-between"
      >
        <nav aria-label="Footer" class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <a href={REPO_URL} target="_blank" rel="noopener" class="hover:opacity-70">Codeberg</a>·
          <a href={resolve('/changelog')} class="hover:opacity-70">Changelog</a>·
          <a href={asset('/llms.txt')} class="hover:opacity-70">llms.txt</a>·
          <a href={resolve('/imprint')} class="hover:opacity-70">Imprint</a>·
          <a href={resolve('/privacy')} class="hover:opacity-70">Privacy</a>
        </nav>
        <div class="flex items-center gap-4">
          <span>© {footerYear} Urbicon · MIT · v{__APP_VERSION__}</span>
          <LocaleSwitcher variant="ghost" size="sm" onLocaleChange={persistLocale} />
        </div>
      </footer>
    </section>
  </main>
</div>

<style>
  /* Live-feed pulse (Table specimen) + terminal caret (AI specimen). Both
     honour reduced-motion. `currentColor`/`bg-primary` inherit the room accent. */
  .pulse-dot {
    animation: rooms-pulse 2s ease-in-out infinite;
  }
  .term-caret {
    animation: rooms-blink 1.1s step-end infinite;
  }
  @keyframes rooms-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.2;
    }
  }
  @keyframes rooms-blink {
    0%,
    49% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulse-dot,
    .term-caret {
      animation: none;
    }
  }
</style>
