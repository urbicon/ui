<script lang="ts">
  import { CodeExample, Section, TypesReference } from '@urbicon-ui/docs';
  import type { LocalTypeDef } from '@urbicon-ui/docs';

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
<Section
  marker="01"
  id="examples"
  title="Examples"
  subtitle="How TypesReference renders type definitions"
>
  <CodeExample title="Interface & Type Definitions" isolate>
    <TypesReference
      id="types-button"
      types={sampleTypes}
      title="Button Types"
      description="Types extracted from the Button component source."
    />
  </CodeExample>
</Section>

<!-- Empty State -->
<Section
  marker="02"
  id="empty"
  title="Empty State"
  subtitle="What happens when no types are provided"
>
  <CodeExample title="No Types" isolate>
    <TypesReference
      id="types-empty"
      types={[]}
      title="Types"
      description="This component has no local types."
    />
  </CodeExample>
</Section>
