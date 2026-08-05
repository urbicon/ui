<script lang="ts" generics="T extends import('$lib/types/tableTypes').TableItem">
  /**
   * SPIKE §7.3 fixture — a component with a generic `source` prop, so the
   * type-boundary measurement runs against real Svelte markup, not just a
   * .ts call signature. Used by a THROWAWAY probe during the spike (error
   * texts recorded in Rev. 3); kept for the review's reproducibility.
   */
  import type { TableSource } from '../source';

  let { source }: { source: TableSource<T> } = $props();

  const label = $derived(Array.isArray(source) ? 'array' : 'object');
</script>

<p>{label}</p>
