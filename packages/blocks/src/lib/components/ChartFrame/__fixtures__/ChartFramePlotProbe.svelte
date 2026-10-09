<script lang="ts">
  // A `<ChartFrame>` whose one mark fills the plot box it is handed —
  // `[0, innerWidth] × [0, innerHeight]` in local coordinates — and carries the
  // rest of the plot as attributes, so a test reads the geometry the frame
  // guarantees its children rather than marks a chart derived from it.
  import type { ChartFrameProps } from '../index';
  import ChartFrame from '../ChartFrame.svelte';

  let props: Omit<ChartFrameProps, 'children'> = $props();
</script>

<ChartFrame {...props}>
  {#snippet children(plot)}
    <rect
      data-plot
      x="0"
      y="0"
      width={plot.innerWidth}
      height={plot.innerHeight}
      data-width={plot.width}
      data-height={plot.height}
      data-margin="{plot.margin.top} {plot.margin.right} {plot.margin.bottom} {plot.margin.left}"
    />
  {/snippet}
</ChartFrame>
