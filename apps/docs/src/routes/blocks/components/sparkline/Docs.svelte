<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Sparkline } from '@urbicon-ui/blocks';

  const up = [4, 6, 5, 8, 7, 10, 9, 12, 14];
  const down = [14, 12, 13, 9, 10, 7, 8, 5, 4];

  const rows = [
    { name: 'Acme Corp', trend: [12, 14, 13, 18, 22, 21, 26], color: 'var(--color-success)' },
    { name: 'Globex', trend: [30, 28, 26, 24, 20, 19, 16], color: 'var(--color-danger)' },
    { name: 'Initech', trend: [8, 9, 11, 10, 12, 14, 15], color: 'var(--color-primary)' }
  ];
</script>

<!-- ─── Examples ─── -->
<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    <code class="text-text-primary">data</code> is a plain
    <code class="text-text-primary">number[]</code>, scaled to fit the
    <code class="text-text-primary">width</code> and <code class="text-text-primary">height</code>
    you give it. It draws a line by default; add <code class="text-text-primary">area</code> to fill beneath
    it.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Line vs. area"
      description="A bare trend line, and the same data with `area` filled."
      isolate
      previewClass="flex w-full items-center justify-center gap-8 p-6"
    >
      <Sparkline data={up} />
      <Sparkline area data={up} />
    </CodeExample>

    <CodeExample
      title="In a stat card"
      description="A KPI number paired with its recent trend."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="border-border-subtle bg-surface-elevated w-56 rounded-2xl border p-4">
        <p class="text-text-tertiary text-xs">Revenue (7d)</p>
        <div class="mt-1 flex items-end justify-between gap-3">
          <span class="text-text-primary text-2xl font-semibold tabular-nums">€42k</span>
          <Sparkline area showEndPoint data={up} width={88} height={32} />
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="In table rows"
      description="Sparklines line up in a column to make per-row trends scannable. Color each line to encode direction."
      isolate
      previewClass="w-full p-6"
    >
      <table class="w-full max-w-md text-sm">
        <thead>
          <tr class="text-text-tertiary text-left text-xs">
            <th class="pb-2 font-medium">Account</th>
            <th class="pb-2 text-right font-medium">Trend</th>
          </tr>
        </thead>
        <tbody class="divide-border-hairline divide-y">
          {#each rows as row (row.name)}
            <tr>
              <td class="text-text-primary py-2">{row.name}</td>
              <td class="py-2 text-right">
                <Sparkline data={row.trend} color={row.color} width={96} height={22} />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Decorative by default">
      <p>
        A sparkline usually accompanies a number that already conveys the value, so it is
        <code class="text-text-primary">aria-hidden</code> by default to avoid redundant screen-reader
        noise.
      </p>
    </Note>
    <Note title="Opt-in labelling">
      <p>
        When the trend is the only information present, pass
        <code class="text-text-primary">ariaLabel</code> — the sparkline then exposes
        <code class="text-text-primary">role="img"</code> with that label (e.g. "Revenue trending up over
        7 days").
      </p>
    </Note>
  </NoteList>
</Section>
