<script lang="ts">
  import { ChartFrame } from '@urbicon-ui/blocks';

  // Your own domain data — ChartFrame stays data-agnostic.
  const data = [12, 18, 14, 22, 19, 26, 24];
</script>

<!--
  ChartFrame measures its width and hands the drawable plot geometry to the
  `children` snippet. You map your data onto `innerWidth`/`innerHeight` and draw
  raw SVG marks — here a baseline, a trend line and data points.
-->
<ChartFrame height={200} ariaLabel="Weekly values" class="max-w-md">
  {#snippet children({ innerWidth, innerHeight })}
    {@const max = Math.max(...data)}
    {@const points = data.map((v, i) => ({
      x: (i / (data.length - 1)) * innerWidth,
      y: innerHeight - (v / max) * innerHeight
    }))}
    <line x1="0" y1={innerHeight} x2={innerWidth} y2={innerHeight} class="stroke-border-default" />
    <polyline
      points={points.map((p) => `${p.x},${p.y}`).join(' ')}
      fill="none"
      class="stroke-primary"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    {#each points as p (p.x)}
      <circle cx={p.x} cy={p.y} r="3.5" class="fill-primary" />
    {/each}
  {/snippet}
</ChartFrame>
