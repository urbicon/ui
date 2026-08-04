<script lang="ts">
  import { ApiReference, type ApiProp, CodeExample, InfoCard, Section } from '@urbicon-ui/docs';

  // A hand-written stand-in for the generated `componentData.props`. The shape
  // is the real one — this is what `docs:gen` writes into every page's api.ts.
  const sampleProps: ApiProp[] = [
    {
      name: 'variant',
      type: "'filled' | 'outlined' | 'ghost'",
      defaultValue: "'filled'",
      description: 'Visual weight of the button.',
      source: { type: 'variant', name: 'ButtonVariantProps' }
    },
    {
      name: 'onclick',
      type: '(event: MouseEvent) => void',
      description: 'Called when the button is activated by pointer or keyboard.',
      source: { type: 'direct', name: 'ButtonProps' }
    },
    {
      name: 'label',
      type: 'string',
      required: true,
      description: 'Accessible name. Required — an icon-only button has nothing else to announce.',
      source: { type: 'direct', name: 'ButtonProps' }
    }
  ];
</script>

<Section marker="01" id="examples" title="Examples" subtitle="Rendering a generated prop table">
  <div class="flex flex-col gap-6">
    <InfoCard intent="info" title="The props come from the build, not from the page">
      <p>
        Every documentation page imports a generated <code>./api</code> module and passes
        <code>componentData.props</code> straight through. Hand-writing the array is for a demo like the
        one below — on a real page it would drift from the component within a release.
      </p>
    </InfoCard>

    <CodeExample
      title="A page's API section"
      description="What the section looks like on every component page: the generated props, inside a Section with a secondary intent so reference content reads differently from guide content. `types=` and the TypesReference below it are one feature — the prop is what turns a type name in the Type column into a link, and the section is what the link points at."
      language="svelte"
      code={`<script lang="ts">
  import { ApiReference, Section, TypesReference } from '@urbicon-ui/docs';
  import { componentData } from './api';
<\/script>

<Section marker="05" id="api" title="API Reference" intent="secondary">
  <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
</Section>

<TypesReference types={componentData?.types ?? []} />`}
    >
      <ApiReference props={sampleProps} />
    </CodeExample>

    <CodeExample
      title="Notes the generator cannot know"
      description="The usageNotes snippet renders above the table — for editorial guidance that belongs to the API as a whole rather than to any single prop."
      language="svelte"
      preview={false}
      code={`<ApiReference props={componentData.props} slotClasses={{ stats: 'hidden' }}>
  {#snippet usageNotes()}
    <p>Sizes below <code>md</code> are reserved for dense toolbars.</p>
  {/snippet}
</ApiReference>`}
    />
  </div>
</Section>
