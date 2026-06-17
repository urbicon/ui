<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import CustomDocs from './DocsCustom.svelte';
  import { asset } from '$app/paths';

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'control-types', title: 'Control Types', order: 2 },
    { id: 'conditional', title: 'Conditional Controls', order: 3 },
    { id: 'sizes', title: 'Sizes', order: 4 },
    { id: 'code-gen', title: 'Code Generation', order: 5 },
    { id: 'prop-docs', title: 'PropDocs & Variants', order: 6 },
    { id: 'use-cases', title: 'Use Cases', order: 7 }
  ];

  const componentProps = [
    {
      name: 'title',
      type: 'string',
      required: false,
      description: 'Heading text above the playground panel.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'subtitle',
      type: 'string',
      required: false,
      description: 'Descriptive text below the title.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'controls',
      type: 'ControlDefinition[]',
      required: true,
      description: 'Control definitions that drive the props panel (dropdown, toggle, text, etc.).',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'values',
      type: 'Record<string, any>',
      required: true,
      description: 'Current control values. Supports bind:values for two-way binding.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'onValuesChange',
      type: '(values: Record<string, any>) => void',
      required: false,
      description: 'Fires after any control value changes with the full values map.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'codeGenerator',
      type: '(values: Record<string, any>) => string',
      required: false,
      description: 'Custom code generator. Falls back to auto-generated Svelte tag syntax.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'componentName',
      type: 'string',
      required: false,
      description: 'Component name used in auto-generated code output.',
      defaultValue: "'Component'",
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'showHeader',
      type: 'boolean',
      required: false,
      description: 'Show the title/subtitle header above the playground.',
      defaultValue: 'true',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'propDocs',
      type: 'Record<string, string>',
      required: false,
      description:
        'Hand-written prop descriptions (from JSDoc). Shown as tooltip behind an info icon.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'variantKeys',
      type: 'string[]',
      required: false,
      description: 'Prop names originating from tailwind-variants. Shown with a "V" indicator.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'size',
      type: "'sm' | 'md' | 'lg'",
      required: false,
      description:
        'Controls the density of the playground layout – padding, grid columns, and text size.',
      defaultValue: "'md'",
      source: { type: 'variant' as const, name: 'PlaygroundConfiguratorVariantProps' }
    },
    {
      name: 'children',
      type: 'Snippet<[Record<string, any>]>',
      required: true,
      description: 'Render snippet receiving the current values map for the live preview.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'class',
      type: 'string',
      required: false,
      description: 'Extra CSS classes merged onto the root element.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'unstyled',
      type: 'boolean',
      required: false,
      description: 'Strip all default tv() styles from internal slots.',
      defaultValue: 'false',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    },
    {
      name: 'slotClasses',
      type: 'Partial<Record<SlotName, string>>',
      required: false,
      description: 'Per-slot class overrides for internal elements.',
      source: { type: 'direct' as const, name: 'PlaygroundConfiguratorProps' }
    }
  ];
</script>

<SeoMeta
  title="PlaygroundConfigurator"
  description="Interactive playground for component documentation with live preview, controls panel, and code generation."
/>

<DocsPageLayout
  title="PlaygroundConfigurator"
  description="Interactive playground for component documentation with live preview, controls panel, and code generation."
  maxWidth="lg"
  showToc={true}
  {navigation}
>
  <!-- Hero Playground -->
  <Section id="playground" title="Playground" subtitle="Configure controls and see the live output">
    <PlaygroundConfigurator
      componentName="PlaygroundConfigurator"
      showHeader={false}
      controls={[
        { type: 'text', key: 'label', label: 'Label', defaultValue: 'Hello World' },
        { type: 'boolean', key: 'bold', label: 'Bold', defaultValue: false },
        {
          type: 'dropdown',
          key: 'color',
          label: 'Color',
          items: [
            { label: 'Primary', value: 'primary' },
            { label: 'Success', value: 'success' },
            { label: 'Danger', value: 'danger' },
            { label: 'Neutral', value: 'neutral' }
          ],
          defaultValue: 'primary'
        },
        {
          type: 'slider',
          key: 'size',
          label: 'Font Size',
          defaultValue: 16,
          min: 12,
          max: 32,
          step: 1
        }
      ]}
      values={{ label: 'Hello World', bold: false, color: 'primary', size: 16 }}
    >
      {#snippet children(values)}
        <span
          class="text-{values.color} transition-all"
          style="font-size: {values.size}px; font-weight: {values.bold ? 700 : 400}"
        >
          {values.label}
        </span>
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
      href={asset('/docs/components/playground-configurator/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
