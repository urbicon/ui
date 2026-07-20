<!--
  Blocks overview — the "specimen book". A printed-catalogue take on the
  component index: cells share hairlines (1px grid gaps) instead of floating
  as cards, chapters follow the sidebar's functional groups, and every entry
  in the Blocks navigation renders as a living specimen that links to its doc
  page. Chapter list + counts derive from navigationItems, so the numbers can
  never go stale; a DEV-only effect fails loud when a nav entry has no cell
  (or a cell has no nav entry).

  Specimens are display dummies by design: the cell's overlay link swallows
  the pointer (the inner wrapper is pointer-events-none), so a click means
  "go to the docs", never "operate the demo" — the doc pages own the
  playgrounds. Overlay-only components (Dialog, Drawer, CommandPalette,
  Toast …) and viewport-scale ones (Sidebar, SidebarLayout, Planner) are
  token-built miniature sketches instead, a pattern this page already
  established for Dialog/Popover/Tooltip.
-->
<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { navigationItems } from '$lib/navigation';
  import {
    Accordion,
    AccordionItem,
    Alert,
    AreaChart,
    ArrowRightIcon,
    ArrowUpRightIcon,
    Avatar,
    Badge,
    BarChart,
    Breadcrumb,
    Button,
    ButtonGroup,
    Calendar,
    Card,
    ChartFrame,
    Checkbox,
    Collapsible,
    Combobox,
    CompositionBar,
    CurrencyInput,
    DatePicker,
    DonutChart,
    EmptyState,
    FileUpload,
    FormField,
    GuideBeacon,
    GuideMarker,
    GuideProvider,
    InboxIcon,
    Input,
    JourneyTimeline,
    LineChart,
    LocaleSwitcher,
    Menu,
    Pagination,
    Progress,
    RadioGroup,
    RadioItem,
    Sankey,
    SearchIcon,
    SegmentGroup,
    SegmentItem,
    Select,
    Separator,
    Skeleton,
    Slider,
    Sparkline,
    Spinner,
    Stepper,
    StepperStep,
    Tab,
    TabItem,
    TabPanel,
    Textarea,
    ThemeSwitcher,
    Toggle,
    Toolbar
  } from '@urbicon-ui/blocks';
  import { ScrollSpy } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';

  // ── Chapters — derived from the sidebar nav (single source of truth) ──
  const blocksGroups = navigationItems.find((item) => item.href === '/blocks')?.children ?? [];

  // One honest trait line per chapter — architecture facts from
  // docs/COMPONENT-FAMILIES.md, phrased at group (not family) precision.
  const CHAPTER_TRAITS: Record<string, string> = {
    Form: 'hold a value · modify tier',
    Actions: 'dispatch actions · commit tier',
    Overlay: 'top layer · focus managed',
    Feedback: 'status & ambient · fixed geometry',
    Layout: 'architectural surfaces · contain tier',
    Navigation: 'where you are · roving focus',
    Display: 'data, time & identity'
  };

  const chapters = blocksGroups.map((group) => ({
    name: group.name,
    slug: group.name.toLowerCase(),
    count: group.children?.length ?? 0,
    traits: CHAPTER_TRAITS[group.name] ?? ''
  }));
  const componentCount = chapters.reduce((n, chapter) => n + chapter.count, 0);

  // ── Scrollspy for the chapter register ────────────────────────────
  // The shared ScrollSpy from @urbicon-ui/docs (same instance class DocsLayout
  // and TableOfContents use) — no third listener implementation. Before the
  // first section crosses the trigger line, `active` is '' → fall back to the
  // first chapter so the register never renders without a current mark.
  const spy = new ScrollSpy(() => chapters.map((chapter) => chapter.slug));
  $effect(() => spy.observe());
  const activeChapter = $derived(spy.active || (chapters[0]?.slug ?? ''));

  // DEV-only completeness gate: every nav entry needs a specimen cell and
  // every cell a nav entry — a new component added to navigation.ts without
  // a specimen (or vice versa) fails loud in the console instead of silently
  // shipping an incomplete catalogue.
  $effect(() => {
    if (!import.meta.env?.DEV) return;
    const cells = new Set(
      Array.from(document.querySelectorAll('[data-specimen]')).map((el) =>
        el.getAttribute('data-specimen')
      )
    );
    const nav = new Set<string>();
    for (const group of blocksGroups) {
      for (const item of group.children ?? []) {
        nav.add(item.name);
        if (!cells.has(item.name)) {
          console.error(`[specimen book] nav entry "${item.name}" (${group.name}) has no cell`);
        }
      }
    }
    for (const name of cells) {
      if (name && !nav.has(name)) {
        console.error(`[specimen book] cell "${name}" has no entry in navigation.ts`);
      }
    }
  });

  // ── Catalogue cell grammar ─────────────────────────────────────────
  // Cells share hairlines via the grid's 1px gaps over a border-coloured
  // ground — no radius, no elevation, no lift. Hover is a room-tinted field
  // + the arrow; the overlay link owns the pointer.
  const grid =
    'grid grid-flow-dense grid-cols-1 auto-rows-[160px] gap-px ' +
    'border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-4';

  const cell =
    'group relative isolate flex flex-col overflow-hidden bg-surface-base p-5 ' +
    'transition-colors duration-[var(--blocks-duration-fast,150ms)] hover:bg-primary-subtle';
  const cellLg = `${cell} row-span-2 sm:col-span-2`;
  const cellWd = `${cell} sm:col-span-2`;
  const cellTall = `${cell} row-span-3 sm:col-span-2`;

  const cellLink =
    'absolute inset-0 z-[1] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary';

  // Specimens are display dummies: `inert` (set on every cell's inner wrapper)
  // removes their controls from tab order and the accessibility tree, so the
  // only interactive element per cell is the overlay link with its aria-label.
  const inner = 'relative z-[2] flex h-full flex-col pointer-events-none';
  const demo = 'flex flex-1 items-center justify-center';

  // ── Specimen data — one small studio universe, deterministic ──────
  const kickoff = new Date('2026-07-09T00:00:00');

  const calendarValue = new Date('2026-07-09T00:00:00');
  const calendarEvents = [
    {
      id: 'review',
      title: 'Design review',
      start: new Date('2026-07-10T00:00:00'),
      allDay: true,
      categoryId: 'studio'
    },
    {
      id: 'handoff',
      title: 'Handoff',
      start: new Date('2026-07-21T00:00:00'),
      allDay: true,
      categoryId: 'studio'
    }
  ];
  const calendarCategories = [{ id: 'studio', label: 'Studio', color: 'var(--color-primary)' }];

  const barData = [
    { label: 'Q1', values: [38, 22] },
    { label: 'Q2', values: [52, 28] },
    { label: 'Q3', values: [44, 25] },
    { label: 'Q4', values: [61, 31] }
  ];
  const barSeries = [{ label: 'Revenue' }, { label: 'Costs' }];

  const areaData = [
    { label: 'Jan', values: [12, 8] },
    { label: 'Feb', values: [16, 9] },
    { label: 'Mar', values: [14, 12] },
    { label: 'Apr', values: [21, 13] },
    { label: 'May', values: [19, 16] },
    { label: 'Jun', values: [26, 18] }
  ];
  const areaSeries = [{ label: 'New' }, { label: 'Returning' }];

  const lineData = [
    { label: 'Mon', values: [42] },
    { label: 'Tue', values: [38] },
    { label: 'Wed', values: [51] },
    { label: 'Thu', values: [46] },
    { label: 'Fri', values: [58] }
  ];

  const donutData = [
    { label: 'Direct', value: 45 },
    { label: 'Search', value: 30 },
    { label: 'Referral', value: 25 }
  ];

  const sankeyNodes = [
    { id: 'search', label: 'Search', intent: 'primary' as const },
    { id: 'direct', label: 'Direct', intent: 'neutral' as const },
    { id: 'site', label: 'Site', intent: 'success' as const }
  ];
  const sankeyLinks = [
    { source: 'search', target: 'site', value: 64 },
    { source: 'direct', target: 'site', value: 36 }
  ];

  const usage = [4, 6, 5, 9, 7, 12, 10, 15, 13, 18];

  const compositionItems = [
    { label: 'Documents', value: 412, intent: 'primary' as const },
    { label: 'Media', value: 264, intent: 'secondary' as const },
    { label: 'Other', value: 98, intent: 'success' as const }
  ];

  const journeyItems = [
    { id: 'brief', title: 'Brief', status: 'complete' as const },
    { id: 'design', title: 'Design', status: 'active' as const },
    { id: 'build', title: 'Build', status: 'pending' as const }
  ];
