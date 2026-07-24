<script lang="ts">
  import { CodeExample, Section, ApiReference, InfoCard } from '@urbicon-ui/docs';
</script>

<Section id="examples" title="Examples" subtitle="Render a simple API table">
  <CodeExample
    title="Basic Usage"
    code={`<ApiReference props={[{ name: 'prop', type: 'string', description: 'Example' }]} />`}
  >
    <ApiReference props={[{ name: 'prop', type: 'string', description: 'Example' }]} />
  </CodeExample>
</Section>

<Section id="use-cases" title="Use Cases" subtitle="Where ApiReference shines">
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <InfoCard title="Component Docs">Automatic API tables for Props, Events and Slots</InfoCard>
    <InfoCard title="TypeScript Integration">Render TS interfaces as readable docs</InfoCard>
    <InfoCard title="Living Docs">Always up-to-date via code-sync</InfoCard>
    <InfoCard title="DX">Fast overview for reviewers and contributors</InfoCard>
  </div>

  <CodeExample
    title="Advanced Configuration"
    language="svelte"
    preview={false}
    code={`<ApiReference props={buttonProps} slotClasses={{ stats: 'hidden' }}>
  {#snippet usageNotes()}
    <p>Sizes below <code>md</code> are reserved for dense toolbars.</p>
  {/snippet}
</ApiReference>`}
  >
    <!-- no preview -->
  </CodeExample>
</Section>
