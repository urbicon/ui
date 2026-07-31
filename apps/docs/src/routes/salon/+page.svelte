<script lang="ts">
  import { BlocksProvider } from '@urbicon-ui/blocks';
  import { DEFAULT_LIVERY, LIVERIES, liveryById } from '$lib/livery';
  // Livery-CSS route-lokal statt global (anders als in chat-demo): Tokens,
  // Container-Shim und die Layout-Schicht der Vollseite.
  import '$lib/livery/liveries.css';
  import '$lib/livery/livery-shim.gen.css';
  import '$lib/livery/layouts.css';
  import SalonBooking from '$lib/salon/SalonBooking.svelte';
  import { SALON_NAME, SERVICES, STYLISTS } from '$lib/salon-tools';

  /**
   * One salon, four houses.
   *
   * Colour, edge, type and ground come from the active livery's design tokens;
   * where things sit comes from its `layout`. Both reach the page. Only the
   * first reaches the booking form the agent generates further down — and that
   * is the interesting part, not a shortcoming to hide: the agent emits
   * component *names*, so the library can re-skin its output, but nobody can
   * re-compose it from the outside.
   *
   * Nothing in this file styles that form. Nothing in the recorded payload
   * does either.
   */

  let liveryId = $state(DEFAULT_LIVERY.id);
  const livery = $derived(liveryById(liveryId));

  let booking: ReturnType<typeof SalonBooking> | undefined = $state();

  // On the full page the livery hangs off the document root, so it also reaches
  // the parts a container cannot own: the scrollbar, form-control defaults and
  // the overscroll area all follow `color-scheme` on <html>.
  //
  // `data-livery-scope="page"` is what anchors the ground to the viewport
  // instead of to a container — the same stylesheet drives the tile version,
  // where the ground fills the tile and nothing else. See liveries.css.
  $effect(() => {
    const root = document.documentElement;
    root.dataset.livery = livery.id;
    root.dataset.liveryScope = 'page';
    return () => {
      delete root.dataset.livery;
      delete root.dataset.liveryScope;
    };
  });

  const HOURS = [
    { day: 'Tue – Fri', time: '10 — 20' },
    { day: 'Saturday', time: '09 — 18' },
    { day: 'Sun / Mon', time: 'Closed' }
  ];

  const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const workdaysOf = (days: number[]) => days.map((d) => WEEKDAY_NAMES[d - 1]).join(' · ');

  // In the scatter house the wordmark is a rule of letters across the full
  // measure rather than a word; every other house renders it whole.
  const letters = SALON_NAME.replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .split('');
</script>

<svelte:head>
  <title>{SALON_NAME} — Bleecker Street</title>
</svelte:head>

