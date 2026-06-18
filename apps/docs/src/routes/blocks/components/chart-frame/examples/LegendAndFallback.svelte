<script lang="ts">
  import { ChartFrame } from '@urbicon-ui/blocks';

  const data = [
    { label: 'Mon', value: 12 },
    { label: 'Tue', value: 19 },
    { label: 'Wed', value: 15 },
    { label: 'Thu', value: 24 },
    { label: 'Fri', value: 21 }
  ];
  const max = Math.max(...data.map((d) => d.value));
</script>

<!--
  `ariaLabel` names the chart image, `legend` renders HTML below the SVG, and
  `fallback` is visually hidden but read by screen readers — here a data table
  so the numbers are never lost to assistive tech.
-->
<ChartFrame height={220} ariaLabel="Daily revenue, Monday to Friday" class="max-w-md">
  {#snippet children({ innerWidth, innerHeight })}
    {@const gap = 8}
    {@const bw = (innerWidth - gap * (data.length - 1)) / data.length}
    {#each data as d, i (d.label)}
      {@const h = (d.value / max) * innerHeight}
      <rect
        x={i * (bw + gap)}
        y={innerHeight - h}
        width={bw}
        height={h}
        rx="3"
        class="fill-primary"
      />
    {/each}
  {/snippet}

  {#snippet legend()}
    <div class="text-text-secondary mt-2 flex items-center gap-1.5 text-xs">
      <span class="bg-primary inline-block size-2.5 rounded-[2px]"></span>
      Revenue (k€)
    </div>
  {/snippet}

  {#snippet fallback()}
    <table>
      <caption>Daily revenue, Monday to Friday</caption>
      <thead>
        <tr><th>Day</th><th>Revenue (k€)</th></tr>
      </thead>
      <tbody>
        {#each data as d (d.label)}
          <tr><td>{d.label}</td><td>{d.value}</td></tr>
        {/each}
      </tbody>
    </table>
  {/snippet}
</ChartFrame>
