<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { CustomMarks, LegendAndFallback } from './examples';

  import customMarksCode from './examples/CustomMarks.svelte?raw';
  import legendFallbackCode from './examples/LegendAndFallback.svelte?raw';
</script>

<!-- ─── When to use ─── -->
<Section marker id="when-to-use" title="When to use">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      ChartFrame is the low-level shell every cartesian chart in the family is built on. It owns the
      parts that are tedious to get right — responsive width via a
      <code>ResizeObserver</code>, plot margins, the <code>viewBox</code>, and the accessible
      <code>role="img"</code> wrapper — and hands you the measured plot geometry so you only draw the
      marks.
    </p>
    <p>
      Reach for it <strong>only when the chart you need isn't already in the family</strong>. For
      the common cases prefer the ready-made charts — they handle scales, axes, legends and tooltips
      for you:
    </p>
    <ul>
      <li><code>LineChart</code> / <code>AreaChart</code> — trends over a continuous axis</li>
      <li><code>BarChart</code> — categorical comparisons</li>
      <li><code>DonutChart</code> — part-to-whole</li>
      <li><code>Sparkline</code> — a tiny inline trend with no axes</li>
    </ul>
    <p>
      Use ChartFrame directly for a bespoke mark type the family doesn't cover (a candlestick, a
      radial plot, a custom annotation layer) — you keep the responsive, accessible shell and own
      only the SVG inside it.
    </p>
  </div>
</Section>

<!-- ─── Examples ─── -->
<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Custom marks"
      description="The core pattern: the `children` snippet receives the plot geometry — `width`, `height`, `innerWidth`, `innerHeight` and `margin`. Map your data onto `innerWidth`/`innerHeight` and draw raw SVG, styling strokes and fills with the design-token utilities (`stroke-primary`, `stroke-border-default`) so theming and dark mode flow automatically."
      code={customMarksCode}
    >
      <CustomMarks />
    </CodeExample>

    <CodeExample
      title="Legend & accessible fallback"
      description="`ariaLabel` names the chart, the `legend` snippet renders HTML below the SVG, and the `fallback` snippet is rendered visually hidden for screen readers — a data table here, so the underlying numbers stay reachable."
      code={legendFallbackCode}
    >
      <LegendAndFallback />
    </CodeExample>

    <CodeExample
      title="Fixed width (SSR-stable)"
      description="Omit `width` for responsive measurement (the common case). Set it to opt out — the SVG renders at exactly that width on the server with no layout shift, useful for emails, PDfs or snapshot tests."
      code={`<ChartFrame width={480} height={200} ariaLabel="Static chart">
  {#snippet children({ innerWidth, innerHeight })}
    <!-- drawn at a deterministic 480×200, no ResizeObserver -->
  {/snippet}
</ChartFrame>`}
      language="svelte"
      preview={false}
    />
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="One named image">
      <p>
        The SVG carries <code>role="img"</code> with your <code>ariaLabel</code>, so assistive tech
        announces the chart as a single named image rather than reading out every path and number.
      </p>
    </Note>
    <Note title="Supply a fallback for the detail">
      <p>
        Because <code>role="img"</code> hides the SVG internals, supply a
        <code>fallback</code> snippet — rendered visually hidden — when the detail matters. A data
        <code>&lt;table&gt;</code> is the most robust choice.
      </p>
    </Note>
    <Note title="The legend is real HTML">
      <p>
        The <code>legend</code> snippet is ordinary HTML below the SVG, so its text is selectable and
        in the accessibility tree without extra work.
      </p>
    </Note>
    <Note title="Always pass an ariaLabel">
      <p>
        Always pass an <code>ariaLabel</code>. Without it the chart is an unlabelled image — fine
        only when an adjacent caption already conveys the same information.
      </p>
    </Note>
  </NoteList>
</Section>
