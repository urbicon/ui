<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import {
    BoldIcon,
    Button,
    ButtonGroup,
    type ButtonGroupValue,
    GalleryIcon,
    ItalicIcon,
    ListIcon,
    MapIcon,
    MapPinIcon,
    UnderlineIcon,
    ZoomInIcon,
    ZoomOutIcon
  } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: [
          'orientation',
          'variant',
          'intent',
          'size',
          'selection',
          'connected',
          'disabled'
        ],
        defaults: { variant: 'outlined', intent: 'neutral', size: 'md' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Button Group Component', showToc: true }
  };

  // View switcher — single selection. ButtonGroupValue is string | string[] | undefined.
  let view = $state<ButtonGroupValue>('list');

  // Formatting toggles — multiple selection holds a string[].
  let formats = $state<ButtonGroupValue>(['bold']);
  const hasFormat = (format: string) => Array.isArray(formats) && formats.includes(format);

  // Zoom control — no selection, plain action buttons.
  let zoom = $state(100);
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="View switcher"
      description="Single selection acts as a radio-group: bind:value (a ButtonGroupValue, declared as $state in the script) drives which panel renders. Clicking the active segment again clears the selection, so handle the undefined case."
      isolate
      previewClass="mx-auto w-full max-w-md"
    >
      <div class="flex w-full flex-col gap-4">
        <ButtonGroup selection="single" bind:value={view} size="sm" ariaLabel="Listing view">
          <Button value="list"><ListIcon size={16} />List</Button>
          <Button value="gallery"><GalleryIcon size={16} />Gallery</Button>
          <Button value="map"><MapIcon size={16} />Map</Button>
        </ButtonGroup>

        {#if view === 'list'}
          <div class="flex flex-col gap-2" aria-hidden="true">
            {#each ['row-1', 'row-2', 'row-3'] as row (row)}
              <div class="bg-surface-elevated border-border-subtle h-9 rounded-lg border"></div>
            {/each}
          </div>
        {:else if view === 'gallery'}
          <div class="grid grid-cols-3 gap-2" aria-hidden="true">
            {#each ['tile-1', 'tile-2', 'tile-3', 'tile-4', 'tile-5', 'tile-6'] as tile (tile)}
              <div
                class="bg-surface-elevated border-border-subtle aspect-video rounded-lg border"
              ></div>
            {/each}
          </div>
        {:else if view === 'map'}
          <div
            class="bg-surface-elevated border-border-subtle text-text-tertiary flex h-28 items-center justify-center rounded-lg border"
          >
            <MapPinIcon size={24} />
          </div>
        {:else}
          <p class="text-text-tertiary text-sm">No view selected.</p>
        {/if}
      </div>
    </CodeExample>

    <CodeExample
      title="Formatting toggles"
      description="Multiple selection acts as a checkbox-group: value holds a string[] of the pressed toggles (the hasFormat helper in the script narrows the union). Icon-only buttons need an aria-label each; the group carries an ariaLabel for its purpose. tier=modify gives the soft caps of a toolbar surface."
      isolate
      previewClass="flex flex-col items-start gap-5"
    >
      <ButtonGroup
        selection="multiple"
        bind:value={formats}
        size="sm"
        tier="modify"
        ariaLabel="Text formatting"
      >
        <Button value="bold" aria-label="Bold"><BoldIcon size={16} /></Button>
        <Button value="italic" aria-label="Italic"><ItalicIcon size={16} /></Button>
        <Button value="underline" aria-label="Underline"><UnderlineIcon size={16} /></Button>
      </ButtonGroup>

      <p
        class={[
          'text-text-primary text-sm',
          hasFormat('bold') && 'font-bold',
          hasFormat('italic') && 'italic',
          hasFormat('underline') && 'underline'
        ]}
      >
        Bright three-room flat with south-facing balcony, five minutes from the station.
      </p>
    </CodeExample>

    <CodeExample
      title="Zoom control"
      description="With selection=none (the default) the group is purely visual: three plain Buttons share size, intent, and connected borders while onclick does the work. Per-button disabled still applies on top of the group, guarding the range; clicking the value resets it."
      isolate
    >
      <ButtonGroup ariaLabel="Zoom">
        <Button aria-label="Zoom out" disabled={zoom <= 25} onclick={() => (zoom -= 25)}>
          <ZoomOutIcon size={16} />
        </Button>
        <Button class="min-w-20 tabular-nums" onclick={() => (zoom = 100)}>{zoom}%</Button>
        <Button aria-label="Zoom in" disabled={zoom >= 200} onclick={() => (zoom += 25)}>
          <ZoomInIcon size={16} />
        </Button>
      </ButtonGroup>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Full-width group"
      description="ButtonGroup has a single slot, base — the group container itself. Stretch it and give every child equal width for form footers or mobile-friendly switchers; tailwind-merge resolves the conflict with the default inline-flex."
      isolate
      previewClass="mx-auto w-full max-w-md"
    >
      <ButtonGroup
        selection="single"
        value="all"
        slotClasses={{ base: 'flex w-full [&>*]:flex-1' }}
        ariaLabel="Filter scope"
      >
        <Button value="all">All</Button>
        <Button value="active">Active</Button>
        <Button value="archived">Archived</Button>
      </ButtonGroup>
    </CodeExample>

    <CodeExample
      title="Unstyled: wrapping filter chips"
      description="unstyled drops the default single-row layout so you own it — here a wrapping chip row. Selection state, ARIA roles, and prop propagation to the child Buttons keep working. Setting connected to false lets each chip keep its own rounded caps."
      isolate
      previewClass="flex justify-center"
    >
      <ButtonGroup
        unstyled
        selection="multiple"
        connected={false}
        size="sm"
        class="flex max-w-sm flex-wrap gap-2"
        ariaLabel="Amenity filters"
      >
        <Button value="balcony">Balcony</Button>
        <Button value="garden">Garden</Button>
        <Button value="parking">Parking</Button>
        <Button value="elevator">Elevator</Button>
        <Button value="furnished">Furnished</Button>
        <Button value="pets">Pets allowed</Button>
      </ButtonGroup>
    </CodeExample>

    <CodeExample
      title="Reusable preset via BlocksProvider"
      description="For a recurring off-palette look — here a floating map-overlay pill — register a ButtonGroup preset once at the app root and reference it by name. Presets keep hover, active, and dark-mode logic coherent instead of scattering class overrides."
      preview={false}
      code={`<BlocksProvider
  presets={{
    ButtonGroup: {
      floating: {
        slotClasses: {
          base: 'bg-surface-overlay border-border-subtle rounded-full border p-1 shadow-[var(--blocks-shadow-md)]'
        }
      }
    }
  }}
>
  <ButtonGroup
    preset="floating"
    connected={false}
    variant="ghost"
    size="sm"
    selection="single"
    value="standard"
    ariaLabel="Map style"
  >
    <Button value="standard">Standard</Button>
    <Button value="satellite">Satellite</Button>
  </ButtonGroup>
</BlocksProvider>`}
    />
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Single-selection groups use
          <code class="text-text-primary">role="radiogroup"</code> with
          <code class="text-text-primary">role="radio"</code> +
          <code class="text-text-primary">aria-checked</code> on each button. Multiple-selection
          groups use
          <code class="text-text-primary">role="group"</code> with
          <code class="text-text-primary">role="checkbox"</code> +
          <code class="text-text-primary">aria-checked</code>. Provide
          <code class="text-text-primary">ariaLabel</code> when the group's purpose is not clear
          from context, and an <code class="text-text-primary">aria-label</code> on every icon-only child
          Button.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          moves focus between buttons.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          toggles selection.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Prop Inheritance</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <code class="text-text-primary">size</code>,
          <code class="text-text-primary">intent</code>,
          <code class="text-text-primary">variant</code>, and
          <code class="text-text-primary">mint</code> propagate to child Buttons via context, and
          the group wins — the same prop set on an individual Button inside a group is ignored, so
          configure these once on the group. <code class="text-text-primary">disabled</code>
          combines: a disabled group disables every child, and a child can additionally disable itself.
          Only <code class="text-text-primary">tier</code> can be overridden per Button.
        </p>
      </div>
    </div>
  </div>
</Section>
