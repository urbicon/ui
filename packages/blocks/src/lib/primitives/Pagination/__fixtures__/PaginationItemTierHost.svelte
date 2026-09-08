<script lang="ts">
  import { setTierContext } from '$lib/utils/tier-context';
  import type { InteractiveTier } from '$lib/utils/tier-context';
  import PaginationItem from '../PaginationItem.svelte';
  import type { PaginationItemProps } from '..';

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
