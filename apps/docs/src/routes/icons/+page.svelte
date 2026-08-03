<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    DEFAULT_ICONS,
    ICON_METADATA,
    getAllIconNames,
    Icon,
    Input,
    Badge,
    type IconName,
    type IconCategory,
    type IconComponent
  } from '@urbicon-ui/blocks';
  import { PlaygroundConfigurator, Section } from '@urbicon-ui/docs';
  import { SvelteSet } from 'svelte/reactivity';

  let searchQuery = $state('');
  let activeCategories = new SvelteSet<IconCategory>();
  let copiedIcon = $state<string | null>(null);

  let selectedIcon = $state<IconName>('search');

  type PlaygroundValues = {
    size: number;
    strokeWidth: number;
    rotate: string;
    flip: string;
    animation: string;
  };

  let playgroundValues = $state<PlaygroundValues>({
    size: 32,
    strokeWidth: 2,
    rotate: '0',
    flip: 'none',
    animation: 'none'
  });

  const categories: IconCategory[] = [
    'navigation',
    'action',
    'status',
    'toggle',
    'data',
    'utility',
    'communication',
    'media',
    'layout'
  ];

  const allNames = getAllIconNames().sort((a, b) => a.localeCompare(b));

  const categoryCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const cat of categories) {
      counts[cat] = allNames.filter((n) => ICON_METADATA[n].categories.includes(cat)).length;
    }
    return counts;
  });

  function toggleCategory(cat: IconCategory) {
    if (activeCategories.has(cat)) activeCategories.delete(cat);
    else activeCategories.add(cat);
  }

  const filteredIcons = $derived.by(() => {
    const query = searchQuery.toLowerCase().trim();
    const cats = activeCategories;
    return allNames.filter((name) => {
      const meta = ICON_METADATA[name];
      if (cats.size > 0 && !meta.categories.some((c) => cats.has(c))) return false;
      if (!query) return true;
      return (
        name.toLowerCase().includes(query) ||
        meta.label.toLowerCase().includes(query) ||
        meta.keywords.some((kw) => kw.includes(query))
      );
    });
  });

  function getComponentName(name: IconName): string {
    return name.charAt(0).toUpperCase() + name.slice(1) + 'Icon';
  }

  const currentComponentName = $derived(getComponentName(selectedIcon));

  function generateIconCode(values: Record<string, unknown>): string {
    const v = values as Partial<PlaygroundValues>;
    const comp = currentComponentName;
    const props: string[] = [];
    if (v.size !== undefined && v.size !== 24) props.push(`size={${v.size}}`);
    if (v.strokeWidth !== undefined && v.strokeWidth !== 2)
      props.push(`strokeWidth={${v.strokeWidth}}`);
    if (v.rotate && v.rotate !== '0') props.push(`rotate={${v.rotate}}`);
    if (v.flip && v.flip !== 'none') props.push(`flip="${v.flip}"`);
    if (v.animation && v.animation !== 'none') props.push(`animation="${v.animation}"`);
    const importLine = `import { ${comp} } from '@urbicon-ui/blocks';`;
    if (props.length === 0) return `${importLine}\n\n<${comp} />`;
    return `${importLine}\n\n<${comp}\n  ${props.join('\n  ')}\n/>`;
  }

  async function copyImport(name: IconName) {
    const componentName = getComponentName(name);
    const text = `import { ${componentName} } from '@urbicon-ui/blocks';`;
    await navigator.clipboard.writeText(text);
    copiedIcon = name;
    setTimeout(() => {
      if (copiedIcon === name) copiedIcon = null;
    }, 2000);
  }

  function selectForPlayground(name: IconName) {
    selectedIcon = name;
  }
</script>

<!-- urbicon-ignore centered-bodytext — the one centred paragraph is a
     one-line count under a centred icon grid: a caption for it, not copy
     anyone scans line by line. -->

<SeoMeta
  title="Icons"
  description="Browse all {allNames.length} icons in the Urbicon UI icon library. Search, filter by category, and copy import statements."
/>

