<script lang="ts">
  import { ArrowLeftIcon, Badge } from '@urbicon-ui/blocks';
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
  <div class="flex flex-wrap gap-1.5">
    {#each meta.components as comp (comp)}
      {@const href = componentLinks[comp]}
      <!-- No `?? '#'`: a chip with no page is a plain badge, not a link that
           goes nowhere. `registry:lint` fails on an unresolvable chip anyway,
           so this branch is the honest rendering of a state the gate catches. -->
      {#if href}
        <a href={r(href)}>
          <Badge
            variant="outlined"
            intent="primary"
            size="sm"
            class="hover:bg-primary-subtle transition-colors">{comp}</Badge
          >
        </a>
      {:else}
        <Badge variant="outlined" intent="neutral" size="sm">{comp}</Badge>
      {/if}
    {/each}
  </div>
</header>