</script>

<SeoMeta
  title="Blocks"
  description={`${componentCount} Svelte 5 + Tailwind 4 components — form controls to charts. Interactive, accessible, token-driven.`}
/>

<!-- Color Rooms hero field — full-width band flush to the app sidebar; the
     inner wrapper re-aligns with the body column below. -->
<div data-room-hero>
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <p class="meta-marker text-text-tertiary text-xs font-medium tracking-wider uppercase">
      Specimen book — Svelte 5 · Tailwind 4 · zero dependencies
    </p>
    <div class="mt-4 flex items-center gap-3">
      <h1 class="text-text-primary text-4xl font-bold tracking-tight sm:text-5xl">Blocks</h1>
      <span
        data-room-chip
        class="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold"
      >
        {componentCount}
      </span>
    </div>
    <p class="text-text-secondary mt-4 max-w-xl text-base sm:text-lg">
      The complete set as living specimens. Every cell renders the real component and links to its
      page — props, variants, playground.
    </p>
  </div>
</div>

<!-- Chapter register — sticky mono rail, scrollspy marks the active chapter.
     In the rooms skin [data-room-register] extends the hero field and stays a
     colour band while pinned; in the bare library skin it falls back to the
     paper + hairline declared here. -->
<nav
  data-room-register
  aria-label="Component chapters"
  class="bg-surface-base border-border-hairline sticky top-(--sidebar-layout-header-h) z-[var(--z-sticky)] border-b"
