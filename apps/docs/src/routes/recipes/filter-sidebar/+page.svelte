<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import {
    Sidebar,
    Input,
    RadioGroup,
    RadioItem,
    SegmentGroup,
    SegmentItem,
    Slider,
    Checkbox,
    Card,
    Badge,
    Button,
    FunnelIcon,
    SearchIcon,
    CloseIcon,
    BedIcon,
    MapPinIcon
  } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  type ListingType = 'apartment' | 'house' | 'studio';
  interface Listing {
    id: string;
    title: string;
    neighborhood: string;
    type: ListingType;
    rent: number;
    beds: number;
    amenities: string[];
  }

  const RENT_MIN = 400;
  const RENT_MAX = 3000;

  const AMENITIES = [
    { id: 'balcony', label: 'Balcony' },
    { id: 'parking', label: 'Parking' },
    { id: 'pets', label: 'Pets allowed' },
    { id: 'furnished', label: 'Furnished' }
  ];

  const TYPE_LABEL: Record<ListingType, string> = {
    apartment: 'Apartment',
    house: 'House',
    studio: 'Studio'
  };

  const listings: Listing[] = [
    {
      id: 'l1',
      title: 'Sunlit loft near the canal',
      neighborhood: 'Kreuzberg',
      type: 'apartment',
      rent: 1650,
      beds: 2,
      amenities: ['balcony', 'pets']
    },
    {
      id: 'l2',
      title: 'Studio above the bakery',
      neighborhood: 'Neukölln',
      type: 'studio',
      rent: 890,
      beds: 0,
      amenities: ['furnished']
    },
    {
      id: 'l3',
      title: 'Altbau with herringbone floors',
      neighborhood: 'Prenzlauer Berg',
      type: 'apartment',
      rent: 2200,
      beds: 3,
      amenities: ['balcony', 'parking']
    },
    {
      id: 'l4',
      title: 'Garden house on a quiet Hof',
      neighborhood: 'Pankow',
      type: 'house',
      rent: 2650,
      beds: 4,
      amenities: ['parking', 'pets', 'balcony']
    },
    {
      id: 'l5',
      title: 'Compact flat by the U-Bahn',
      neighborhood: 'Wedding',
      type: 'apartment',
      rent: 1180,
      beds: 1,
      amenities: ['furnished']
    },
    {
      id: 'l6',
      title: 'Furnished studio, all-inclusive',
      neighborhood: 'Mitte',
      type: 'studio',
      rent: 1350,
      beds: 0,
      amenities: ['furnished', 'balcony']
    },
    {
      id: 'l7',
      title: 'Family house with a yard',
      neighborhood: 'Köpenick',
      type: 'house',
      rent: 2400,
      beds: 4,
      amenities: ['parking', 'pets']
    },
    {
      id: 'l8',
      title: 'Bright two-room by the park',
      neighborhood: 'Friedrichshain',
      type: 'apartment',
      rent: 1490,
      beds: 2,
      amenities: ['balcony']
    },
    {
      id: 'l9',
      title: 'Top-floor flat with elevator',
      neighborhood: 'Charlottenburg',
      type: 'apartment',
      rent: 1780,
      beds: 2,
      amenities: ['parking', 'furnished']
    },
    {
      id: 'l10',
      title: 'Cozy pet-friendly single',
      neighborhood: 'Neukölln',
      type: 'apartment',
      rent: 990,
      beds: 1,
      amenities: ['pets']
    }
  ];

  // Filter state — each control binds to one field.
  let filtersOpen = $state(false); // mobile overlay only; desktop rail is always visible
  let search = $state('');
  let propertyType = $state('any'); // RadioGroup
  let rentRange = $state<[number, number]>([RENT_MIN, RENT_MAX]); // range Slider
  let bedrooms = $state('any'); // SegmentGroup — 'any' | '1' | '2' | '3' (3 = 3+)
  let amenities = $state<string[]>([]); // Checkbox group

  function toggleAmenity(id: string) {
    amenities = amenities.includes(id) ? amenities.filter((a) => a !== id) : [...amenities, id];
  }

  const activeCount = $derived(
    (search ? 1 : 0) +
      (propertyType !== 'any' ? 1 : 0) +
      (rentRange[0] > RENT_MIN || rentRange[1] < RENT_MAX ? 1 : 0) +
      (bedrooms !== 'any' ? 1 : 0) +
      amenities.length
  );

  // Live client-side filtering — recomputes on every control change, no Apply step.
  const results = $derived(
    listings.filter((l) => {
      if (search && !(l.title + ' ' + l.neighborhood).toLowerCase().includes(search.toLowerCase()))
        return false;
      if (propertyType !== 'any' && l.type !== propertyType) return false;
      if (l.rent < rentRange[0] || l.rent > rentRange[1]) return false;
      if (bedrooms !== 'any') {
        const n = Number(bedrooms);
        if (n === 3 ? l.beds < 3 : l.beds !== n) return false;
      }
      if (amenities.length && !amenities.every((a) => l.amenities.includes(a))) return false;
      return true;
    })
  );

  function reset() {
    search = '';
    propertyType = 'any';
    rentRange = [RENT_MIN, RENT_MAX];
    bedrooms = 'any';
    amenities = [];
  }

  function bedsLabel(beds: number): string {
    if (beds === 0) return 'Studio';
    return beds + ' bed' + (beds > 1 ? 's' : '');
  }

  function amenityLabel(id: string): string {
    return AMENITIES.find((a) => a.id === id)?.label ?? id;
  }

  const recipeCode = `<script lang="ts">
  import {
    Sidebar, Input, RadioGroup, RadioItem, SegmentGroup, SegmentItem,
    Slider, Checkbox, Card, Badge, Button,
    FunnelIcon, SearchIcon, CloseIcon, BedIcon, MapPinIcon
  } from '@urbicon-ui/blocks';

  type ListingType = 'apartment' | 'house' | 'studio';
  interface Listing {
    id: string; title: string; neighborhood: string;
    type: ListingType; rent: number; beds: number; amenities: string[];
  }

  const RENT_MIN = 400;
  const RENT_MAX = 3000;
  const AMENITIES = [
    { id: 'balcony', label: 'Balcony' },
    { id: 'parking', label: 'Parking' },
    { id: 'pets', label: 'Pets allowed' },
    { id: 'furnished', label: 'Furnished' }
  ];
  const TYPE_LABEL: Record<ListingType, string> = {
    apartment: 'Apartment', house: 'House', studio: 'Studio'
  };

  const listings: Listing[] = [/* … your data … */];

  // Filter state — each control binds to one field.
  let filtersOpen = $state(false);   // mobile overlay only; desktop rail is always visible
  let search = $state('');
  let propertyType = $state('any');  // RadioGroup
  let rentRange = $state<[number, number]>([RENT_MIN, RENT_MAX]); // range Slider
  let bedrooms = $state('any');      // SegmentGroup — 'any' | '1' | '2' | '3' (3 = 3+)
  let amenities = $state<string[]>([]); // Checkbox group

  function toggleAmenity(id: string) {
    amenities = amenities.includes(id) ? amenities.filter((a) => a !== id) : [...amenities, id];
  }

  const activeCount = $derived(
    (search ? 1 : 0) +
      (propertyType !== 'any' ? 1 : 0) +
      (rentRange[0] > RENT_MIN || rentRange[1] < RENT_MAX ? 1 : 0) +
      (bedrooms !== 'any' ? 1 : 0) +
      amenities.length
  );

  // Live client-side filtering — recomputes on every control change, no Apply step.
  const results = $derived(
    listings.filter((l) => {
      if (search && !(l.title + ' ' + l.neighborhood).toLowerCase().includes(search.toLowerCase())) return false;
      if (propertyType !== 'any' && l.type !== propertyType) return false;
      if (l.rent < rentRange[0] || l.rent > rentRange[1]) return false;
      if (bedrooms !== 'any') {
        const n = Number(bedrooms);
        if (n === 3 ? l.beds < 3 : l.beds !== n) return false;
      }
      if (amenities.length && !amenities.every((a) => l.amenities.includes(a))) return false;
      return true;
    })
  );

  function reset() {
    search = '';
    propertyType = 'any';
    rentRange = [RENT_MIN, RENT_MAX];
    bedrooms = 'any';
    amenities = [];
  }

  const bedsLabel = (beds: number) =>
    beds === 0 ? 'Studio' : beds + ' bed' + (beds > 1 ? 's' : '');
  const amenityLabel = (id: string) => AMENITIES.find((a) => a.id === id)?.label ?? id;
<\/script>

<!-- Page shell. On desktop (>=1024px) the Sidebar is a persistent left rail
     (position: fixed, no backdrop, no focus-trap); below 1024px it slides in
     as a backdropped overlay. Offset the main content by the rail width on
     desktop only — the sidebar's CSS vars inherit inside its own subtree, so a
     sibling offset (lg:pl-72 == 18rem) is applied by hand. -->
<div class="relative min-h-screen">
  <Sidebar bind:open={filtersOpen} mode="responsive" width="18rem">
    {#snippet header()}
      <div class="flex w-full items-center justify-between py-3">
        <span class="text-text-primary flex items-center gap-2 font-semibold">
          <FunnelIcon size={18} /> Filters
        </span>
        <!-- Close only exists on the mobile overlay; the desktop rail can't be dismissed. -->
        <Button
          variant="ghost"
          intent="neutral"
          size="xs"
          class="lg:hidden"
          onclick={() => (filtersOpen = false)}
          aria-label="Close filters"
        >
          <CloseIcon size={16} />
        </Button>
      </div>
    {/snippet}

    <div class="space-y-6 p-5">
      <Input placeholder="Search title or area" bind:value={search} clearable aria-label="Search listings">
        {#snippet leftIcon()}<SearchIcon size={16} />{/snippet}
      </Input>

      <RadioGroup label="Property type" bind:value={propertyType}>
        <RadioItem value="any" label="Any" />
        <RadioItem value="apartment" label="Apartment" />
        <RadioItem value="house" label="House" />
        <RadioItem value="studio" label="Studio" />
      </RadioGroup>

      <Slider
        label="Monthly rent"
        range
        min={RENT_MIN}
        max={RENT_MAX}
        step={50}
        bind:value={rentRange}
        showValue
        formatValue={(v) =>
          Array.isArray(v)
            ? '€' + v[0].toLocaleString('en-US') + ' – €' + v[1].toLocaleString('en-US')
            : '€' + v}
      />

      <div class="space-y-2">
        <span class="text-text-secondary text-sm font-medium">Bedrooms</span>
        <SegmentGroup bind:value={bedrooms} size="sm" ariaLabel="Bedrooms" fullWidth>
          <SegmentItem value="any">Any</SegmentItem>
          <SegmentItem value="1">1</SegmentItem>
          <SegmentItem value="2">2</SegmentItem>
          <SegmentItem value="3">3+</SegmentItem>
        </SegmentGroup>
      </div>

      <fieldset class="space-y-2.5">
        <legend class="text-text-secondary mb-1 text-sm font-medium">Amenities</legend>
        {#each AMENITIES as amenity (amenity.id)}
          <Checkbox
            label={amenity.label}
            checked={amenities.includes(amenity.id)}
            onCheckedChange={() => toggleAmenity(amenity.id)}
          />
        {/each}
      </fieldset>
    </div>

    {#snippet footer()}
      <div class="flex items-center gap-2 p-4">
        <Button
          variant="outlined"
          intent="neutral"
          class="flex-1"
          onclick={reset}
          disabled={activeCount === 0}
        >
          Reset{activeCount ? ' (' + activeCount + ')' : ''}
        </Button>
        <!-- Mobile-only "done" affordance — closes the overlay. Desktop filters live-apply. -->
        <Button intent="primary" class="flex-1 lg:hidden" onclick={() => (filtersOpen = false)}>
          Show {results.length}
        </Button>
      </div>
    {/snippet}
  </Sidebar>

  <!-- Main content — offset by the rail width on desktop, full-bleed on mobile. -->
  <div class="lg:pl-72">
    <!-- Mobile-only toolbar with the funnel trigger (gone once the rail is persistent). -->
    <div class="border-border-subtle bg-surface-base/90 sticky top-0 z-[var(--z-sticky)] flex items-center gap-3 border-b px-5 py-3 backdrop-blur lg:hidden">
      <Button variant="outlined" intent="neutral" size="sm" onclick={() => (filtersOpen = true)}>
        <FunnelIcon size={16} /> Filters{activeCount ? ' (' + activeCount + ')' : ''}
      </Button>
      <span class="text-text-tertiary text-sm">{results.length} homes</span>
    </div>

    <div class="p-5">
      <div class="mb-4 hidden items-baseline justify-between lg:flex">
        <h2 class="text-text-primary text-lg font-semibold">{results.length} homes</h2>
        <span class="text-text-tertiary text-sm">Berlin · updated today</span>
      </div>

      {#if results.length === 0}
        <div class="border-border-default rounded-xl border border-dashed p-10 text-center">
          <p class="text-text-primary font-medium">No homes match these filters</p>
          <p class="text-text-tertiary mt-1 text-sm">Widen the rent range or clear a few amenities.</p>
          <Button class="mt-4" variant="outlined" intent="neutral" onclick={reset}>Reset filters</Button>
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {#each results as listing (listing.id)}
            <Card variant="outlined" padding="sm" class="flex h-full flex-col gap-3">
              <div class="flex items-start justify-between gap-2">
                <h3 class="text-text-primary font-semibold">{listing.title}</h3>
                <Badge variant="soft" intent="neutral" size="sm">{TYPE_LABEL[listing.type]}</Badge>
              </div>
              <div class="text-text-tertiary flex items-center gap-3 text-sm">
                <span class="flex items-center gap-1"><MapPinIcon size={14} /> {listing.neighborhood}</span>
                <span class="flex items-center gap-1"><BedIcon size={14} /> {bedsLabel(listing.beds)}</span>
              </div>
              {#if listing.amenities.length}
                <div class="flex flex-wrap gap-1.5">
                  {#each listing.amenities as a (a)}
                    <Badge variant="outlined" intent="primary" size="sm">{amenityLabel(a)}</Badge>
                  {/each}
                </div>
              {/if}
              <div class="mt-auto flex items-baseline gap-1">
                <span class="text-text-primary text-lg font-bold">€{listing.rent.toLocaleString('en-US')}</span>
                <span class="text-text-tertiary text-sm">/ month</span>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>`;
