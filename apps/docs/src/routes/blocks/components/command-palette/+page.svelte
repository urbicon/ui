<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { CommandPalette, Button } from '@urbicon-ui/blocks';
  import type { CommandPaletteItem } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  let playgroundOpen = $state(false);

  const playgroundItems: CommandPaletteItem[] = [
    {
      label: 'New File',
      shortcut: 'Ctrl+N',
      category: 'File',
      icon: 'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    },
    {
      label: 'Save',
      shortcut: 'Ctrl+S',
      category: 'File',
      icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4'
    },
    {
      label: 'Search',
      shortcut: 'Ctrl+F',
      category: 'Edit',
      icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
    },
    {
      label: 'Settings',
      category: 'Navigation',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
    },
    {
      label: 'Sign Out',
      category: 'Account',
      icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
    }
  ];

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];

  const apiProps = [
    {
      name: 'items',
      type: 'CommandPaletteItem[]',
      description: 'Array of items to display. Grouped automatically by `category`.'
    },
    {
      name: 'open',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Controls visibility. Supports bind:open.'
    },
    {
      name: 'placeholder',
      type: 'string',
      defaultValue: "'Search...'",
      description: 'Placeholder text for the search input.'
    },
    {
      name: 'emptyText',
      type: 'string',
      defaultValue: "'No results found.'",
      description: 'Message shown when the filter returns no results.'
    },
    {
      name: 'shortcut',
      type: 'string | false',
      defaultValue: "'mod+k'",
      description: 'Global keyboard shortcut that toggles the palette. Set to false to disable.'
    },
    {
      name: 'showFooter',
      type: 'boolean',
      defaultValue: 'true',
      description: 'Show keyboard-shortcut hints in the footer.'
    },
    {
      name: 'filter',
      type: '(item: CommandPaletteItem, query: string) => boolean',
      description: 'Custom filter function. Defaults to case-insensitive label + category match.'
    },
    {
      name: 'onSelect',
      type: '(item: CommandPaletteItem) => void',
      description: 'Fired when an item is selected via click or Enter.'
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean) => void',
      description: 'Fired when the open state changes.'
    },
    {
      name: 'customItem',
      type: 'Snippet<[CommandPaletteItem, boolean, number]>',
      description: 'Custom item renderer. Receives (item, isHighlighted, flatIndex).'
    },
    {
      name: 'customEmpty',
      type: 'Snippet<[string]>',
      description: 'Custom empty-state renderer. Receives the current query.'
    },
    {
      name: 'size',
      type: "'sm' | 'md' | 'lg'",
      defaultValue: "'md'",
      description: 'Maximum width of the palette panel.'
    },
    {
      name: 'unstyled',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Strip all default styles.'
    },
    {
      name: 'slotClasses',
      type: 'Partial<Record<SlotName, string>>',
      description: 'Per-slot CSS class overrides for wrapper, input, list, item, footer, etc.'
    },
    {
      name: 'class',
      type: 'string',
      description: 'Additional CSS classes on the root wrapper.'
    }
  ];

  const itemTypeProps = [
    { name: 'id', type: 'string', description: 'Unique identifier. Falls back to label.' },
    { name: 'label', type: 'string', description: 'Display text shown in the list.' },
    {
      name: 'category',
      type: 'string',
      description: 'Group header. Items with the same category are grouped.'
    },
    { name: 'shortcut', type: 'string', description: 'Keyboard shortcut displayed on the right.' },
    {
      name: 'icon',
      type: 'string',
      description: 'SVG path data for a leading icon (24x24 viewBox).'
    },
    {
      name: 'disabled',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Makes the item non-selectable.'
    },
    { name: 'data', type: 'unknown', description: 'Arbitrary payload forwarded to onSelect.' }
  ];
</script>

<SeoMeta
  title="CommandPalette Component"
  description="Keyboard-driven command palette with search, grouped results, and arrow-key navigation. Built on the Dialog primitive."
/>

<DocsPageLayout
  title="CommandPalette"
  description="Keyboard-driven command palette with search, grouped results, and arrow-key navigation. Built on the Dialog primitive."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
>
  <Section id="playground" intent="primary">
    <div class="flex flex-col items-center gap-4 py-8">
      <Button variant="outlined" intent="neutral" size="lg" onclick={() => (playgroundOpen = true)}>
        Open Command Palette
      </Button>
      <p class="text-text-tertiary text-sm">
        or press <kbd
          class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
          >Ctrl+K</kbd
        >
      </p>
    </div>
    <CommandPalette
      bind:open={playgroundOpen}
      items={playgroundItems}
      placeholder="Type a command or search..."
    />
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${apiProps.length + itemTypeProps.length} props`}
  >
    <div class="space-y-8">
      <div>
        <h3 class="text-text-primary mb-4 text-lg font-semibold">CommandPaletteProps</h3>
        <ApiReference props={apiProps} />
      </div>
      <div>
        <h3 class="text-text-primary mb-4 text-lg font-semibold">CommandPaletteItem</h3>
        <ApiReference props={itemTypeProps} />
      </div>
    </div>
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { CommandPalette } from '@urbicon-ui/blocks';\nimport type { CommandPaletteItem } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
