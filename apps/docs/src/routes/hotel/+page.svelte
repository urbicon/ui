<script lang="ts">
  import { BlocksProvider, Button } from '@urbicon-ui/blocks';
  import { DEFAULT_LIVERY, LIVERIES, liveryById } from '$lib/livery';
  // Livery-CSS route-lokal statt global (anders als in chat-demo): Tokens,
  // Container-Shim und die Layout-Schicht der Vollseite.
  import '$lib/livery/liveries.css';
  import '$lib/livery/livery-shim.gen.css';
  import '$lib/livery/layouts.css';
  import HotelBooking from '$lib/hotel/HotelBooking.svelte';
  import { GROUP_NAME, HOUSES, houseById, ROOM_TYPES } from '$lib/hotel-tools';

  /**
   * One group, four houses — and here, unlike in the salon era, the switch
   * changes the HOUSE, not just the paint: Cala, Firn, Mori and Duna are the
   * sub-brands of Fermata (`$lib/hotel-tools`), which is the real shape of
   * the livery pattern in the wild. Kicker, lede, facts and hosts follow the
   * switch because livery ids ARE house ids; rooms and rates stay still
   * because the group prices per type, not per house.
   *
   * Colour, edge, type and ground come from the active livery's design tokens;
   * where things sit comes from its `layout`. Both reach the page. Only the
   * first reaches the booking form the agent generates further down — and that
   * is the interesting part, not a shortcoming to hide: the agent emits
   * component *names*, so the library can re-skin its output, but nobody can
   * re-compose it from the outside.
   *
   * The recorded conversation is ONE conversation with the group's front desk
   * (it asks for "quiet nights by the sea" and books Cala), whichever house
   * the visitor is looking at — a group desk recommends a house, it does not
   * re-book per skin. Nothing in this file styles that form. Nothing in the
   * recorded payload does either.
   */

  let liveryId = $state(DEFAULT_LIVERY.id);
  const livery = $derived(liveryById(liveryId));
  // Livery ids are house ids — the join the head comment promises.
  const house = $derived(houseById(livery.id) ?? HOUSES[0]);

  /**
   * One AI-generated architecture shot per house (static/hotel/*.avif).
   * Presentation only, so it lives here and not in the hotel-tools register:
   * the register is what the model's tool calls return, and an image path has
   * no business in a tool payload. Mori deliberately brings none — the Kyoto
   * shots never reached the bar the other three set, and three strong images
   * beat a fourth that dilutes; the figure block simply collapses for a house
   * without one. How each image sits (arch, keepsake, panorama) is the
   * house's layout idiom in layouts.css, not styling here.
   */
  const HOUSE_IMAGES: Record<'cala' | 'firn' | 'duna', { src: string; alt: string }> = {
    cala: {
      src: '/hotel/cala.avif',
      alt: 'Whitewashed courtyard at Cala — an arched opening onto the sea, sage-green chairs in the shade, bougainvillea along the top of the wall.'
    },
    firn: {
      src: '/hotel/firn.avif',
      alt: 'A guest room at Firn — dry-stone and pale timber, a window bench framing the snowed-in valley outside.'
    },
    duna: {
      src: '/hotel/duna.avif',
      alt: 'The house at Duna — sand-toned plaster and a thatched roofline over the terrace, evening light on the beach behind.'
    }
  };
  const houseImage = $derived(
    Object.hasOwn(HOUSE_IMAGES, house.id)
      ? HOUSE_IMAGES[house.id as keyof typeof HOUSE_IMAGES]
      : undefined
  );

  let booking: ReturnType<typeof HotelBooking> | undefined = $state();

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

  /**
   * The group's day, one rhythm for all four houses — a hotel that sells
   * quiet publishes a day, not an amenity list.
   */
  const DAY = [
    { time: '06 — 08', item: 'First light. The bath house opens' },
    { time: 'till 12', item: 'Breakfast, unhurried' },
    { time: '14 — 17', item: 'Quiet hours' },
    { time: '20:00', item: 'One table, one sitting' }
  ];

  // In the scatter house the wordmark is a rule of letters across the full
  // measure rather than a word; every other house renders it whole.
  const letters = $derived(
    house.name
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .split('')
  );
</script>

<!-- Not `SeoMeta`: it appends " – Urbicon UI" to every title, and this page is
     a fiction — the hotel group the landing and the getting-started guide build
     their examples around. The suffix would break it. The description says what
     the page actually is, which the title deliberately does not. -->
