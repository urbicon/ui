<script lang="ts">
  /**
   * A docs page small enough to assert on, in every shape the section registry
   * has to get right: an unnumbered playground whose stage holds a section,
   * numbered sections, one revealed by `{#if}` between two others, one nested
   * in another, one without a heading, a heading drawn by a snippet with a
   * `lang` of its own, and a `CodeExample` whose preview is a numbered section.
   *
   * `withoutLayout` drops the `DocsLayout`, i.e. the page's registry.
   */
  import CodeExample from '../../CodeExample/CodeExample.svelte';
  import DocsLayout from '../../DocsLayout/DocsLayout.svelte';
  import PlaygroundConfigurator from '../../PlaygroundConfigurator/PlaygroundConfigurator.svelte';
  import Section from '../Section.svelte';

  let {
    showCustomization = false,
    withoutLayout = false
  }: { showCustomization?: boolean; withoutLayout?: boolean } = $props();
</script>

{#snippet localizedTitle()}<span lang="de">API-Referenz</span>{/snippet}

{#snippet page()}
  <Section id="playground" title="Playground" titleHidden>
    <PlaygroundConfigurator componentName="Section" showHeader={false}>
      {#snippet children()}
        <Section marker id="stage-demo" title="On stage">stage body</Section>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <Section marker id="examples" title="Examples">
    <Section marker id="nested" title="Nested">nested body</Section>
    <CodeExample title="A numbered section" code="<Section marker />">
      <Section marker id="example-demo" title="Demo">demo body</Section>
    </CodeExample>
  </Section>

  {#if showCustomization}
    <Section marker id="customization" title="Customization">customization body</Section>
  {/if}

  <Section id="untitled">no heading here</Section>

  <Section marker id="api" titleSnippet={localizedTitle}>api body</Section>
  <Section marker id="installation" title="Installation">installation body</Section>
{/snippet}

{#if withoutLayout}
  {@render page()}
{:else}
  <DocsLayout title="Harness" showToc>
    {@render page()}
  </DocsLayout>
{/if}