<BlocksProvider defaults={livery.defaults}>
  <div data-layout={livery.layout} class="min-h-dvh pb-28">
    <!-- ── Masthead ─────────────────────────────────────────────────────── -->
    <header class="sticky top-0 z-[var(--z-sticky)] bg-surface-base/80 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-baseline justify-between px-6 py-4">
        <span class="livery-display text-base">{SALON_NAME}</span>
        <nav class="flex gap-6 text-2xs uppercase tracking-[0.2em] text-text-secondary">
          <a class="hover:text-text-primary" href="#services">Services</a>
          <a class="hover:text-text-primary" href="#room">The Room</a>
          <a class="hover:text-text-primary" href="#booking">Book</a>
        </nav>
      </div>
    </header>

    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <section data-salon="hero" class="mx-auto max-w-6xl px-6">
      <p data-salon="kicker" class="text-2xs uppercase tracking-[0.32em] text-text-tertiary">
        233 Bleecker Street · New York
      </p>

      <h1 data-salon="wordmark" class="livery-display text-text-primary">
        {#if livery.layout === 'scatter'}
          {#each letters as letter, i (`${letter}-${i}`)}
            <span>{letter}</span>
          {/each}
        {:else}
          {SALON_NAME}
        {/if}
      </h1>

      <p data-salon="lede" class="text-base leading-relaxed text-text-secondary">
        Six chairs, three cutters, no music you'd recognise. Booking runs about five months out —
        the assistant finds what's actually free.
      </p>

      <a
        data-salon="cta"
        href="#booking"
        class="inline-block border-b border-current pb-1 text-2xs uppercase tracking-[0.22em] text-text-primary hover:text-text-secondary"
      >
        Find a chair ↓
      </a>
    </section>

    <!-- ── Services ─────────────────────────────────────────────────────── -->
    <section data-salon="section" id="services" class="border-t border-border-subtle">
      <div data-salon="section-body" class="mx-auto max-w-6xl px-6 py-20">
        <h2 data-salon="section-head" class="livery-display mb-12 text-2xl">Services</h2>
        <ul data-salon="list" class="flex flex-col">
          {#each SERVICES as service (service.id)}
            <li
              class="flex items-baseline justify-between gap-6 border-b border-border-subtle py-5"
            >
              <span class="text-base">{service.label}</span>
              <span class="flex shrink-0 items-baseline gap-6">
                <span class="text-2xs uppercase tracking-[0.18em] text-text-tertiary">
                  {service.minutes} min
                </span>
                <span class="livery-display text-base text-text-primary">{service.price}</span>
              </span>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <!-- ── The room ─────────────────────────────────────────────────────── -->
    <section data-salon="section" id="room" class="border-t border-border-subtle">
      <div data-salon="section-body" class="mx-auto max-w-6xl px-6 py-20">
        <div class="grid gap-16 sm:grid-cols-2">
          <div>
            <h2 data-salon="section-head" class="livery-display mb-10 text-2xl">The room</h2>
            <ul data-salon="list" class="flex flex-col gap-6">
              {#each STYLISTS as stylist (stylist.id)}
                <li class="flex items-baseline justify-between gap-4">
                  <span class="livery-display text-xl">{stylist.name}</span>
                  <span class="text-2xs uppercase tracking-[0.18em] text-text-tertiary">
                    {workdaysOf(stylist.workdays)}
                  </span>
                </li>
              {/each}
            </ul>
          </div>
          <div>
            <h2 data-salon="section-head" class="livery-display mb-10 text-2xl">Hours</h2>
            <ul data-salon="list" class="flex flex-col gap-6">
              {#each HOURS as entry (entry.day)}
                <li class="flex items-baseline justify-between gap-4">
                  <span class="text-2xs uppercase tracking-[0.18em] text-text-tertiary">
                    {entry.day}
                  </span>
                  <span class="livery-display text-lg text-text-primary">{entry.time}</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Booking — the agent surface lives INSIDE the page ─────────────── -->
    <section id="booking" class="border-t border-border-subtle">
      <div class="mx-auto max-w-3xl px-6 py-20">
        <h2 class="livery-display mb-4 text-2xl">Book a chair</h2>
        <p class="mb-10 max-w-lg text-sm text-text-secondary">
          Tell the assistant what you want. It builds whatever form the answer needs — and the form
          belongs to this house, not to the model.
        </p>

        <div class="flex min-h-[36rem] flex-col rounded-contain border border-border-default">
          <div
            class="flex items-center justify-between border-b border-border-subtle px-4 py-3 text-2xs uppercase tracking-[0.2em] text-text-secondary"
          >
            <span>Front desk</span>
            <button
              type="button"
              class="cursor-pointer tracking-[0.2em] hover:text-text-primary"
              onclick={() => booking?.reset()}
            >
              Reset
            </button>
          </div>
          <SalonBooking bind:this={booking} />
        </div>

        <button
          type="button"
          class="mt-4 cursor-pointer text-2xs uppercase tracking-[0.2em] text-text-tertiary underline underline-offset-4 hover:text-text-primary"
          onclick={() => booking?.start()}
        >
          Play the recorded conversation
        </button>
      </div>
    </section>

    <footer class="border-t border-border-subtle">
      <div
        class="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-4 px-6 py-10 text-2xs uppercase tracking-[0.2em] text-text-tertiary"
      >
        <!-- Der eine Gruppen-Marker der Vollseite: die Seite selbst IST das
             Stammhaus (Kicker: 233 Bleecker St), die Landing erzählt die
             Gruppe — der Footer schlägt die Brücke, mehr nicht. -->
        <span>{SALON_NAME} · New York · London · Paris · Vienna</span>
        <span>Built with @urbicon-ui/blocks</span>
      </div>
    </footer>
  </div>

  <!-- ── The switch ───────────────────────────────────────────────────────
       Deliberately outside the page's own visual language: this is the demo
       apparatus, not part of the salon. -->
  <div
    class="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-border-default bg-surface-elevated"
  >
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
      <div class="flex min-w-0 shrink-0 flex-col">
        <span class="text-2xs uppercase tracking-[0.2em] text-text-secondary">Livery</span>
        <span class="truncate text-2xs text-text-tertiary">{livery.tagline}</span>
      </div>
      <div class="flex flex-wrap gap-2" role="group" aria-label="Livery">
        {#each LIVERIES as option (option.id)}
          <button
            type="button"
            class={[
              'cursor-pointer rounded-modify border px-3 py-1.5 text-2xs uppercase tracking-[0.16em]',
              option.id === liveryId
                ? 'border-primary bg-primary text-text-on-primary'
                : 'border-border-default text-text-secondary hover:text-text-primary'
            ]}
            aria-pressed={option.id === liveryId}
            onclick={() => (liveryId = option.id)}
          >
            {option.name}
          </button>
        {/each}
      </div>
      <p class="ml-auto hidden max-w-sm text-right text-2xs text-text-tertiary lg:block">
        {livery.mechanism}
      </p>
    </div>
  </div>
</BlocksProvider>
