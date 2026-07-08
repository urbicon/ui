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
    CopyIcon,
    DatePicker,
    Input,
    LocaleSwitcher,
    PasskeyIcon,
    SegmentGroup,
    SegmentItem,
    Slider,
    Sparkline,
    Spinner,
    Toggle
  } from '@urbicon-ui/blocks';
  import { Table, type Column } from '@urbicon-ui/table';
  import '$lib/style/rooms.css';

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
        { bg: '#7c1f2d', fg: CREAM },
        { bg: '#e3a31c', fg: INK }
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
  // "repaint the building" effect.
  const hero = $derived(fields[0]);
  const rooms = $derived([
    { key: 'blocks', field: fields[1], delay: '0.04s' },
    { key: 'table', field: fields[2], delay: '0.08s' },
    { key: 'auth', field: fields[3], delay: '0.12s' },
    { key: 'ai', field: fields[0], delay: '0.16s' }
  ] as const);
  const install = $derived(fields[2]);

  // ── Blocks specimen: a real mini settings panel ───────────────────
  let section = $state('general');
  let workspace = $state('Atelier Nord');
  let uiLocale = $state<'en' | 'de'>('en');
  const dpLocale = $derived(uiLocale === 'de' ? 'de-DE' : 'en-US');
  // Fixed literal — deterministic across SSR/hydration (no `new Date()` drift).
  let renewal = $state<Date>(new Date('2026-10-01T00:00:00'));
  let compact = $state(true);
  let reduceMotion = $state(false);
  let density = $state(64);
  let autosave = $state(true);
  let telemetry = $state(false);
  const usage = [4, 6, 5, 9, 7, 12, 10, 15, 13, 18];

  function persistLocale(locale: string) {
    uiLocale = locale === 'de' ? 'de' : 'en';
    try {
      localStorage.setItem('urbicon-locale', locale);
    } catch {
      /* SSR / private mode — non-fatal */
    }
  }

  // ── Table specimen: a real @urbicon-ui/table in live remote mode ──
  interface EdgeRow {
    id: string;
    region: string;
    status: 'live' | 'warm';
    p95: number;
  }
  const BASE_ROWS: EdgeRow[] = [
    { id: 'eu-central', region: 'eu-central', status: 'live', p95: 42 },
    { id: 'us-east', region: 'us-east', status: 'live', p95: 87 },
    { id: 'ap-south', region: 'ap-south', status: 'warm', p95: 118 },
    { id: 'edge-local', region: 'edge · local', status: 'live', p95: 3 }
  ];
  const tableColumns: Column<EdgeRow>[] = [
    { accessor: 'region', title: 'Region', sortable: true },
    { accessor: 'status', title: 'Status', sortable: true },
    { accessor: 'p95', title: 'p95', sortable: true, dataType: 'number', align: 'right' }
  ];
  // Deterministic jitter (no Math.random) so latency values "breathe" like a
  // live feed without an SSR/hydration mismatch.
  let tick = $state(0);
  const jitter = (base: number, i: number) => Math.max(1, base + ((tick * 7 + i * 13) % 11) - 5);
  const tableRows = $derived(BASE_ROWS.map((r, i) => ({ ...r, p95: jitter(r.p95, i) })));

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
      class="rooms-field flex min-h-[80vh] flex-col justify-between px-6 pt-7 pb-10 sm:px-12"
      style="background: {hero.bg}; color: {hero.fg}"
    >
      <div class="flex items-center justify-between gap-4">
        <span class="text-[17px] font-bold tracking-[-0.01em]">Urbicon UI</span>
        <nav
          aria-label="Landing"
          class="flex items-center gap-5 text-[14.5px] font-medium sm:gap-8"
        >
          <a href="#set" class="hidden transition-opacity hover:opacity-70 sm:inline">The set</a>
          <a href="#repaint" class="hidden transition-opacity hover:opacity-70 sm:inline">Palette</a
          >
          <a href={resolve('/ai')} class="hidden transition-opacity hover:opacity-70 sm:inline"
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

      <h1
        class={[
          'max-w-[900px] text-[clamp(3rem,9vw,6.25rem)] transition-[transform,opacity] duration-700',
          ready ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        ]}
      >
        Depends on nothing.
      </h1>

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
              >1,203</span
            >
            <span class="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em]">1</span>
          </div>
          <p class="mt-2 max-w-[280px] text-[12.5px] opacity-80">
            packages in a typical UI stack — vs. this one. 53 components · Svelte 5.
          </p>
        </div>

        <div>
          {@render paletteSwitcher(false, true)}
          <p class="mt-2 text-[12.5px] opacity-80">{active.label} — repaint the whole page</p>
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
      {#each rooms as room (room.key)}
        <div
          class="rooms-field flex min-h-[560px] flex-col px-6 py-10 sm:px-12"
          style="background: {room.field.bg}; color: {room.field.fg}; --room-delay: {room.delay}"
        >
          {#if room.key === 'blocks'}
            <!-- Blocks — a real mini settings panel -->
            <div class="flex items-baseline justify-between gap-5">
              <h3 class="text-[clamp(2rem,4vw,2.5rem)]">Blocks</h3>
              <span class="text-[13.5px] opacity-80">35 primitives + 18 composed</span>
            </div>
            <p class="mt-2.5 max-w-[420px] text-[15.5px] leading-relaxed opacity-90">
              Forms, overlays, navigation, charts — themable down to the slot.
            </p>

            <div class="my-7 flex-1">
              <div
                class="poster-card room-accent max-w-[540px] p-5"
                style="--room-accent: {room.field.bg}; --room-accent-fg: {room.field.fg}"
              >
                <div class="flex items-center justify-between gap-4">
                  <span class="text-[13px] font-bold text-text-primary">Preferences</span>
                  <SegmentGroup bind:value={section} size="sm" ariaLabel="Settings section">
                    <SegmentItem value="general">General</SegmentItem>
                    <SegmentItem value="display">Display</SegmentItem>
                    <SegmentItem value="sync">Sync</SegmentItem>
                  </SegmentGroup>
                </div>

                <div class="mt-4 grid gap-4 sm:grid-cols-2">
                  {#if section === 'general'}
                    <Input bind:value={workspace} label="Workspace" size="sm" />
                    <div class="flex flex-col gap-1.5">
                      <span class="text-[12px] font-semibold text-text-secondary">Language</span>
                      <LocaleSwitcher
                        size="sm"
                        showFlag
                        variant="outlined"
                        onLocaleChange={persistLocale}
                      />
                    </div>
                    <div class="sm:col-span-2">
                      <DatePicker
                        bind:value={renewal}
                        label="Renewal date"
                        locale={dpLocale}
                        size="sm"
                        clearable={false}
                      />
                    </div>
                  {:else if section === 'display'}
                    <div class="sm:col-span-2 flex flex-col gap-3">
                      <Toggle bind:checked={compact} label="Compact density" />
                      <Toggle bind:checked={reduceMotion} label="Reduce motion" />
                    </div>
                    <div class="sm:col-span-2">
                      <Slider
                        bind:value={density}
                        min={0}
                        max={100}
                        label="Grid density"
                        showValue
                        formatValue={(v) => `${v}%`}
                      />
                    </div>
                  {:else}
                    <div class="flex flex-col gap-3">
                      <Toggle bind:checked={autosave} label="Autosave" />
                      <Toggle bind:checked={telemetry} label="Telemetry" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <span class="text-[12px] font-semibold text-text-secondary">Usage</span>
                      <Sparkline
                        data={usage}
                        area
                        showEndPoint
                        width={200}
                        height={44}
                        ariaLabel="Usage trend, last 10 days"
                        class="w-full"
                      />
                    </div>
                  {/if}
                </div>

                <div class="mt-5 flex justify-end gap-2.5">
                  <Button variant="outlined" size="sm">Reset</Button>
                  <Button intent="primary" size="sm">Save changes</Button>
                </div>
              </div>
            </div>

            <div class="mt-auto flex items-baseline justify-between gap-5">
              <span class="text-[13px] opacity-75"
                >SegmentGroup · Input · Select · Switch · Chart</span
              >
              <a
                href={resolve('/blocks')}
                class="border-b-2 border-current pb-0.5 text-[15px] font-bold transition-opacity hover:opacity-70"
                >Browse →</a
              >
            </div>
          {:else if room.key === 'table'}
            <!-- Table — a real @urbicon-ui/table -->
            <div class="flex items-baseline justify-between gap-5">
              <h3 class="text-[clamp(2rem,4vw,2.5rem)]">Table</h3>
              <span class="text-[13.5px] opacity-80">Live remote mode</span>
            </div>
            <p class="mt-2.5 max-w-[420px] text-[15.5px] leading-relaxed opacity-90">
              Sorting, grouping, selection, virtualization — and live updates over the wire.
            </p>

            <div class="my-7 flex-1">
              <div
                class="poster-card room-accent max-w-[540px] p-4"
                style="--room-accent: {room.field.bg}; --room-accent-fg: {room.field.fg}"
              >
                <div
                  class="mb-2 flex items-center justify-between px-1 font-mono text-[11px] tracking-[0.04em] text-text-secondary"
                >
                  <span>edge.latency — {tableRows.length} rows</span>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary"></span>
                    live
                  </span>
                </div>
                <Table
                  items={tableRows}
                  columns={tableColumns}
                  selectionMode="single"
                  enableSmartFilter={false}
                  itemsPerPage={4}
                />
              </div>
            </div>

            <div class="mt-auto flex items-baseline justify-between gap-5">
              <span class="text-[13px] opacity-75">Click a header to sort, a row to select</span>
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
              <div
                class="poster-card room-accent w-[340px] max-w-full p-6"
                style="--room-accent: {room.field.bg}; --room-accent-fg: {room.field.fg}"
              >
                <div class="flex items-center gap-3">
                  <Avatar name="Nora Ackermann" size="sm" />
                  <div>
                    <p class="text-[15px] font-bold text-text-primary">Sign in to Atelier Nord</p>
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
                    <a href={resolve('/auth')} class="text-[12.5px] text-text-secondary underline"
                      >or email a magic link</a
                    >
                  {/if}
                  <Badge intent="neutral" variant="outlined" class="font-mono text-[10px]"
                    >WebAuthn</Badge
                  >
                </div>
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
            <!-- AI & DX — an agent terminal -->
            <div class="flex items-baseline justify-between gap-5">
              <h3 class="text-[clamp(2rem,4vw,2.5rem)]">AI &amp; DX</h3>
              <span class="text-[13.5px] opacity-80">MCP + llms.txt</span>
            </div>
            <p class="mt-2.5 max-w-[420px] text-[15.5px] leading-relaxed opacity-90">
              An MCP server with design intelligence, plus llms.txt for every component.
            </p>

            <div class="my-7 flex-1">
              <div
                class="poster-term room-accent max-w-[540px] p-5 font-mono text-[12.5px] leading-[1.9]"
                style="--room-accent: {room.field.bg}; --room-accent-fg: {room.field.fg}"
              >
                <p class="opacity-55"># agent session — via MCP, 9 tools</p>
                <p>
                  <span class="opacity-55">&gt;</span> build a pricing section<span
                    class="term-caret ml-1 inline-block h-3 w-[7px] translate-y-[2px] bg-primary"
                  ></span>
                </p>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outlined" class="font-mono text-[11px]">Table</Badge>
                  <Badge variant="outlined" class="font-mono text-[11px]">Badge</Badge>
                  <Badge variant="outlined" class="font-mono text-[11px]">Button</Badge>
                  <span class="text-[11.5px] opacity-80">→ recipe: pricing-grid</span>
                </div>
                <p class="mt-3 opacity-85">
                  $ curl ui.urbicon.de/llms.txt <span class="opacity-55"
                    >— 53 components, no auth</span
                  >
                </p>
              </div>
            </div>

            <div class="mt-auto flex items-baseline justify-between gap-5">
              <span class="text-[13px] opacity-75">Agents read the same manual you do</span>
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

    <!-- ──────────────────── Repaint the building ─────────────────── -->
    <section id="repaint" class="px-6 py-20 sm:px-12" style="background: #17150f; color: #f6f3ec">
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
            <p><span class="opacity-50">$</span> claude mcp add urbicon</p>
            <p style="color: {active.bright}; transition: color 0.5s ease">
              ✓ connected — 9 tools, design intelligence included
            </p>
            <p class="mt-3"><span class="opacity-50">&gt;</span> find_components "pricing table"</p>
            <p class="opacity-85">→ Table + Badge + Button · recipe: pricing-grid</p>
            <p class="mt-3"><span class="opacity-50">$</span> curl ui.urbicon.de/llms.txt</p>
            <p class="opacity-85">→ 53 components, plain text, no auth</p>
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
      class="rooms-field room-accent px-6 pt-24 pb-10 sm:px-12"
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