>
  <div class="mx-auto flex max-w-7xl items-baseline gap-x-6 overflow-x-auto px-4 sm:px-6 lg:px-8">
    {#each chapters as chapter (chapter.slug)}
      <a
        href="#{chapter.slug}"
        aria-current={activeChapter === chapter.slug ? 'true' : undefined}
        class="text-text-secondary hover:text-text-primary aria-[current]:border-primary aria-[current]:text-primary -mb-px border-b-2 border-transparent py-2.5 font-mono text-[11.5px] font-medium tracking-[0.08em] whitespace-nowrap uppercase transition-colors"
      >
        {chapter.name}
        <span class="text-text-tertiary ml-0.5">{chapter.count}</span>
      </a>
    {/each}
  </div>
</nav>

<div class="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
  {#snippet arrow()}
    <ArrowUpRightIcon
      class="text-text-quaternary h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
    />
  {/snippet}

  {#snippet heading(name: string)}
    <div class="mb-3 flex items-center justify-between">
      <span
        class="text-text-tertiary group-hover:text-text-secondary font-mono text-2xs font-medium tracking-[0.08em] uppercase transition-colors duration-200"
        >{name}</span
      >
      {@render arrow()}
    </div>
  {/snippet}

  {#snippet chapterHead(index: number)}
    {@const chapter = chapters[index]}
    <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-14 pb-4">
      <h2
        id="{chapter.slug}-title"
        class="text-text-primary text-2xl font-bold tracking-tight sm:text-3xl"
      >
        {chapter.name}
      </h2>
      <p class="text-text-tertiary font-mono text-2xs tracking-[0.08em] uppercase">
        {chapter.count} components · {chapter.traits}
      </p>
    </div>
  {/snippet}

  <!-- ════════════════════════ Form ════════════════════════ -->
  <section
    id="form"
    data-chapter
    aria-labelledby="form-title"
    class="scroll-mt-[calc(var(--sidebar-layout-header-h)+3.25rem)]"
  >
    {@render chapterHead(0)}
    <div class={grid}>
      <!-- FileUpload ── 2×2 -->
      <div class={cellLg} data-specimen="FileUpload">
        <a
          href={resolve('/blocks/components/file-upload')}
          class={cellLink}
          aria-label="FileUpload docs"
        ></a>
        <div class={inner} inert>
          {@render heading('FileUpload')}
          <div class="flex flex-1 flex-col justify-center">
            <FileUpload
              title="Drop files to upload"
              description="PDF, PNG — up to 10 MB"
              maxFileSize={10 * 1024 * 1024}
            />
          </div>
        </div>
      </div>

      <!-- Input ── 2×1 -->
      <div class={cellWd} data-specimen="Input">
        <a href={resolve('/blocks/primitives/input')} class={cellLink} aria-label="Input docs"></a>
        <div class={inner} inert>
          {@render heading('Input')}
          <div class="flex flex-1 flex-col justify-center">
            <Input label="Email" placeholder="ada@atelier.example" size="sm" />
          </div>
        </div>
      </div>

      <!-- Select ── 2×1 -->
      <div class={cellWd} data-specimen="Select">
        <a href={resolve('/blocks/primitives/select')} class={cellLink} aria-label="Select docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Select')}
          <div class="flex flex-1 flex-col justify-center">
            <Select
              label="Region"
              size="sm"
              value="fra"
              options={[
                { label: 'Frankfurt', value: 'fra' },
                { label: 'Amsterdam', value: 'ams' },
                { label: 'Oslo', value: 'osl' }
              ]}
            />
          </div>
        </div>
      </div>

      <!-- DatePicker ── 2×1 -->
      <div class={cellWd} data-specimen="DatePicker">
        <a
          href={resolve('/blocks/components/date-picker')}
          class={cellLink}
          aria-label="DatePicker docs"
        ></a>
        <div class={inner} inert>
          {@render heading('DatePicker')}
          <div class="flex flex-1 flex-col justify-center">
            <DatePicker value={kickoff} label="Kickoff" size="sm" clearable={false} />
          </div>
        </div>
      </div>

      <!-- Combobox ── 2×1 -->
      <div class={cellWd} data-specimen="Combobox">
        <a href={resolve('/blocks/primitives/combobox')} class={cellLink} aria-label="Combobox docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Combobox')}
          <div class="flex flex-1 flex-col justify-center">
            <Combobox
              label="Assignee"
              size="sm"
              placeholder="Search people…"
              options={[
                { label: 'Ada Lovelace', value: 'ada' },
                { label: 'Grace Hopper', value: 'grace' },
                { label: 'Margaret Hamilton', value: 'margaret' }
              ]}
            />
          </div>
        </div>
      </div>

      <!-- CurrencyInput ── 2×1 -->
      <div class={cellWd} data-specimen="CurrencyInput">
        <a
          href={resolve('/blocks/components/currency-input')}
          class={cellLink}
          aria-label="CurrencyInput docs"
        ></a>
        <div class={inner} inert>
          {@render heading('CurrencyInput')}
          <div class="flex flex-1 flex-col justify-center">
            <CurrencyInput label="Budget" value={123456} currency="EUR" size="sm" />
          </div>
        </div>
      </div>

      <!-- Slider ── 2×1 -->
      <div class={cellWd} data-specimen="Slider">
        <a href={resolve('/blocks/primitives/slider')} class={cellLink} aria-label="Slider docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Slider')}
          <div class="flex flex-1 flex-col justify-center">
            <Slider
              value={64}
              min={0}
              max={100}
              label="Grid density"
              showValue
              formatValue={(v) => `${v}%`}
            />
          </div>
        </div>
      </div>

      <!-- Textarea ── 2×1 -->
      <div class={cellWd} data-specimen="Textarea">
        <a href={resolve('/blocks/primitives/textarea')} class={cellLink} aria-label="Textarea docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Textarea')}
          <div class="flex flex-1 flex-col justify-center">
            <Textarea placeholder="What changed in this revision?" minRows={2} />
          </div>
        </div>
      </div>

      <!-- FormField ── 2×1 -->
      <div class={cellWd} data-specimen="FormField">
        <a
          href={resolve('/blocks/primitives/form-field')}
          class={cellLink}
          aria-label="FormField docs"
        ></a>
        <div class={inner} inert>
          {@render heading('FormField')}
          <div class="flex flex-1 flex-col justify-center">
            <FormField label="API key" helper="Stored locally, never synced.">
              {#snippet children({ id, describedBy, invalid })}
                <input
                  {id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  value="uib_9f3k…"
                  readonly
                  class="rounded-modify border-border-default bg-surface-elevated text-text-primary w-full border px-3 py-1.5 font-mono text-sm"
                />
              {/snippet}
            </FormField>
          </div>
        </div>
      </div>

      <!-- RadioGroup ── 2×1 -->
      <div class={cellWd} data-specimen="RadioGroup">
        <a
          href={resolve('/blocks/primitives/radio-group')}
          class={cellLink}
          aria-label="RadioGroup docs"
        ></a>
        <div class={inner} inert>
          {@render heading('RadioGroup')}
          <div class="flex flex-1 flex-col justify-center">
            <RadioGroup label="Plan" value="pro" orientation="horizontal" size="sm">
              <RadioItem value="free" label="Free" />
              <RadioItem value="pro" label="Pro" />
              <RadioItem value="team" label="Team" />
            </RadioGroup>
          </div>
        </div>
      </div>

      <!-- Checkbox ── 1×1 -->
      <div class={cell} data-specimen="Checkbox">
        <a href={resolve('/blocks/primitives/checkbox')} class={cellLink} aria-label="Checkbox docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Checkbox')}
          <div class="flex flex-1 flex-col items-center justify-center gap-3">
            <Checkbox checked={true} slotClasses={{ box: 'rounded-full' }} />
            <Checkbox checked={true} slotClasses={{ box: 'w-7 h-7 rounded-md', icon: 'w-5 h-5' }} />
            <Checkbox checked={false} />
          </div>
        </div>
      </div>

      <!-- Toggle ── 1×1 -->
      <div class={cell} data-specimen="Toggle">
        <a href={resolve('/blocks/primitives/toggle')} class={cellLink} aria-label="Toggle docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Toggle')}
          <div class="flex flex-1 flex-col items-center justify-center gap-3">
            <Toggle checked={true} />
            <Toggle checked={false} />
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ════════════════════════ Actions ════════════════════════ -->
  <section
    id="actions"
    data-chapter
    aria-labelledby="actions-title"
    class="scroll-mt-[calc(var(--sidebar-layout-header-h)+3.25rem)]"
  >
    {@render chapterHead(1)}
    <div class={grid}>
      <!-- Button ── 2×2 -->
      <div class={cellLg} data-specimen="Button">
        <a href={resolve('/blocks/primitives/button')} class={cellLink} aria-label="Button docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Button')}
          <div class="flex flex-1 flex-col items-center justify-center gap-3.5">
            <Button intent="primary" mint={['scale', 'ripple']}>Save changes</Button>
            <Button variant="outlined">Cancel</Button>
            <Button variant="ghost" intent="danger">Delete project</Button>
          </div>
        </div>
      </div>

      <!-- CommandPalette ── 2×2 · overlay-only, token-built sketch -->
      <div class={cellLg} data-specimen="CommandPalette">
        <a
          href={resolve('/blocks/components/command-palette')}
          class={cellLink}
          aria-label="CommandPalette docs"
        ></a>
        <div class={inner} inert>
          {@render heading('CommandPalette')}
          <div class={demo}>
            <div
              class="border-border-subtle bg-surface-overlay w-full max-w-[300px] overflow-hidden rounded-lg border shadow-(--blocks-shadow-md)"
            >
              <div class="border-border-hairline flex items-center gap-2 border-b px-3 py-2.5">
                <SearchIcon class="text-text-tertiary h-3.5 w-3.5" />
                <span class="text-text-tertiary flex-1 text-xs">Search commands…</span>
                <kbd class="text-text-quaternary font-mono text-3xs">⌘K</kbd>
              </div>
              <div class="p-1.5 text-xs">
                <div
                  class="bg-surface-selected text-text-primary flex items-center justify-between rounded-md px-2.5 py-1.5"
                >
                  <span>New file</span>
                  <kbd class="text-text-quaternary font-mono text-3xs">⌘N</kbd>
                </div>
                <div class="text-text-secondary flex items-center justify-between px-2.5 py-1.5">
                  <span>Toggle theme</span>
                  <kbd class="text-text-quaternary font-mono text-3xs">⌘T</kbd>
                </div>
                <div class="text-text-secondary flex items-center justify-between px-2.5 py-1.5">
                  <span>Open settings</span>
                  <kbd class="text-text-quaternary font-mono text-3xs">⌘,</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Menu ── 2×1 -->
      <div class={cellWd} data-specimen="Menu">
        <a href={resolve('/blocks/primitives/menu')} class={cellLink} aria-label="Menu docs"></a>
        <div class={inner} inert>
          {@render heading('Menu')}
          <div class={demo}>
            <Menu
              items={[
                { label: 'Edit', onSelect: () => {} },
                { label: 'Duplicate', onSelect: () => {} },
                { label: 'Archive', onSelect: () => {} }
              ]}
              placeholder="Actions"
              size="sm"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Toolbar ── 2×1 -->
      <div class={cellWd} data-specimen="Toolbar">
        <a href={resolve('/blocks/primitives/toolbar')} class={cellLink} aria-label="Toolbar docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Toolbar')}
          <div class={demo}>
            <Toolbar aria-label="Formatting">
              <Button variant="ghost" size="xs" intent="primary"><b>B</b></Button>
              <Button variant="ghost" size="xs"><em>I</em></Button>
              <Button variant="ghost" size="xs"><u>U</u></Button>
              <Separator orientation="vertical" size="sm" />
              <Button variant="ghost" size="xs">Left</Button>
              <Button variant="ghost" size="xs">Center</Button>
            </Toolbar>
          </div>
        </div>
      </div>

      <!-- ButtonGroup ── 2×1 -->
      <div class={cellWd} data-specimen="ButtonGroup">
        <a
          href={resolve('/blocks/primitives/button-group')}
          class={cellLink}
          aria-label="ButtonGroup docs"
        ></a>
        <div class={inner} inert>
          {@render heading('ButtonGroup')}
          <div class={demo}>
            <ButtonGroup>
              <Button size="sm" intent="primary">Left</Button>
              <Button size="sm" intent="primary" variant="outlined">Center</Button>
              <Button size="sm" intent="primary" variant="outlined">Right</Button>
            </ButtonGroup>
          </div>
        </div>
      </div>

      <!-- ThemeSwitcher ── 1×1 -->
      <div class={cell} data-specimen="ThemeSwitcher">
        <a
          href={resolve('/blocks/components/theme-switcher')}
          class={cellLink}
          aria-label="ThemeSwitcher docs"
        ></a>
        <div class={inner} inert>
          {@render heading('ThemeSwitcher')}
          <div class={demo}>
            <ThemeSwitcher size="md" variant="outlined" />
          </div>
        </div>
      </div>

      <!-- LocaleSwitcher ── 1×1 -->
      <div class={cell} data-specimen="LocaleSwitcher">
        <a
          href={resolve('/blocks/components/locale-switcher')}
          class={cellLink}
          aria-label="LocaleSwitcher docs"
        ></a>
        <div class={inner} inert>
          {@render heading('LocaleSwitcher')}
          <div class={demo}>
            <LocaleSwitcher size="sm" showFlag variant="outlined" />
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ════════════════════════ Overlay ════════════════════════ -->
  <section
    id="overlay"
    data-chapter
    aria-labelledby="overlay-title"
    class="scroll-mt-[calc(var(--sidebar-layout-header-h)+3.25rem)]"
  >
    {@render chapterHead(2)}
    <div class={grid}>
      <!-- ConfirmDialog ── 2×1 · overlay-only, token-built sketch -->
      <div class={cellWd} data-specimen="ConfirmDialog">
        <a
          href={resolve('/blocks/primitives/confirm-dialog')}
          class={cellLink}
          aria-label="ConfirmDialog docs"
        ></a>
        <div class={inner} inert>
          {@render heading('ConfirmDialog')}
          <div class={demo}>
            <div
              class="border-border-subtle bg-surface-overlay w-full max-w-[240px] rounded-lg border p-3.5 shadow-(--blocks-shadow-sm)"
            >
              <p class="text-text-primary text-xs font-bold">Delete project?</p>
              <p class="text-text-secondary mt-1 text-2xs">This can't be undone.</p>
              <div class="mt-3 flex justify-end gap-1.5">
                <span
                  class="border-border-default text-text-secondary rounded-md border px-2.5 py-1 text-2xs"
                  >Cancel</span
                >
                <span class="bg-danger text-text-on-primary rounded-md px-2.5 py-1 text-2xs"
                  >Delete</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Guide ── 2×1 · beacon + marker render inert without a provider -->
      <div class={cellWd} data-specimen="Guide">
        <a href={resolve('/blocks/components/guide')} class={cellLink} aria-label="Guide docs"></a>
        <div class={inner} inert>
          {@render heading('Guide')}
          <div class="flex flex-1 items-center justify-center gap-8">
            <!-- Marker + beacon need a Guide context to render; a bare provider
                 (internal controller, no tour) keeps them purely presentational. -->
            <GuideProvider>
              <span class="text-text-primary inline-flex items-center gap-2 text-sm">
                Billing <GuideMarker for="billing" article="billing-help" />
              </span>
              <span class="text-text-primary relative inline-flex items-center gap-2.5 text-sm">
                Rooms theme <GuideBeacon size="md" />
              </span>
            </GuideProvider>
          </div>
        </div>
      </div>

      <!-- Drawer ── 2×1 · overlay-only, token-built sketch -->
      <div class={cellWd} data-specimen="Drawer">
        <a href={resolve('/blocks/primitives/drawer')} class={cellLink} aria-label="Drawer docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Drawer')}
          <div class={demo}>
            <div
              class="border-border-subtle bg-surface-quiet relative h-[76px] w-full max-w-[240px] overflow-hidden rounded-lg border"
            >
              <div
                class="border-border-subtle bg-surface-overlay absolute inset-y-0 right-0 w-[45%] border-l p-2.5 shadow-(--blocks-shadow-md)"
              >
                <div class="bg-text-primary/25 h-2 w-12 rounded"></div>
                <div class="bg-text-tertiary/15 mt-2 h-1.5 w-full rounded"></div>
                <div class="bg-text-tertiary/15 mt-1.5 h-1.5 w-3/4 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialog ── 1×1 · overlay-only, token-built sketch -->
      <div class={cell} data-specimen="Dialog">
        <a href={resolve('/blocks/primitives/dialog')} class={cellLink} aria-label="Dialog docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Dialog')}
          <div class={demo}>
            <div
              class="border-border-subtle bg-surface-overlay w-full max-w-[130px] overflow-hidden rounded-lg border shadow-(--blocks-shadow-sm)"
            >
              <div class="from-primary to-primary-emphasis h-1.5 bg-linear-to-r"></div>
              <div class="p-2.5">
                <div class="bg-text-primary/20 mb-1.5 h-2 w-14 rounded"></div>
                <div class="bg-text-tertiary/10 mb-2.5 h-1.5 w-full rounded"></div>
                <div class="flex justify-end gap-1.5">
                  <div class="bg-border-default h-4 w-10 rounded"></div>
                  <div class="bg-primary h-4 w-10 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Popover ── 1×1 · overlay-only, token-built sketch -->
      <div class={cell} data-specimen="Popover">
        <a href={resolve('/blocks/primitives/popover')} class={cellLink} aria-label="Popover docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Popover')}
          <div class="flex flex-1 flex-col items-center justify-center gap-1.5">
            <div
              class="border-border-subtle bg-surface-overlay rounded-lg border p-2.5 shadow-(--blocks-shadow-sm)"
            >
              <div class="mb-1.5 flex items-center gap-2">
                <div class="bg-success h-2 w-2 rounded-full"></div>
                <div class="bg-text-tertiary/20 h-1.5 w-16 rounded"></div>
              </div>
              <div class="bg-text-tertiary/10 h-1.5 w-12 rounded"></div>
            </div>
            <svg class="text-surface-overlay h-2 w-3 rotate-180" viewBox="0 0 12 8"
              ><path fill="currentColor" d="M6 8 0 0h12z" /></svg
            >
            <Button variant="outlined" size="xs" intent="primary">Trigger</Button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ════════════════════════ Feedback ════════════════════════ -->
  <section
    id="feedback"
    data-chapter
    aria-labelledby="feedback-title"
    class="scroll-mt-[calc(var(--sidebar-layout-header-h)+3.25rem)]"
  >
    {@render chapterHead(3)}
    <div class={grid}>
      <!-- EmptyState ── 2×2 -->
      <div class={cellLg} data-specimen="EmptyState">
        <a
          href={resolve('/blocks/components/empty-state')}
          class={cellLink}
          aria-label="EmptyState docs"
        ></a>
        <div class={inner} inert>
          {@render heading('EmptyState')}
          <div class={demo}>
            <EmptyState
              icon={InboxIcon}
              title="No entries yet"
              description="Create the first entry to get started."
              density="compact"
            >
              {#snippet cta()}
                <Button size="sm" intent="primary">New entry</Button>
              {/snippet}
            </EmptyState>
          </div>
        </div>
      </div>

      <!-- Alert ── 2×1 -->
      <div class={cellWd} data-specimen="Alert">
        <a href={resolve('/blocks/primitives/alert')} class={cellLink} aria-label="Alert docs"></a>
        <div class={inner} inert>
          {@render heading('Alert')}
          <div class={demo}>
            <Alert intent="info" title="Draft restored" class="w-full">
              Your unsaved changes from 14:32 were recovered.
            </Alert>
          </div>
        </div>
      </div>

      <!-- Toast ── 2×1 · portal-only (Toaster), token-built sketch -->
      <div class={cellWd} data-specimen="Toast">
        <a href={resolve('/blocks/primitives/toast')} class={cellLink} aria-label="Toast docs"></a>
        <div class={inner} inert>
          {@render heading('Toast')}
          <div class="flex flex-1 flex-col items-center justify-center gap-2">
            <div
              class="border-success/30 bg-success/5 flex w-full max-w-[280px] items-start gap-2 rounded-lg border p-2"
            >
              <div class="bg-success mt-0.5 h-3 w-3 shrink-0 rounded-full"></div>
              <div class="flex-1">
                <div class="bg-success/30 mb-1 h-2 w-12 rounded"></div>
                <div class="bg-text-tertiary/15 h-1.5 w-20 rounded"></div>
              </div>
            </div>
            <div
              class="border-danger/30 bg-danger/5 flex w-full max-w-[280px] items-start gap-2 rounded-lg border p-2"
            >
              <div class="bg-danger mt-0.5 h-3 w-3 shrink-0 rounded-full"></div>
              <div class="flex-1">
                <div class="bg-danger/30 mb-1 h-2 w-10 rounded"></div>
                <div class="bg-text-tertiary/15 h-1.5 w-16 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Progress ── 2×1 -->
      <div class={cellWd} data-specimen="Progress">
        <a href={resolve('/blocks/primitives/progress')} class={cellLink} aria-label="Progress docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Progress')}
          <div class="flex flex-1 items-center gap-6">
            <Progress
              value={80}
              shape="circular"
              circularSize={64}
              strokeWidth={6}
              intent="primary"
              showValue
            />
            <div class="flex flex-1 flex-col gap-3">
              <Progress value={65} intent="primary" />
              <Progress intent="primary" />
            </div>
          </div>
        </div>
      </div>

      <!-- Skeleton ── 2×1 -->
      <div class={cellWd} data-specimen="Skeleton">
        <a href={resolve('/blocks/primitives/skeleton')} class={cellLink} aria-label="Skeleton docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Skeleton')}
          <div class={demo}>
            <div class="flex w-full items-center gap-3">
              <Skeleton variant="circular" size="md" />
              <div class="flex flex-1 flex-col gap-2">
                <Skeleton variant="text" size="sm" class="w-3/4" />
                <Skeleton variant="text" size="xs" class="w-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Badge ── 2×1 -->
      <div class={cellWd} data-specimen="Badge">
        <a href={resolve('/blocks/primitives/badge')} class={cellLink} aria-label="Badge docs"></a>
        <div class={inner} inert>
          {@render heading('Badge')}
          <div class={demo}>
            <div class="flex flex-wrap items-center gap-3">
              <Badge intent="success">Online</Badge>
              <Badge intent="warning" variant="soft">Syncing</Badge>
              <Badge intent="danger" variant="outlined">Offline</Badge>
            </div>
          </div>
        </div>
      </div>

      <!-- Spinner ── 2×1 -->
      <div class={cellWd} data-specimen="Spinner">
        <a href={resolve('/blocks/primitives/spinner')} class={cellLink} aria-label="Spinner docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Spinner')}
          <div class="flex flex-1 items-center justify-center gap-6">
            <Spinner size="sm" intent="primary" />
            <Spinner size="md" intent="success" />
            <Spinner size="lg" intent="danger" />
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ════════════════════════ Layout ════════════════════════ -->
  <section
    id="layout"
    data-chapter
    aria-labelledby="layout-title"
    class="scroll-mt-[calc(var(--sidebar-layout-header-h)+3.25rem)]"
  >
    {@render chapterHead(4)}
    <div class={grid}>
      <!-- Card ── 2×2 (profile composition) -->
      <div class={cellLg} data-specimen="Card">
        <a href={resolve('/blocks/primitives/card')} class={cellLink} aria-label="Card docs"></a>
        <div class={inner} inert>
          {@render heading('Card')}
          <div class={demo}>
            <Card
              unstyled
              class="border-border-subtle bg-surface-elevated w-full overflow-hidden rounded-xl border"
            >
              <div class="from-primary to-success h-16 bg-linear-to-r"></div>
              <div class="px-4 pb-4">
                <div class="-mt-7">
                  <Avatar name="Ada Lovelace" size="lg" class="ring-surface-elevated ring-4" />
                </div>
                <h3 class="text-text-primary mt-2 text-sm font-bold">Ada Lovelace</h3>
                <p class="text-text-tertiary text-xs">Design Engineer</p>
                <div class="mt-3 flex flex-wrap gap-1.5">
                  <Badge size="sm" intent="primary" variant="soft">Svelte</Badge>
                  <Badge size="sm" intent="success" variant="soft">TypeScript</Badge>
                  <Badge size="sm" intent="neutral" variant="soft">Tailwind</Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <!-- Accordion ── 2×1 -->
      <div class={cellWd} data-specimen="Accordion">
        <a
          href={resolve('/blocks/primitives/accordion')}
          class={cellLink}
          aria-label="Accordion docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Accordion')}
          <div class="flex flex-1 items-start">
            <Accordion size="sm" class="w-full">
              <AccordionItem value="a1" title="Token-driven theming">
                OKLCH semantic tokens — dark mode included.
              </AccordionItem>
              <AccordionItem value="a2" title="Accessible by default">
                Keyboard navigation and ARIA built in.
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      <!-- Collapsible ── 2×1 -->
      <div class={cellWd} data-specimen="Collapsible">
        <a
          href={resolve('/blocks/primitives/collapsible')}
          class={cellLink}
          aria-label="Collapsible docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Collapsible')}
          <div class="flex flex-1 flex-col justify-center">
            <Collapsible title="Advanced options" defaultOpen>
              <p class="text-text-secondary text-sm">
                Region, retention and export settings live here.
              </p>
            </Collapsible>
          </div>
        </div>
      </div>

      <!-- SidebarLayout ── 2×1 · app-shell scale, token-built sketch -->
      <div class={cellWd} data-specimen="SidebarLayout">
        <a
          href={resolve('/blocks/components/sidebar-layout')}
          class={cellLink}
          aria-label="SidebarLayout docs"
        ></a>
        <div class={inner} inert>
          {@render heading('SidebarLayout')}
          <div class={demo}>
            <div
              class="border-border-subtle bg-surface-quiet flex h-[76px] w-full max-w-[240px] overflow-hidden rounded-lg border"
            >
              <div class="border-border-subtle bg-surface-elevated w-[30%] border-r p-2">
                <div class="bg-text-primary/25 h-1.5 w-8 rounded"></div>
                <div class="bg-primary/40 mt-2 h-1.5 w-10 rounded"></div>
                <div class="bg-text-tertiary/15 mt-1.5 h-1.5 w-9 rounded"></div>
                <div class="bg-text-tertiary/15 mt-1.5 h-1.5 w-7 rounded"></div>
              </div>
              <div class="flex-1 p-2.5">
                <div class="bg-text-primary/20 h-2 w-16 rounded"></div>
                <div class="bg-text-tertiary/10 mt-2 h-1.5 w-full rounded"></div>
                <div class="bg-text-tertiary/10 mt-1.5 h-1.5 w-4/5 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar ── 1×1 · fixed-position, token-built sketch -->
      <div class={cell} data-specimen="Sidebar">
        <a href={resolve('/blocks/primitives/sidebar')} class={cellLink} aria-label="Sidebar docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Sidebar')}
          <div class={demo}>
            <div
              class="border-border-subtle bg-surface-elevated h-[76px] w-[68px] rounded-lg border p-2 shadow-(--blocks-shadow-sm)"
            >
              <div class="bg-text-primary/25 h-1.5 w-7 rounded"></div>
              <div class="bg-primary/40 mt-2.5 h-1.5 w-10 rounded"></div>
              <div class="bg-text-tertiary/15 mt-1.5 h-1.5 w-8 rounded"></div>
              <div class="bg-text-tertiary/15 mt-1.5 h-1.5 w-9 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Separator ── 1×1 -->
      <div class={cell} data-specimen="Separator">
        <a
          href={resolve('/blocks/primitives/separator')}
          class={cellLink}
          aria-label="Separator docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Separator')}
          <div class="flex flex-1 flex-col items-center justify-center gap-3">
            <div class="w-full">
              <Separator size="sm" />
            </div>
            <div class="flex h-6 items-center gap-3">
              <span class="text-text-tertiary text-xs">A</span>
              <Separator orientation="vertical" size="sm" />
              <span class="text-text-tertiary text-xs">B</span>
              <Separator orientation="vertical" size="sm" />
              <span class="text-text-tertiary text-xs">C</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ════════════════════════ Navigation ════════════════════════ -->
  <section
    id="navigation"
    data-chapter
    aria-labelledby="navigation-title"
    class="scroll-mt-[calc(var(--sidebar-layout-header-h)+3.25rem)]"
  >
    {@render chapterHead(5)}
    <div class={grid}>
      <!-- Tab ── 2×2 -->
      <div class={cellLg} data-specimen="Tab">
        <a href={resolve('/blocks/primitives/tab')} class={cellLink} aria-label="Tab docs"></a>
        <div class={inner} inert>
          {@render heading('Tab')}
          <div class="{demo} w-full">
            <Tab defaultValue="home" size="sm" class="w-full">
              {#snippet tabs()}
                <TabItem value="home">Home</TabItem>
                <TabItem value="explore">Explore</TabItem>
                <TabItem value="library">Library</TabItem>
              {/snippet}
              {#snippet panels()}
                <TabPanel value="home">
                  <p class="text-text-secondary text-sm">
                    The default tab — line variant, token-driven, keyboard-navigable.
                  </p>
                </TabPanel>
                <TabPanel value="explore">
                  <p class="text-text-secondary text-sm">Discover components, patterns, tokens.</p>
                </TabPanel>
                <TabPanel value="library">
                  <p class="text-text-secondary text-sm">Your saved components and presets.</p>
                </TabPanel>
              {/snippet}
            </Tab>
          </div>
        </div>
      </div>

      <!-- Stepper ── 2×2 (vertical, with descriptions) -->
      <div class={cellLg} data-specimen="Stepper">
        <a href={resolve('/blocks/primitives/stepper')} class={cellLink} aria-label="Stepper docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Stepper')}
          <div class="flex flex-1 items-center">
            <Stepper activeStep={1} orientation="vertical" size="sm">
              <StepperStep label="Account" description="Create your login" />
              <StepperStep label="Workspace" description="Name the studio" />
              <StepperStep label="Invite" description="Bring the team" />
            </Stepper>
          </div>
        </div>
      </div>

      <!-- Breadcrumb ── 2×1 -->
      <div class={cellWd} data-specimen="Breadcrumb">
        <a
          href={resolve('/blocks/primitives/breadcrumb')}
          class={cellLink}
          aria-label="Breadcrumb docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Breadcrumb')}
          <div class={demo}>
            <Breadcrumb
              items={[
                { label: 'Home', href: '#' },
                { label: 'Docs', href: '#' },
                { label: 'Components' }
              ]}
              size="sm"
            />
          </div>
        </div>
      </div>

      <!-- SegmentGroup ── 2×1 -->
      <div class={cellWd} data-specimen="SegmentGroup">
        <a
          href={resolve('/blocks/primitives/segment-group')}
          class={cellLink}
          aria-label="SegmentGroup docs"
        ></a>
        <div class={inner} inert>
          {@render heading('SegmentGroup')}
          <div class={demo}>
            <SegmentGroup value="week" size="sm" ariaLabel="Range">
              <SegmentItem value="day">Day</SegmentItem>
              <SegmentItem value="week">Week</SegmentItem>
              <SegmentItem value="month">Month</SegmentItem>
            </SegmentGroup>
          </div>
        </div>
      </div>

      <!-- Pagination ── 2×1 -->
      <div class={cellWd} data-specimen="Pagination">
        <a
          href={resolve('/blocks/primitives/pagination')}
          class={cellLink}
          aria-label="Pagination docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Pagination')}
          <div class={demo}>
            <Pagination currentPage={2} totalPages={5} size="sm" intent="primary" />
          </div>
        </div>
      </div>

      <!-- JourneyTimeline ── 2×1 -->
      <div class={cellWd} data-specimen="JourneyTimeline">
        <a
          href={resolve('/blocks/primitives/journey-timeline')}
          class={cellLink}
          aria-label="JourneyTimeline docs"
        ></a>
        <div class={inner} inert>
          {@render heading('JourneyTimeline')}
          <div class={demo}>
            <JourneyTimeline items={journeyItems} orientation="horizontal" size="sm" />
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ════════════════════════ Display ════════════════════════ -->
  <section
    id="display"
    data-chapter
    aria-labelledby="display-title"
    class="scroll-mt-[calc(var(--sidebar-layout-header-h)+3.25rem)]"
  >
    {@render chapterHead(6)}
    <div class={grid}>
      <!-- BarChart ── 2×2 -->
      <div class={cellLg} data-specimen="BarChart">
        <a
          href={resolve('/blocks/components/bar-chart')}
          class={cellLink}
          aria-label="BarChart docs"
        ></a>
        <div class={inner} inert>
          {@render heading('BarChart')}
          <div class="flex flex-1 flex-col justify-center">
            <BarChart height={180} data={barData} series={barSeries} />
          </div>
        </div>
      </div>

      <!-- AreaChart ── 2×2 -->
      <div class={cellLg} data-specimen="AreaChart">
        <a
          href={resolve('/blocks/components/area-chart')}
          class={cellLink}
          aria-label="AreaChart docs"
        ></a>
        <div class={inner} inert>
          {@render heading('AreaChart')}
          <div class="flex flex-1 flex-col justify-center">
            <AreaChart height={180} data={areaData} series={areaSeries} stacked />
          </div>
        </div>
      </div>

      <!-- Calendar ── 2×3 (a month grid needs the extra row to breathe) -->
      <div class={cellTall} data-specimen="Calendar">
        <a href={resolve('/blocks/components/calendar')} class={cellLink} aria-label="Calendar docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Calendar')}
          <div class="flex flex-1 items-center justify-center">
            <Calendar
              value={calendarValue}
              defaultMonth={6}
              defaultYear={2026}
              size="sm"
              events={calendarEvents}
              categories={calendarCategories}
            />
          </div>
        </div>
      </div>

      <!-- LineChart ── 2×1 -->
      <div class={cellWd} data-specimen="LineChart">
        <a
          href={resolve('/blocks/components/line-chart')}
          class={cellLink}
          aria-label="LineChart docs"
        ></a>
        <div class={inner} inert>
          {@render heading('LineChart')}
          <div class="flex flex-1 flex-col justify-center">
            <LineChart height={92} data={lineData} />
          </div>
        </div>
      </div>

      <!-- DonutChart ── 2×1 -->
      <div class={cellWd} data-specimen="DonutChart">
        <a
          href={resolve('/blocks/components/donut-chart')}
          class={cellLink}
          aria-label="DonutChart docs"
        ></a>
        <div class={inner} inert>
          {@render heading('DonutChart')}
          <div class={demo}>
            <DonutChart size={92} data={donutData} showLegend={false} showTotal />
          </div>
        </div>
      </div>

      <!-- Sankey ── 2×1 -->
      <div class={cellWd} data-specimen="Sankey">
        <a href={resolve('/blocks/components/sankey')} class={cellLink} aria-label="Sankey docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Sankey')}
          <div class={demo}>
            <Sankey width={260} height={92} nodes={sankeyNodes} links={sankeyLinks} />
          </div>
        </div>
      </div>

      <!-- Sparkline ── 2×1 -->
      <div class={cellWd} data-specimen="Sparkline">
        <a
          href={resolve('/blocks/components/sparkline')}
          class={cellLink}
          aria-label="Sparkline docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Sparkline')}
          <div class={demo}>
            <Sparkline
              data={usage}
              area
              showEndPoint
              width={260}
              height={48}
              ariaLabel="Usage trend, last 10 days"
            />
          </div>
        </div>
      </div>

      <!-- CompositionBar ── 2×1 -->
      <div class={cellWd} data-specimen="CompositionBar">
        <a
          href={resolve('/blocks/components/composition-bar')}
          class={cellLink}
          aria-label="CompositionBar docs"
        ></a>
        <div class={inner} inert>
          {@render heading('CompositionBar')}
          <div class="flex flex-1 flex-col justify-center">
            <CompositionBar items={compositionItems} size="sm" showTotal />
          </div>
        </div>
      </div>

      <!-- ChartFrame ── 2×1 (custom marks on the shared frame) -->
      <div class={cellWd} data-specimen="ChartFrame">
        <a
          href={resolve('/blocks/components/chart-frame')}
          class={cellLink}
          aria-label="ChartFrame docs"
        ></a>
        <div class={inner} inert>
          {@render heading('ChartFrame')}
          <div class="flex flex-1 flex-col justify-center">
            <ChartFrame height={92} ariaLabel="Custom marks demo">
              {#snippet children({ innerWidth, innerHeight })}
                <polyline
                  points={`0,${innerHeight} ${innerWidth * 0.25},${innerHeight * 0.55} ${innerWidth * 0.55},${innerHeight * 0.7} ${innerWidth},${innerHeight * 0.1}`}
                  fill="none"
                  class="stroke-primary"
                  stroke-width="2"
                />
                <circle cx={innerWidth} cy={innerHeight * 0.1} r="3" class="fill-primary" />
              {/snippet}
            </ChartFrame>
          </div>
        </div>
      </div>

      <!-- Planner ── 2×1 · fills its container at app scale, sketch -->
      <div class={cellWd} data-specimen="Planner">
        <a href={resolve('/blocks/components/planner')} class={cellLink} aria-label="Planner docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Planner')}
          <div class={demo}>
            <div
              class="border-border-subtle grid h-[76px] w-full max-w-[260px] grid-cols-5 gap-px overflow-hidden rounded-lg border bg-[var(--color-border-hairline)]"
            >
              <div class="bg-surface-elevated p-1">
                <div class="bg-primary/70 mt-2 h-2.5 rounded-sm"></div>
              </div>
              <div class="bg-surface-elevated p-1">
                <div class="bg-text-tertiary/20 mt-5 h-2.5 rounded-sm"></div>
              </div>
              <div class="bg-surface-elevated p-1">
                <div class="bg-primary/70 h-2.5 rounded-sm"></div>
                <div class="bg-primary/30 mt-1 h-2.5 rounded-sm"></div>
              </div>
              <div class="bg-surface-elevated p-1"></div>
              <div class="bg-surface-elevated p-1">
                <div class="bg-text-tertiary/20 mt-3 h-2.5 rounded-sm"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Avatar ── 2×1 (stack + the identity shape axis) -->
      <div class={cellWd} data-specimen="Avatar">
        <a href={resolve('/blocks/primitives/avatar')} class={cellLink} aria-label="Avatar docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Avatar')}
          <div class="flex flex-1 items-center justify-center gap-8">
            <div class="flex -space-x-3">
              <Avatar name="Ada Lovelace" randomColor class="ring-surface-base ring-2" />
              <Avatar name="Anna Keller" randomColor class="ring-surface-base ring-2" />
              <Avatar name="Samir Tahir" randomColor class="ring-surface-base ring-2" />
              <Avatar class="ring-surface-base ring-2">+5</Avatar>
            </div>
            <div class="flex items-center gap-3">
              <Avatar name="Grace Hopper" status="online" />
              <Avatar name="Grace Hopper" variant="rounded" />
              <Avatar name="Grace Hopper" variant="square" />
            </div>
          </div>
        </div>
      </div>

      <!-- Tooltip ── 2×1 · top-layer, token-built sketch -->
      <div class={cellWd} data-specimen="Tooltip">
        <a href={resolve('/blocks/primitives/tooltip')} class={cellLink} aria-label="Tooltip docs"
        ></a>
        <div class={inner} inert>
          {@render heading('Tooltip')}
          <div class="flex flex-1 flex-col items-center justify-center gap-1.5">
            <div
              class="bg-surface-inverted text-text-inverted rounded-md px-2.5 py-1 text-2xs font-medium shadow-(--blocks-shadow-sm)"
            >
              Copy to clipboard
            </div>
            <svg class="text-surface-inverted h-2 w-3" viewBox="0 0 12 8"
              ><path fill="currentColor" d="M6 8 0 0h12z" /></svg
            >
            <Button variant="outlined" size="xs">Copy</Button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ─── Customization island ───────────────────────────────── -->
  <section class="mt-20" aria-labelledby="customization-island-title">
    <p class="meta-marker text-text-tertiary text-xs font-medium tracking-wider uppercase">
      Unstyled in action
    </p>
    <h2
      id="customization-island-title"
      class="text-text-primary mt-4 text-2xl font-bold tracking-tight sm:text-3xl"
    >
      The default is one voice — and this is how far you can take it
    </h2>
    <p class="text-text-secondary mt-4 max-w-2xl text-sm leading-relaxed">
      Every component accepts
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >unstyled</code
      >
      to drop the shipped skin entirely and
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >slotClasses</code
      >
      to restyle single slots. The two showpieces below are the same Button and Tab from the grid — pushed
      to the opposite end of the spectrum.
    </p>

    <!-- Dark board: fixed warm poster ink (like the landing's terminal card),
         not a cool neutral — the neon content inside is deliberately foreign,
         the frame is not. -->
    <div class="border-border-subtle mt-8 border bg-[#14120d] p-8">
      <div class="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div class="flex flex-col items-start justify-center gap-3">
          <span
            class="font-mono text-2xs font-medium tracking-[0.08em] text-[#f6f3ec]/55 uppercase"
          >
            Button · unstyled + slotClasses
          </span>
          <Button
            size="sm"
            mint={['scale', 'ripple']}
            slotClasses={{
              base: 'bg-linear-to-r from-violet-600 to-fuchsia-500 border-none shadow-lg shadow-violet-500/30'
            }}>Launch Project</Button
          >
          <Button
            unstyled
            class="rounded-lg border border-emerald-400 px-4 py-2 text-sm font-medium text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all hover:bg-emerald-400/10 hover:shadow-[0_0_25px_rgba(52,211,153,0.5)]"
            >Neon Outline</Button
          >
          <Button
            unstyled
            mint="scale"
            class="inline-flex items-center gap-2 rounded-none border-2 border-current px-5 py-2 font-mono text-xs font-bold tracking-widest text-neutral-300 uppercase transition-all hover:bg-white hover:text-neutral-950"
            >Brutalist</Button
          >
        </div>

        <div>
          <span
            class="font-mono text-2xs font-medium tracking-[0.08em] text-[#f6f3ec]/55 uppercase"
          >
            Tab · unstyled on gradient
          </span>
          <div
            class="mt-3 rounded-xl bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 p-4"
          >
            <Tab unstyled defaultValue="home" class="w-full">
              {#snippet tabs()}
                <div class="flex gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-md">
                  <TabItem
                    unstyled
                    value="home"
                    class="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >Home</TabItem
                  >
                  <TabItem
                    unstyled
                    value="explore"
                    class="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >Explore</TabItem
                  >
                  <TabItem
                    unstyled
                    value="library"
                    class="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >Library</TabItem
                  >
                </div>
              {/snippet}
              {#snippet panels()}
                <TabPanel
                  unstyled
                  value="home"
                  class="mt-3 rounded-xl bg-white/10 p-4 text-sm text-white/80 backdrop-blur-md"
                  >Frosted glass panels with gradient backdrop</TabPanel
                >
                <TabPanel
                  unstyled
                  value="explore"
                  class="mt-3 rounded-xl bg-white/10 p-4 text-sm text-white/80 backdrop-blur-md"
                  >Discover components, patterns, tokens</TabPanel
                >
                <TabPanel
                  unstyled
                  value="library"
                  class="mt-3 rounded-xl bg-white/10 p-4 text-sm text-white/80 backdrop-blur-md"
                  >Your saved components and presets</TabPanel
                >
              {/snippet}
            </Tab>
          </div>
        </div>
      </div>
    </div>

    <a
      href={resolve('/customization')}
      class="text-text-tertiary hover:text-primary mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
    >
      Read the customization guide
      <ArrowRightIcon class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  </section>

  <div class="mt-14 text-center">
    <p class="text-text-tertiary text-sm leading-relaxed">
      Zero external dependencies. Every component supports
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >unstyled</code
      >,
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >slotClasses</code
      >, and
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs">mint</code>
      micro-interactions. AI-native with the urbicon CLI and per-component
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >llms.txt</code
      >.
    </p>
  </div>
</div>
