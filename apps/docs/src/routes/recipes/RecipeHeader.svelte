<script lang="ts">
  import { ArrowLeftIcon } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
  import { componentLinks } from '$lib/component-links';
  import { r } from '$lib/route';

  /**
   * The header every recipe page opens with. It existed 22 times as copied
   * markup in two dialects — one wrapping a `<div>` around a hand-drawn SVG
   * arrow, one wrapping a `<header>` around a literal `←` — and half of them
   * hardcoded a title and description that `meta.ts` already carried.
   *
   * Everything shown here comes from that file, so the cookbook index, the
   * page heading and the SEO tags cannot drift apart again.
   *
   * The components list is a mono manifest line, not a row of badges. It used
   * to be outlined pills — up to twelve per recipe, wrapping three rows of
   * orange — which put the loudest element of the page on its least important
   * fact. The list is meta ("what this is built from"), and the docs already
   * have a register for meta: the quiet mono voice of the breadcrumb, the
   * code-panel toolbar and the playground labels. Same data, same links, same
   * `registry:lint` guarantees — only the volume changed.
   */
  interface Props {
    meta: {
      title: string;
      description: string;
      components: readonly string[];
    };
  }

  let { meta }: Props = $props();
</script>

<header class="mb-10">
  <a
    href={resolve('/recipes')}
    class="text-text-tertiary hover:text-text-primary mb-4 inline-flex items-center gap-1 text-sm transition-colors"
  >
    <ArrowLeftIcon class="h-4 w-4" />
    Back to Recipes
  </a>
  <h1 class="text-text-primary mb-2 text-3xl font-extrabold tracking-tight">{meta.title}</h1>
  <p class="text-text-secondary mb-4 max-w-2xl text-lg leading-relaxed">{meta.description}</p>
  <p class="font-meta text-text-tertiary flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs">
    <span class="tracking-[0.08em] uppercase">Built with</span>
    {#each meta.components as comp, i (comp)}
      {@const href = componentLinks[comp]}
      {#if i > 0}<span aria-hidden="true" class="text-text-quaternary select-none">·</span>{/if}
      <!-- No `?? '#'`: a name with no page is plain text, not a link that goes
           nowhere. `registry:lint` fails on an unresolvable name anyway, so
           this branch is the honest rendering of a state the gate catches. -->
      {#if href}
        <a
          href={r(href)}
          class="text-text-secondary hover:text-primary-text underline-offset-4 transition-colors hover:underline"
          >{comp}</a
        >
      {:else}
        <span class="text-text-secondary">{comp}</span>
      {/if}
    {/each}
  </p>
</header>
