<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import type { LocalTypeDef } from '@urbicon-ui/docs';
  import CustomDocs from './DocsCustom.svelte';
  import { asset, resolve } from '$app/paths';

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'sizes', title: 'Sizes' },
    { id: 'empty', title: 'Empty State' },
    { id: 'use-cases', title: 'Use Cases' },
    { id: 'api', title: 'API Reference' }
  ];

  const playgroundTypes: LocalTypeDef[] = [
    {
      name: 'ComponentSize',
      type: 'type',
      definition: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
      documentation: 'Standard size scale for all components.',
      category: 'helper',
      scope: 'local',
      usedByProps: [
        { component: 'Button', propName: 'size', source: 'variant' },
        { component: 'Input', propName: 'size', source: 'variant' }
      ]
    },
    {
      name: 'MintProp',
      type: 'type',
      definition: "'scale' | 'ripple' | 'translate' | 'glow' | 'none'",
      documentation: 'Micro-interaction animation type.',
      category: 'helper',
      scope: 'local'
    },
    {
      name: 'MenuProps',
      type: 'interface',
      definition:
        'items: ControlOption[];\n  value?: string;\n  onValueChange?: (value: string) => void;\n  size?: ComponentSize;',
      documentation: 'Props for the Menu select component.',
      category: 'props',
      scope: 'local'
    }
  ];

  const componentProps = [
    {
      name: 'types',
      type: 'LocalTypeDef[]',
      required: true,
      description: 'Array of type definitions to display.',
      source: { type: 'direct' as const, name: 'TypesReferenceProps' }
    },
    {
      name: 'title',
      type: 'string',
      required: false,
      description: 'Section heading text.',
      defaultValue: "'Types'",
      source: { type: 'direct' as const, name: 'TypesReferenceProps' }
    },
    {
      name: 'description',
      type: 'string',
      required: false,
      description: 'Descriptive text below the title.',
      source: { type: 'direct' as const, name: 'TypesReferenceProps' }
    },
    {
      name: 'size',
      type: "'sm' | 'md' | 'lg'",
      required: false,
      description: 'Controls the density – text size, padding, badge size.',
      defaultValue: "'md'",
      source: { type: 'variant' as const, name: 'TypesReferenceVariantProps' }
    },
    {
      name: 'class',
      type: 'string',
      required: false,
      description: 'Extra CSS classes merged onto the root section element.',
      source: { type: 'direct' as const, name: 'TypesReferenceProps' }
    },
    {
      name: 'unstyled',
      type: 'boolean',
      required: false,
      description: 'Strip all default tv() styles from internal slots.',
      defaultValue: 'false',
      source: { type: 'direct' as const, name: 'TypesReferenceProps' }
    },
    {
      name: 'slotClasses',
      type: 'Partial<Record<SlotName, string>>',
      required: false,
      description: 'Per-slot class overrides for internal elements.',
      source: { type: 'direct' as const, name: 'TypesReferenceProps' }
    },
    {
      name: 'emptyState',
      type: 'Snippet',
      required: false,
      description: 'Optional snippet rendered when no types match the filter.',
      source: { type: 'direct' as const, name: 'TypesReferenceProps' }
    }
  ];
</script>

<SeoMeta
  title="TypesReference"
  description="Expandable type definitions panel for component documentation with inline code blocks, literal badges, and API cross-links."
/>

<DocsPageLayout
  title="TypesReference"
  description="Expandable type definitions panel for component documentation with inline code blocks, literal badges, and API cross-links."
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
>
  <!-- Hero Playground -->
  <Section id="playground" title="Playground" subtitle="Configure and preview the types panel">
    <PlaygroundConfigurator
      componentName="TypesReference"
      showHeader={false}
      controls={[
        { key: 'title', type: 'text', label: 'Title', defaultValue: 'Type Definitions' },
        {
          key: 'description',
          type: 'text',
          label: 'Description',
          defaultValue: 'Local types used by this component.'
        },
        {
          key: 'size',
          type: 'dropdown',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        }
      ]}
      values={{
        title: 'Type Definitions',
        description: 'Local types used by this component.',
        size: 'md'
      }}
    >
      {#snippet children(values)}
        <TypesReference
          types={playgroundTypes}
          title={values.title}
          description={values.description}
          size={values.size}
        />
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <!-- API Reference -->
  <Section
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentProps} />
  </Section>

  <div class="mt-6 w-full text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/types-reference/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
