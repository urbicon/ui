<script lang="ts">
  import type { Snippet } from 'svelte';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import RecipeHeader from './RecipeHeader.svelte';
  import type { RecipeMeta } from './recipe-meta';

  /**
   * The recipe page frame: SEO tags, the shared header, and the column the
   * content lays out in. A recipe page opens with
   *
   *   <RecipeShell meta={recipeMeta}>
   *     <Section id="preview" …>   ← ONE CodeExample: live demo + its source
   *     <Section id="decisions" …> ← only what neither demo nor code can say
   *   </RecipeShell>
   *
   * and everything above the children comes from `meta.ts` — the SEO title and
   * description included, so the page head cannot drift from the cookbook card.
   *
   * `data-recipe-page` is the rooms skin's scope for the recipe stage: inside
   * it, a CodeExample's preview frame carries the same whisper of the room
   * colour the playground field has on a component page (rooms-docs.css § the
   * stage-frame rules). A recipe page has one primary stage — its live demo —
   * and the stamp lives here so no page can forget it.
   */
  interface Props {
    meta: RecipeMeta;
    children: Snippet;
  }

  let { meta, children }: Props = $props();
</script>

<SeoMeta title="{meta.title} Recipe" description={meta.description} />

<div class="mx-auto max-w-6xl px-6 py-12" data-recipe-page>
  <RecipeHeader {meta} />
  {@render children()}
</div>
