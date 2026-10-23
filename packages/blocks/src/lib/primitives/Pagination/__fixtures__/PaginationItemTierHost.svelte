<script lang="ts">
  import type { InteractiveTier } from '#lib/utils/tier-context.js';
  import { setTierContext } from '#lib/utils/tier-context.js';
  import type { PaginationItemProps } from '..';
  import PaginationItem from '../PaginationItem.svelte';

  // What a Toolbar or ButtonGroup puts around its children. The context is set
  // from a component, so a `createRawSnippet` of plain HTML cannot supply it.
  let { tier = 'modify', ...item }: { tier?: InteractiveTier } & Omit<PaginationItemProps, 'tier'> =
    $props();

  setTierContext({
    get tier() {
      return tier;
    }
  });
</script>

<PaginationItem {...item} />