<svelte:head>
  <title>{GROUP_NAME} — four quiet houses</title>
  <meta
    name="description"
    content="A fictional hotel group built entirely from Urbicon UI — the livery demo behind the examples on the landing page and in the getting-started guide."
  />
  <!-- ~60 KB each: fetching the other houses' shots up front keeps the house
       switch a cut, not a cut followed by an image popping in. -->
  {#each Object.values(HOUSE_IMAGES) as image (image.src)}
    <link rel="prefetch" as="image" href={image.src} />
  {/each}
</svelte:head>

<BlocksProvider defaults={livery.defaults}>
  <div data-layout={livery.layout} class="min-h-dvh pb-28">
    <!-- ── Masthead ─────────────────────────────────────────────────────── -->
    <header class="bg-surface-base/80 sticky top-0 z-[var(--z-sticky)] backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-baseline justify-between px-6 py-4">
        <span class="livery-display text-base">{GROUP_NAME}</span>
        <nav
          aria-label="Hotel"
          class="text-2xs text-text-secondary flex gap-6 tracking-[0.2em] uppercase"
        >
          <a class="hover:text-text-primary" href="#rooms">Rooms</a>
          <a class="hover:text-text-primary" href="#day">The day</a>
          <a class="hover:text-text-primary" href="#booking">Book</a>
        </nav>
      </div>
    </header>

    <!-- ── Hero — the active house introduces itself ────────────────────── -->
    <section data-house="hero" aria-label={house.name} class="mx-auto max-w-6xl px-6">
      <p data-house="kicker" class="text-2xs text-text-tertiary tracking-[0.32em] uppercase">
        {GROUP_NAME} · {house.place}
      </p>

      <h1 data-house="wordmark" class="livery-display text-text-primary">
        {#if livery.layout === 'scatter'}
          {#each letters as letter, i (`${letter}-${i}`)}
            <span>{letter}</span>
          {/each}
        {:else}
          {house.name}
        {/if}
      </h1>

      <p data-house="lede" class="text-text-secondary text-base leading-relaxed">
        {house.line}
      </p>

      <a
        data-house="cta"
        href="#booking"
        class="text-2xs text-text-primary hover:text-text-secondary inline-block border-b border-current pb-1 tracking-[0.22em] uppercase"
      >
        Find a room ↓
      </a>
    </section>

    <!-- ── The house, seen — one shot per house, framed by its layout idiom ──
         The hero stays type only (it IS the livery thesis); the image is the
         second act. Cala crops to its arch, Firn hangs a keepsake, Duna runs
         a panorama on the horizon. Mori has no image and no placeholder. -->
    {#if houseImage}
      <figure data-house="figure" class="mx-auto max-w-6xl px-6">
        <img
          src={houseImage.src}
          alt={houseImage.alt}
          width="1280"
          height="960"
          loading="lazy"
          decoding="async"
        />
      </figure>
    {/if}

    <!-- ── Rooms — the group's one price sheet ──────────────────────────── -->
    <section
      data-house="section"
      id="rooms"
      aria-labelledby="rooms-title"
      class="border-border-subtle border-t"
    >
      <div data-house="section-body" class="mx-auto max-w-6xl px-6 py-20">
        <h2 id="rooms-title" data-house="section-head" class="livery-display mb-12 text-2xl">
          Rooms
        </h2>
        <ul data-house="list" class="flex flex-col">
          {#each ROOM_TYPES as room (room.id)}
            <li
              class="border-border-subtle flex items-baseline justify-between gap-6 border-b py-5"
            >
              <span class="text-base">{room.label}</span>
              <span class="flex shrink-0 items-baseline gap-6">
                <span class="text-2xs text-text-tertiary tracking-[0.18em] uppercase">
                  {room.line}
                </span>
                <span class="livery-display text-text-primary text-base">€{room.price}</span>
              </span>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <!-- ── The day / the house ──────────────────────────────────────────── -->
    <section
      data-house="section"
      id="day"
      aria-labelledby="day-title"
      class="border-border-subtle border-t"
    >
      <div data-house="section-body" class="mx-auto max-w-6xl px-6 py-20">
        <div class="grid gap-16 sm:grid-cols-2">
          <div>
            <h2 id="day-title" data-house="section-head" class="livery-display mb-10 text-2xl">
              The day
            </h2>
            <ul data-house="list" class="flex flex-col gap-6">
              {#each DAY as entry (entry.time)}
                <li class="flex items-baseline justify-between gap-4">
                  <span class="text-2xs text-text-tertiary tracking-[0.18em] uppercase">
                    {entry.time}
                  </span>
                  <span class="livery-display text-text-primary text-lg">{entry.item}</span>
                </li>
              {/each}
            </ul>
          </div>
          <div>
            <h2 data-house="section-head" class="livery-display mb-10 text-2xl">The house</h2>
            <ul data-house="list" class="flex flex-col gap-6">
              {#each house.facts as fact (fact)}
                <li class="text-2xs text-text-tertiary tracking-[0.18em] uppercase">{fact}</li>
              {/each}
              {#each house.hosts as host (host.name)}
                <li class="flex items-baseline justify-between gap-4">
                  <span class="livery-display text-xl">{host.name}</span>
                  <span class="text-2xs text-text-tertiary tracking-[0.18em] uppercase">
                    {host.status === 'busy' ? 'With guests' : 'At the desk'}
                  </span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Booking — the agent surface lives INSIDE the page ─────────────── -->
    <section id="booking" aria-labelledby="booking-title" class="border-border-subtle border-t">
      <div class="mx-auto max-w-3xl px-6 py-20">
        <h2 id="booking-title" class="livery-display mb-4 text-2xl">Book a stay</h2>
        <p class="text-text-secondary mb-6 max-w-lg text-sm">
          Tell the front desk what you need. It builds whatever form the answer takes — and the form
          belongs to this house, not to the model.
        </p>

        <!-- The one primary act on the page, ABOVE the desk: an empty chat
             with a faint underlined link below it hid the whole demo
             (review finding 2026-08-10). The desk plays a recording, so the
             button says so — and the composer stays for anyone who would
             rather type. -->
        <div class="mb-4 flex flex-wrap items-center gap-4">
          <Button intent="primary" onclick={() => booking?.start()}>
            ▶ Play the recorded conversation
          </Button>
          <span class="text-2xs text-text-tertiary tracking-[0.14em] uppercase">
            A real exchange, replayed — no key, no network
          </span>
        </div>

        <div class="rounded-contain border-border-default flex min-h-[36rem] flex-col border">
          <div
            class="border-border-subtle text-2xs text-text-secondary flex items-center justify-between border-b px-4 py-3 tracking-[0.2em] uppercase"
          >
            <span>Front desk</span>
            <button
              type="button"
              class="hover:text-text-primary cursor-pointer tracking-[0.2em]"
              onclick={() => booking?.reset()}
            >
              Reset
            </button>
          </div>
          <HotelBooking bind:this={booking} />
        </div>
      </div>
    </section>

    <footer class="border-border-subtle border-t">
      <div
        class="text-2xs text-text-tertiary mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-4 px-6 py-10 tracking-[0.2em] uppercase"
      >
        <span>{GROUP_NAME} · {HOUSES.map((h) => h.name).join(' · ')}</span>
        <span>Built with @urbicon-ui/blocks</span>
      </div>
      <!-- The fiction, said plainly: this page wears no docs chrome, so
           without this line nothing on it says demo — and the legal doors
           every other page carries would be unreachable from here. -->
      <div
        class="text-2xs text-text-tertiary mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-6 pb-8"
      >
        <span class="max-w-xl">
          Fermata and its houses are a fiction — the component-library demo behind
          <a class="hover:text-text-primary underline underline-offset-2" href="/">urbicon ui</a>.
          Nothing here is a real hotel, a real offer or a real price; the imagery is AI-generated.
        </span>
        <span class="flex gap-4">
          <a class="hover:text-text-primary" href="/imprint">Imprint</a>
          <a class="hover:text-text-primary" href="/privacy">Privacy</a>
        </span>
      </div>
    </footer>
  </div>

  <!-- ── The switch ───────────────────────────────────────────────────────
       Deliberately outside the page's own visual language: this is the demo
       apparatus, not part of the hotel. -->
  <div
    class="border-border-default bg-surface-elevated fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t"
  >
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
      <div class="flex min-w-0 shrink-0 flex-col">
        <span class="text-2xs text-text-secondary tracking-[0.2em] uppercase">House</span>
        <span class="text-2xs text-text-tertiary truncate">{livery.tagline}</span>
      </div>
      <div class="flex flex-wrap gap-2" role="group" aria-label="House">
        {#each LIVERIES as option (option.id)}
          <button
            type="button"
            class={[
              'rounded-modify text-2xs cursor-pointer border px-3 py-1.5 tracking-[0.16em] uppercase',
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
      <p class="text-2xs text-text-tertiary ml-auto hidden max-w-sm text-right lg:block">
        {livery.mechanism}
      </p>
    </div>
  </div>
</BlocksProvider>
