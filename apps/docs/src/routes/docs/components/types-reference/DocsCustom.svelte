<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section, InfoCard, TypesReference } from '@urbicon-ui/docs';
  import type { LocalTypeDef } from '@urbicon-ui/docs';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: true },
      playground: { enabled: false },
      variants: { enabled: false },
      examples: { enabled: true, order: 2 },
      api: { enabled: true, order: 9, showInheritance: true },
      usage: false
    },
    llm: { include: true, maxSections: 5, priority: ['overview', 'api'] },
    meta: { title: 'TypesReference Component', showToc: true }
  };

  const sampleTypes: LocalTypeDef[] = [
    {
      name: 'ButtonVariant',
      type: 'type',
      definition: "'filled' | 'outlined' | 'ghost' | 'text'",
      documentation: 'Visual weight of the Button component.',
      category: 'variant',
      scope: 'local',
      usedByProps: [{ component: 'Button', propName: 'variant', source: 'variant' }]
    },
    {
      name: 'ComponentIntent',
      type: 'type',
      definition: "'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral'",
      documentation: 'Semantic color intent shared across all components.',
      category: 'helper',
      scope: 'local',
      usedByProps: [
        { component: 'Button', propName: 'intent', source: 'variant' },
        { component: 'Badge', propName: 'intent', source: 'variant' }
      ]
    },
    {
      name: 'ButtonProps',
      type: 'interface',
      definition:
        'variant?: ButtonVariant;\n  intent?: ComponentIntent;\n  size?: ComponentSize;\n  disabled?: boolean;\n  children?: Snippet;',
      documentation: 'Props interface for the Button component.',
      category: 'props',
      scope: 'local',
      usedByProps: []
    }
  ];
</script>

<!-- Basic Usage -->
<Section id="examples" title="Examples" subtitle="How TypesReference renders type definitions">
  <CodeExample title="Interface & Type Definitions" isolate>
    <TypesReference
      types={sampleTypes}
      title="Button Types"
      description="Types extracted from the Button component source."
    />
  </CodeExample>
</Section>

<!-- Sizes -->
<Section id="sizes" title="Sizes" subtitle="Compact, default, and spacious density">
  <div class="flex flex-col gap-6">
    {#each ['sm', 'md', 'lg'] as const as sizeOption (sizeOption)}
      <CodeExample title="Size: {sizeOption}" isolate>
        <TypesReference
          types={sampleTypes.slice(0, 2)}
          title="Types ({sizeOption})"
          size={sizeOption}
        />
      </CodeExample>
    {/each}
  </div>
</Section>

<!-- Empty State -->
<Section id="empty" title="Empty State" subtitle="What happens when no types are provided">
  <CodeExample title="No Types" isolate>
    <TypesReference types={[]} title="Types" description="This component has no local types." />
  </CodeExample>
</Section>

<!-- Use Cases -->
<Section id="use-cases" title="Use Cases" subtitle="Where TypesReference fits in documentation">
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <InfoCard title="Component Docs">Type definitions alongside API reference</InfoCard>
    <InfoCard title="Cross-Linking">Click "Used by" to jump to the API section</InfoCard>
    <InfoCard title="Literal Values">Union types show inline value badges</InfoCard>
  </div>
</Section>