<div class="mx-auto max-w-6xl px-6 py-12">
  <header class="mb-10">
    <h1 class="text-text-primary text-3xl font-bold tracking-tight">Icons</h1>
    <p class="text-text-secondary mt-2 text-lg">
      {allNames.length} original stroke-based icons. Click any icon to open it in the playground.
    </p>
  </header>

  <Section id="playground" title="Playground" titleHidden intent="primary">
    <PlaygroundConfigurator
      componentName={currentComponentName}
      controls={[
        {
          type: 'slider',
          key: 'size',
          label: 'Size',
          min: 12,
          max: 64,
          step: 4,
          defaultValue: 32
        },
        {
          type: 'slider',
          key: 'strokeWidth',
          label: 'Stroke',
          min: 1,
          max: 4,
          step: 0.5,
          defaultValue: 2
        },
        {
          type: 'dropdown',
          key: 'rotate',
          label: 'Rotate',
          items: [
            { label: '0°', value: '0' },
            { label: '90°', value: '90' },
            { label: '180°', value: '180' },
            { label: '270°', value: '270' }
          ],
          defaultValue: '0'
        },
        {
          type: 'dropdown',
          key: 'flip',
          label: 'Flip',
          items: [
            { label: 'None', value: 'none' },
            { label: 'X', value: 'x' },
            { label: 'Y', value: 'y' },
            { label: 'Both', value: 'both' }
          ],
          defaultValue: 'none'
        },
        {
          type: 'dropdown',
          key: 'animation',
          label: 'Animation',
          items: [
            { label: 'None', value: 'none' },
            { label: 'Spin', value: 'spin' },
            { label: 'Pulse', value: 'pulse' }
          ],
          defaultValue: 'none'
        }
      ]}
      bind:values={playgroundValues}
      codeGenerator={generateIconCode}
      showHeader={false}
    >
      {#snippet children(values)}
        {@const v = values as PlaygroundValues}
        <div class="flex flex-col items-center gap-3 py-6">
          <Icon
            name={selectedIcon}
            size={v.size}
            strokeWidth={v.strokeWidth}
            rotate={v.rotate !== '0' ? (Number(v.rotate) as 0 | 90 | 180 | 270) : undefined}
            flip={v.flip !== 'none' ? (v.flip as 'x' | 'y' | 'both') : undefined}
            animation={v.animation !== 'none' ? (v.animation as 'spin' | 'pulse') : undefined}
          />
          <span class="text-text-secondary text-sm font-medium">
            {ICON_METADATA[selectedIcon].label}
          </span>
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <!-- Search & Filters -->
  <div class="mt-12 mb-6">
    <Input bind:value={searchQuery} placeholder="Search icons..." clearable />
  </div>

  <div class="mb-6 flex flex-wrap items-center gap-2">
    {#each categories as cat (cat)}
      <button
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors
          {activeCategories.has(cat)
          ? 'bg-primary text-text-on-primary border-primary'
          : 'border-border-subtle text-text-secondary hover:bg-surface-elevated hover:text-text-primary'}"
        onclick={() => toggleCategory(cat)}
      >
        {cat}
        <Badge
          variant="soft"
          intent="neutral"
          size="sm"
          class={activeCategories.has(cat) ? 'opacity-80' : ''}
        >
          {categoryCounts[cat]}
        </Badge>
      </button>
    {/each}
    {#if activeCategories.size > 0}
      <button
        class="text-text-secondary hover:text-text-primary text-xs underline"
        onclick={() => activeCategories.clear()}
      >
        Clear
      </button>
    {/if}
  </div>

  <!-- Icon Grid -->
  {#if filteredIcons.length === 0}
    <div class="text-text-secondary py-20 text-center">No icons match your search.</div>
  {:else}
    <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {#each filteredIcons as name (name)}
        {@const IconComp = DEFAULT_ICONS[name] as IconComponent}
        {@const meta = ICON_METADATA[name]}
        <button
          class="group flex flex-col items-center gap-2 rounded-xl border p-3.5 transition-[border-color,background-color,box-shadow]
            {selectedIcon === name
            ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
            : copiedIcon === name
              ? 'border-success bg-success/5'
              : 'border-border-subtle hover:border-primary hover:bg-surface-elevated'}"
          onclick={() => selectForPlayground(name)}
          ondblclick={() => copyImport(name)}
          title="{meta.label} — click to preview, double-click to copy import"
        >
          <div class="text-text-primary flex items-center justify-center" style="height: 40px">
            <IconComp size={24} />
          </div>
          <span
            class="text-text-secondary group-hover:text-text-primary text-3xs w-full truncate text-center"
          >
            {#if copiedIcon === name}
              Copied!
            {:else}
              {name}
            {/if}
          </span>
        </button>
      {/each}
    </div>
    <p class="text-text-secondary mt-4 text-center text-xs">
      {filteredIcons.length} of {allNames.length} icons. Click to preview, double-click to copy import.
    </p>
  {/if}
</div>
