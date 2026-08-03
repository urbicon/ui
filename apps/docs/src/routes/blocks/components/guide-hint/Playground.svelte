<!--
  GuideHint shares its example with the Guide family.

  The nine Guide surfaces are one system, not a box of separately usable parts,
  so the documentation gives them a single page (`/blocks/components/guide`)
  and this directory holds only the generated `api.ts` for the catalog and
  llm.txt. The file you are reading is the pointer the landing hero follows:
  it globs every `Playground.svelte`, so clicking GuideHint lands on the same
  example the doc page shows, instead of an invented preview or none at all.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import GuidePlayground from '../guide/Playground.svelte';

  let props: PlaygroundHostProps = $props();
</script>

<GuidePlayground {...props} />
