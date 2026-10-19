<script lang="ts" module>
  /** What the harness renders; tests pass it as `$state` to change it mid-test. */
  export interface EdgeState {
    shape: 'repeat' | 'swap' | 'branches' | 'headless';
    page?: 'a' | 'b';
    flag?: boolean;
  }
</script>

<script lang="ts">
  /**
   * The page shapes the section registry meets beyond a plain page, one per
   * `shape`, each under its own `DocsLayout`:
   *
   * - `repeat`: a page that gives two sections one id.
   * - `swap`: a layout that outlives its pages and fades the old one out while
   *   the next renders, as a `+layout.svelte` with `{#key page.url.pathname}`
   *   does. Both pages have `examples` and `api`.
   * - `branches`: the two branches of an `{#if}` give their sections one id and
   *   slide, so the leaving one is still rendered while the other arrives.
   * - `headless`: titled sections inside a `<Section>` without a heading.
   */
  import { fade, slide } from 'svelte/transition';
  import DocsLayout from '../../DocsLayout/DocsLayout.svelte';
  import Section from '../Section.svelte';

  let { s }: { s: EdgeState } = $props();
</script>

{#snippet pageA()}
  <Section marker id="overview" title="A Overview">a</Section>
  <Section marker id="examples" title="A Examples">a</Section>
  <Section marker id="api" title="A API">a</Section>
{/snippet}

{#snippet pageB()}
  <Section marker id="examples" title="B Examples">b</Section>
  <Section marker id="api" title="B API">b</Section>
  <Section marker id="installation" title="B Installation">b</Section>
{/snippet}

<DocsLayout title="Edges" showToc>
  {#if s.shape === 'repeat'}
    <Section marker id="examples" title="Examples">x</Section>
    <Section marker id="usage" title="Usage">x</Section>
    <Section marker id="examples" title="Examples again">x</Section>
  {:else if s.shape === 'swap'}
    {#key s.page}
      <div out:fade={{ duration: 300 }}>
        {@render (s.page === 'b' ? pageB : pageA)()}
      </div>
    {/key}
  {:else if s.shape === 'branches'}
    <Section marker id="intro" title="Intro">x</Section>
    {#if s.flag}
      <div transition:slide><Section marker id="mode" title="Mode A">a</Section></div>
    {:else}
      <div transition:slide><Section marker id="mode" title="Mode B">b</Section></div>
    {/if}
    <Section marker id="end" title="End">x</Section>
  {:else}
    <Section marker id="intro" title="Intro">x</Section>
    <Section id="group">
      <Section marker id="grouped-a" title="Grouped A">a</Section>
      <Section marker id="grouped-b" title="Grouped B">b</Section>
    </Section>
    <Section marker id="end" title="End">x</Section>
  {/if}
</DocsLayout>
