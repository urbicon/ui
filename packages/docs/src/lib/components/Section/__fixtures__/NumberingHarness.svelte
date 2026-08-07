<script lang="ts">
  /**
   * The shape of a component documentation page, small enough to assert on:
   * an unnumbered playground, numbered sections around it, and one section
   * nested inside a stage — the case that must stay unnumbered.
   *
   * `withoutLayout` drops the `DocsLayout`, i.e. the numbering scope, which is
   * how a `<Section marker>` outside a docs page renders.
   */
  import DocsLayout from '../../DocsLayout/DocsLayout.svelte';
  import Section from '../Section.svelte';

  let {
    literalOnSecond,
    withoutLayout = false
  }: { literalOnSecond?: string; withoutLayout?: boolean } = $props();
</script>

{#snippet page()}
  <Section id="playground" title="Playground">
    <!-- Nested: a section inside a stage never claims a number. -->
    <Section marker id="nested-in-stage" title="Nested">nested body</Section>
  </Section>

  <Section marker id="examples" title="Examples">examples body</Section>
  <Section marker={literalOnSecond ?? true} id="customization" title="Customization">
    customization body
  </Section>
  <Section marker id="api" title="API Reference">api body</Section>
{/snippet}

{#if withoutLayout}
  {@render page()}
{:else}
  <DocsLayout title="Harness">
    {@render page()}
  </DocsLayout>
{/if}
