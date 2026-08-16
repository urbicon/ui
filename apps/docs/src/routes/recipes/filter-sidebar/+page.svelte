<script lang="ts">
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
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

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

  // The demo cages the page shell. In an app the Sidebar is page-fixed and the
  // shell fills the screen (the host in the recipeCode below); on the stage an
  // elevated Card clips a 40rem viewport instead, `slotClasses={{ panel:
  // 'absolute', backdrop: 'absolute' }}` pins the rail and its overlay inside
  // it, and the main region scrolls itself (`h-full overflow-y-auto`, content
  // slot stretched to `h-full`). Docs furniture only — none of it is in the
  // copyable code.
  const recipeCode = `<\script lang="ts">
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

  function bedsLabel(beds: number): string {
    if (beds === 0) return 'Studio';
    return beds + ' bed' + (beds > 1 ? 's' : '');
  }

  function amenityLabel(id: string): string {
    return AMENITIES.find((a) => a.id === id)?.label ?? id;
  }
<\/script>

<!-- Page shell: the Sidebar is position: fixed — a persistent left rail on
     desktop (no backdrop, no focus-trap), a backdropped overlay below 1024px.
     The rail does not push its siblings, so the main region is offset by
     hand: lg:pl-72 matches width="18rem". -->
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

      <fieldset class="flex flex-col items-start gap-2.5">
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
    <!-- Mobile-only toolbar with the funnel trigger; the persistent rail needs none. -->
    <div class="border-border-hairline bg-surface-base/90 sticky top-0 z-[var(--z-sticky)] flex items-center gap-3 border-b px-5 py-3 backdrop-blur lg:hidden">
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
            <Card variant="elevated" padding="sm" class="flex h-full flex-col gap-3">
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
                    <Badge variant="soft" intent="neutral" size="sm">{amenityLabel(a)}</Badge>
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

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="ListingsPage.svelte"
      description="Filter from the rail and the grid follows; resize the window across 1024px and the rail becomes an overlay behind the funnel button."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <Card
        variant="elevated"
        padding="none"
        class="h-[40rem] overflow-hidden"
        slotClasses={{ content: 'h-full' }}
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

            <fieldset class="flex flex-col items-start gap-2.5">
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
              <Button
                intent="primary"
                class="flex-1 lg:hidden"
                onclick={() => (filtersOpen = false)}
              >
                Show {results.length}
              </Button>
            </div>
          {/snippet}
        </Sidebar>

        <div class="h-full overflow-y-auto lg:pl-72">
          <div
            class="border-border-hairline bg-surface-base/90 sticky top-0 z-[var(--z-sticky)] flex items-center gap-3 border-b px-5 py-3 backdrop-blur lg:hidden"
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
                  <Card variant="elevated" padding="sm" class="flex h-full flex-col gap-3">
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
                          <Badge variant="soft" intent="neutral" size="sm">
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
      </Card>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Why Sidebar, not Drawer">
    <NoteList>
      <Note title="The panel is page shell">
        <p>
          On desktop the filters are always present and the results reflow beside them: no backdrop,
          no focus-trap, nothing to dismiss. That is a
          <code class="text-text-primary">Sidebar</code>. A
          <code class="text-text-primary">Drawer</code> is a modal
          <code class="text-text-primary">&lt;dialog&gt;</code>; its backdrop and focus-trap are
          non-optional, which is wrong for a panel you want visible while you scan results.
        </p>
      </Note>
      <Note title="One markup, two lifecycles">
        <p>
          <code class="text-text-primary">mode="responsive"</code> renders the same panel as a
          persistent rail above 1024px and as a backdropped overlay below it; the
          <code class="text-text-primary">open</code> prop governs only the overlay, the desktop
          rail ignores it. Because the rail is never modal there is no Apply step: filtering is
          live, and the overlay's <em>Show N</em> button only closes the sheet; it commits nothing that
          was not already applied.
        </p>
      </Note>
      <Note title="Offset the main content by hand">
        <p>
          The rail is <code class="text-text-primary">position: fixed</code>, so the results column
          does not flow around it. Give the main region the rail's width as padding (<code
            class="text-text-primary">lg:pl-72</code
          >
          matches
          <code class="text-text-primary">width="18rem"</code>) and move the two together. For a
          ready-made shell that wires the offset and the mobile header,
          <a
            class="text-primary hover:underline"
            href={resolve('/blocks/components/sidebar-layout')}>SidebarLayout</a
          > does both.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
