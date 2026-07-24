<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { WeekMealPlan, MonthShiftPlan, CustomStyling } from './examples';

  import weekMealPlanCode from './examples/WeekMealPlan.svelte?raw';
  import monthShiftPlanCode from './examples/MonthShiftPlan.svelte?raw';
  import customStylingCode from './examples/CustomStyling.svelte?raw';
</script>

<!-- ─── Examples ─── -->
<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Weekly meal plan"
      description="The headline use case. Items bucket onto days by `getDate`, `sort` orders them within a cell, and the `cell` snippet renders your own markup. Because `cell` runs for empty days too, the “Add” button is available everywhere."
      code={weekMealPlanCode}
    >
      <WeekMealPlan />
    </CodeExample>

    <CodeExample
      title="Monthly shift plan"
      description="The same component in month view with a different domain type. Cells stay compact; weekend columns are tinted via highlightWeekend."
      code={monthShiftPlanCode}
    >
      <MonthShiftPlan />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker="02" id="customization" title="Customization">
  <div class="space-y-10">
    <CodeExample
      title="slotClasses + selected day"
      description="Restyle any slot (here the header and cells) via `slotClasses`, and track the active day with `bind:selectedDate` — `isSelected` reaches the cell snippet. Clicking a cell's body selects its day; clicks on interactive content keep their own behaviour."
      code={customStylingCode}
    >
      <CustomStyling />
    </CodeExample>

    <CodeExample
      title="Server-safe weeks"
      description="Planner and a SvelteKit load function agree on the same week because both use the Svelte-free `@urbicon-ui/blocks/date` subpath — no UTC drift between server and client."
      code={`// +page.server.ts
import { startOfWeek, endOfWeek, toIso } from '@urbicon-ui/blocks/date';

export async function load({ url }) {
  const ref = url.searchParams.get('w') ? new Date(url.searchParams.get('w')!) : new Date();
  const start = startOfWeek(ref, 1); // Monday
  const meals = await db.meals.between(toIso(start), toIso(endOfWeek(ref, 1)));
  return { meals, start: toIso(start) };
}`}
      language="typescript"
      preview={false}
    />
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section marker="03" id="accessibility" title="Accessibility">
  <div class="prose prose-sm max-w-none">
    <ul>
      <li>
        The grid uses the ARIA <code>grid</code> pattern: <code>role="grid"</code> wraps
        <code>row</code>/<code>columnheader</code>/<code>gridcell</code>, the active day carries
        <code>aria-selected</code>, and a roving <code>tabindex</code> keeps a single tab stop.
      </li>
      <li>
        <strong>Keyboard:</strong> arrow keys move the focused day, <kbd>Home</kbd>/<kbd>End</kbd>
        jump to the week edges, <kbd>PageUp</kbd>/<kbd>PageDown</kbd> step a month (<kbd>Shift</kbd>
        a year), and <kbd>Enter</kbd>/<kbd>Space</kbd> select. Navigation pulls the focus back into view
        by paging when it crosses the visible window.
      </li>
      <li>
        Interactive content inside a <code>cell</code> (buttons, links, inputs) keeps its own Enter/Space
        and click behaviour — grid navigation only fires from the cell itself, and only a click on the
        cell body selects the day.
      </li>
      <li>
        The localized view title is mirrored into an <code>aria-live="polite"</code> status region,
        so screen readers announce navigation. Focus rings use <code>focus-visible</code> only.
      </li>
      <li>
        Transitions and swipe respect <code>prefers-reduced-motion</code> (set
        <code>animated={false}</code> to opt out entirely).
      </li>
    </ul>
  </div>
</Section>