</script>

<SeoMeta
  title="Filter Sidebar Recipe"
  description="A filterable results page with a filter panel that is persistent on desktop and a slide-in overlay on mobile — built on Sidebar mode=responsive with live client-side filtering."
/>

<div class="mx-auto max-w-6xl px-6 py-12">
  <header class="mb-10">
    <a
      href={resolve('/recipes')}
      class="text-text-tertiary hover:text-text-primary mb-4 inline-flex items-center gap-1 text-sm transition-colors"
    >
      ← Back to Recipes
    </a>
    <h1 class="text-text-primary mb-3 text-4xl font-bold">{recipeMeta.title}</h1>
    <p class="text-text-secondary max-w-3xl text-lg">{recipeMeta.description}</p>
  </header>

  <div class="mb-8 flex flex-wrap gap-2">
    {#each usedComponents as comp (comp)}
      <Badge variant="soft" intent="primary">{comp}</Badge>
    {/each}
  </div>

  <Section id="preview" title="Live Preview">
    <p class="text-text-tertiary mb-4 text-sm">
      Resize the window across <strong class="text-text-secondary">1024px</strong> to switch
      lifecycles: above it the filter rail is a persistent part of the shell; below it a funnel
      button opens the same panel as a backdropped overlay. The preview is scoped to the box below —
      in a real app the <code class="text-text-primary">Sidebar</code> is page-fixed and the main
      content offset is a plain <code class="text-text-primary">lg:pl-72</code>.
    </p>

    <div
      class="border-border-default relative h-[40rem] overflow-hidden rounded-xl border shadow-[var(--blocks-shadow-md)]"
    >
      <Sidebar
        bind:open={filtersOpen}
        mode="responsive"
        width="18rem"
        slotClasses={{ panel: 'absolute', backdrop: 'absolute' }}
      >
        {#snippet header()}
          <div class="flex w-full items-center justify-between py-3">
            <span class="text-text-primary flex items-center gap-2 font-semibold">
              <FunnelIcon size={18} /> Filters
            </span>
            <Button
              variant="ghost"
              intent="neutral"
              size="xs"
              class="lg:hidden"
              onclick={() => (filtersOpen = false)}
              aria-label="Close filters"
            >
              <CloseIcon size={16} />
            </Button>
          </div>
        {/snippet}

        <div class="space-y-6 p-5">
          <Input
            placeholder="Search title or area"
            bind:value={search}
            clearable
            aria-label="Search listings"
          >
            {#snippet leftIcon()}<SearchIcon size={16} />{/snippet}
          </Input>

          <RadioGroup label="Property type" bind:value={propertyType}>
            <RadioItem value="any" label="Any" />
            <RadioItem value="apartment" label="Apartment" />
            <RadioItem value="house" label="House" />
            <RadioItem value="studio" label="Studio" />
          </RadioGroup>

          <Slider
            label="Monthly rent"
            range
            min={RENT_MIN}
            max={RENT_MAX}
            step={50}
            bind:value={rentRange}
            showValue
            formatValue={(v) =>
              Array.isArray(v)
                ? '€' + v[0].toLocaleString('en-US') + ' – €' + v[1].toLocaleString('en-US')
                : '€' + v}
          />

          <div class="space-y-2">
            <span class="text-text-secondary text-sm font-medium">Bedrooms</span>
            <SegmentGroup bind:value={bedrooms} size="sm" ariaLabel="Bedrooms" fullWidth>
              <SegmentItem value="any">Any</SegmentItem>
              <SegmentItem value="1">1</SegmentItem>
              <SegmentItem value="2">2</SegmentItem>
              <SegmentItem value="3">3+</SegmentItem>
            </SegmentGroup>
          </div>

          <fieldset class="space-y-2.5">
            <legend class="text-text-secondary mb-1 text-sm font-medium">Amenities</legend>
            {#each AMENITIES as amenity (amenity.id)}
              <Checkbox
                label={amenity.label}
                checked={amenities.includes(amenity.id)}
                onCheckedChange={() => toggleAmenity(amenity.id)}
              />
            {/each}
          </fieldset>
        </div>

        {#snippet footer()}
          <div class="flex items-center gap-2 p-4">
            <Button
              variant="outlined"
              intent="neutral"
              class="flex-1"
              onclick={reset}
              disabled={activeCount === 0}
            >
              Reset{activeCount ? ' (' + activeCount + ')' : ''}
            </Button>
            <Button intent="primary" class="flex-1 lg:hidden" onclick={() => (filtersOpen = false)}>
              Show {results.length}
            </Button>
          </div>
        {/snippet}
      </Sidebar>

      <div class="h-full overflow-y-auto lg:pl-72">
        <div
          class="border-border-subtle bg-surface-base/90 sticky top-0 z-[var(--z-sticky)] flex items-center gap-3 border-b px-5 py-3 backdrop-blur lg:hidden"
        >
          <Button
            variant="outlined"
            intent="neutral"
            size="sm"
            onclick={() => (filtersOpen = true)}
          >
            <FunnelIcon size={16} /> Filters{activeCount ? ' (' + activeCount + ')' : ''}
          </Button>
          <span class="text-text-tertiary text-sm">{results.length} homes</span>
        </div>

        <div class="p-5">
          <div class="mb-4 hidden items-baseline justify-between lg:flex">
            <h2 class="text-text-primary text-lg font-semibold">{results.length} homes</h2>
            <span class="text-text-tertiary text-sm">Berlin · updated today</span>
          </div>

          {#if results.length === 0}
            <div class="border-border-default rounded-xl border border-dashed p-10 text-center">
              <p class="text-text-primary font-medium">No homes match these filters</p>
              <p class="text-text-tertiary mt-1 text-sm">
                Widen the rent range or clear a few amenities.
              </p>
              <Button class="mt-4" variant="outlined" intent="neutral" onclick={reset}>
                Reset filters
              </Button>
            </div>
          {:else}
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {#each results as listing (listing.id)}
                <Card variant="outlined" padding="sm" class="flex h-full flex-col gap-3">
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="text-text-primary font-semibold">{listing.title}</h3>
                    <Badge variant="soft" intent="neutral" size="sm">
                      {TYPE_LABEL[listing.type]}
                    </Badge>
                  </div>
                  <div class="text-text-tertiary flex items-center gap-3 text-sm">
                    <span class="flex items-center gap-1">
                      <MapPinIcon size={14} />
                      {listing.neighborhood}
                    </span>
                    <span class="flex items-center gap-1">
                      <BedIcon size={14} />
                      {bedsLabel(listing.beds)}
                    </span>
                  </div>
                  {#if listing.amenities.length}
                    <div class="flex flex-wrap gap-1.5">
                      {#each listing.amenities as a (a)}
                        <Badge variant="outlined" intent="primary" size="sm">
                          {amenityLabel(a)}
                        </Badge>
                      {/each}
                    </div>
                  {/if}
                  <div class="mt-auto flex items-baseline gap-1">
                    <span class="text-text-primary text-lg font-bold">
                      €{listing.rent.toLocaleString('en-US')}
                    </span>
                    <span class="text-text-tertiary text-sm">/ month</span>
                  </div>
                </Card>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </Section>

  <Section id="features" title="Key Features" headingLevel={3}>
    <ul class="text-text-secondary list-disc space-y-2 pl-5">
      {#each features as feature (feature)}
        <li>{feature}</li>
      {/each}
    </ul>
  </Section>

  <Section id="why-sidebar" title="Why Sidebar, not Drawer" headingLevel={3}>
    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <div class="divide-border-subtle divide-y">
        <div class="pb-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">The panel is page shell</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            On desktop the filters are always present and the results reflow beside them — there is
            no backdrop, no focus-trap, and nothing to dismiss. That is a
            <code class="text-text-primary">Sidebar</code>. A
            <code class="text-text-primary">Drawer</code> is a modal
            <code class="text-text-primary">&lt;dialog&gt;</code>: backdrop and focus-trap are
            non-optional, which is wrong for a panel you want visible while you scan results.
          </p>
        </div>
        <div class="py-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">One panel, two lifecycles</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            <code class="text-text-primary">mode="responsive"</code> keeps the same markup for both:
            persistent above 1024px, a backdropped slide-in overlay below it. The
            <code class="text-text-primary">open</code> prop only governs the mobile overlay — on desktop
            the rail ignores it and stays visible.
          </p>
        </div>
        <div class="py-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">No Apply on desktop</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            Because the rail is not modal, filtering is live — a single
            <code class="text-text-primary">$derived</code> recomputes the grid as you toggle
            controls. The mobile overlay adds a <em>Show N results</em> button purely as a "done" affordance
            to close the sheet; it commits nothing that was not already applied.
          </p>
        </div>
        <div class="pt-4">
          <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Offset the main content</h4>
          <p class="text-text-secondary text-sm leading-relaxed">
            The <code class="text-text-primary">Sidebar</code> is
            <code class="text-text-primary">position: fixed</code>, so its
            <code class="text-text-primary">--sidebar-width</code>
            CSS var inherits only inside its own subtree. Offset the sibling main region by hand —
            <code class="text-text-primary">lg:pl-72</code> matches
            <code class="text-text-primary">width="18rem"</code>. For a ready-made app shell that
            wires the offset and mobile header for you, reach for
            <code class="text-text-primary">SidebarLayout</code> instead.
          </p>
        </div>
      </div>
    </div>
  </Section>

  <div class="mt-12">
    <CodeExample
      title="Filter Sidebar Recipe"
      code={recipeCode}
      language="svelte"
      preview={false}
    />
  </div>
</div>
