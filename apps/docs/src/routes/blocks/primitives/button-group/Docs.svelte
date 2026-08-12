<!-- urbicon-ignore raw-tailwind-color — the Customization demo tints the group into a glass
     control cluster with `slotClasses`: it keeps the pill radius tier, size and behaviour, and
     the raw colours cover the glass fill, border, blur and white icons — a frosted-glass look the
     token palette has no equivalent for. Every other section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    AlignCenterIcon,
    AlignLeftIcon,
    AlignRightIcon,
    BoldIcon,
    Button,
    ButtonGroup,
    GalleryIcon,
    ItalicIcon,
    Kbd,
    ListIcon,
    MapIcon,
    MapPinIcon,
    type ButtonGroupValue,
    UnderlineIcon,
    ZoomInIcon,
    ZoomOutIcon
  } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  // View switcher — single selection. ButtonGroupValue is string | string[] | undefined.
  let view = $state<ButtonGroupValue>('list');

  // Formatting toggles — multiple selection holds a string[].
  let formats = $state<ButtonGroupValue>(['bold']);
  const hasFormat = (format: string) => Array.isArray(formats) && formats.includes(format);

  // Zoom control — no selection, plain action buttons.
  let zoom = $state(100);

  // Text alignment — vertical single selection; a connected vertical group
  // softens its own caps (tier defaults to modify there).
  let align = $state<ButtonGroupValue>('left');
  const alignClass = $derived(
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
  );
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-8 text-sm leading-relaxed">
    A ButtonGroup joins related buttons into one control with shared borders,
    <code class="text-text-primary">connected</code> by default and spaced out when you set
    <code class="text-text-primary">connected</code> to
    <code class="text-text-primary">false</code>.
    <code class="text-text-primary">selection</code> sets the behaviour:
    <code class="text-text-primary">single</code> is a radio group,
    <code class="text-text-primary">multiple</code> a checkbox group, and
    <code class="text-text-primary">none</code> (the default) a plain row of actions. Set
    <code class="text-text-primary">size</code>, <code class="text-text-primary">intent</code>,
    <code class="text-text-primary">variant</code> or <code class="text-text-primary">mint</code>
    once on the group and every button inherits it.
  </p>
  <div class="space-y-8">
    <CodeExample
      title="View switcher"
      description="Single selection acts as a radio-group: bind:value holds the current ButtonGroupValue and drives which panel renders. Clicking the active segment again clears the selection, so handle the undefined case."
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
      description="Multiple selection acts as a checkbox-group: value holds a string[] of the pressed toggles (the hasFormat helper narrows the ButtonGroupValue union before reading it). Icon-only buttons each need an aria-label, and the group carries an ariaLabel for its purpose. tier=modify softens the group's corner rounding from the default pill caps, which suits a toolbar."
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
      description="With selection=none (the default) the group is purely visual: three plain Buttons share size, intent, and connected borders while onclick does the work. Per-button disabled still applies on top of the group to guard the range, and the middle button resets the zoom."
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

    <CodeExample
      title="Text alignment"
      description="A vertical stack for a narrow inspector or side panel: orientation=vertical runs the segments top to bottom, and a connected vertical group softens its own caps — the pill radius that shapes the horizontal segmented control would dome a stack of text buttons into a capsule. Pass tier=commit to ask for that capsule anyway; it suits a narrow icon-only stack. Each button pairs an icon with a text label, so none needs an aria-label."
      isolate
      previewClass="flex flex-wrap items-start gap-5"
    >
      <ButtonGroup
        selection="single"
        bind:value={align}
        orientation="vertical"
        size="sm"
        ariaLabel="Text alignment"
      >
        <Button value="left"><AlignLeftIcon size={16} />Left</Button>
        <Button value="center"><AlignCenterIcon size={16} />Center</Button>
        <Button value="right"><AlignRightIcon size={16} />Right</Button>
      </ButtonGroup>

      <p class={['text-text-primary max-w-xs text-sm leading-relaxed', alignClass]}>
        Sunlit corner studio with a reading nook, one block from the park and the market.
      </p>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Floating glass controls"
      description="One `slotClasses` tints the group into a translucent control cluster for a map overlay. It keeps the pill radius tier, size and behaviour, and the raw colours cover only the glass fill, border, blur and the white icons. Glass has no token equivalent."
      isolate
      previewClass="flex justify-center rounded-xl bg-linear-to-br from-indigo-600 via-blue-600 to-cyan-500 px-8 py-12"
    >
      <ButtonGroup
        ariaLabel="Map controls"
        connected={false}
        variant="ghost"
        size="sm"
        slotClasses={{
          base: 'rounded-commit border border-white/20 bg-white/10 p-1 shadow-[var(--blocks-shadow-lg)] backdrop-blur-xl'
        }}
      >
        <Button aria-label="Zoom in" class="text-white hover:bg-white/20">
          <ZoomInIcon size={16} />
        </Button>
        <Button aria-label="Zoom out" class="text-white hover:bg-white/20">
          <ZoomOutIcon size={16} />
        </Button>
        <Button aria-label="Recenter" class="text-white hover:bg-white/20">
          <MapPinIcon size={16} />
        </Button>
      </ButtonGroup>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      This is one of five ways to restyle a block. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>, <code class="text-text-primary">preset</code>
      and provider-level overrides.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA">
      <p>
        Single-selection groups use
        <code class="text-text-primary">role="radiogroup"</code> with
        <code class="text-text-primary">role="radio"</code> +
        <code class="text-text-primary">aria-checked</code> on each button. Multiple-selection
        groups use
        <code class="text-text-primary">role="group"</code> with
        <code class="text-text-primary">role="checkbox"</code> +
        <code class="text-text-primary">aria-checked</code>. Provide
        <code class="text-text-primary">ariaLabel</code> when the group's purpose is not clear from
        context, and an <code class="text-text-primary">aria-label</code> on every icon-only child Button.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Single-selection groups are a radiogroup:
        <Kbd keys="Tab" /> moves focus into the group (to the selected segment, or the first when none
        is selected), and
        <Kbd keys="ArrowLeft" /> / <Kbd keys="ArrowRight" /> (or <Kbd keys="ArrowUp" /> /
        <Kbd keys="ArrowDown" />), <Kbd keys="Home" /> and <Kbd keys="End" /> move between segments and
        change the selection. Multiple-selection and plain (<code class="text-text-primary"
          >selection="none"</code
        >) groups place every button in the tab order, so <Kbd keys="Tab" /> moves between them. <Kbd
          keys="Enter"
        /> / <Kbd keys="Space" />
        activates the focused button.
      </p>
    </Note>
    <Note title="Prop Inheritance">
      <p>
        <code class="text-text-primary">size</code>,
        <code class="text-text-primary">intent</code>,
        <code class="text-text-primary">variant</code>, and
        <code class="text-text-primary">mint</code> propagate to child Buttons via context, and the
        group wins: the same prop set on an individual Button inside a group is ignored, so
        configure these once on the group. <code class="text-text-primary">disabled</code>
        combines: a disabled group disables every child, and a child can additionally disable itself.
        Only <code class="text-text-primary">tier</code> can be overridden per Button.
      </p>
    </Note>
  </NoteList>
</Section>
