<script lang="ts">
  import { Card } from '@urbicon-ui/blocks';

  /**
   * The "what this recipe does" list, which every recipe builds from the same
   * `features` array in its `meta.ts`.
   *
   * It existed 20 times as copied markup in two dialects: twelve pages used a
   * bordered card with a divided list, eight used a bare `<ul>` with a
   * hand-drawn check-mark SVG repeated per page. The card wins because it reads
   * the same in a wide column and in the narrow sidebar the eight used — and it
   * needs no icon per row, so eight inline SVGs went with it.
   */
  interface Props {
    features: readonly string[];
  }

  let { features }: Props = $props();
</script>

<Card variant="outlined">
  <ul class="divide-border-subtle divide-y">
    {#each features as feature (feature)}
      <li class="text-text-secondary px-4 py-3 text-sm">{feature}</li>
    {/each}
  </ul>
</Card>
