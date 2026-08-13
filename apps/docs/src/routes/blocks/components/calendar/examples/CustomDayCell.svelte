<!-- urbicon-ignore raw-tailwind-color — the emerald ramp IS the demo: a
     contribution-heatmap day cell, where four fixed opacity steps of one hue encode
     the count. A semantic token has one value and cannot express a scale. -->
<script lang="ts">
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, DayCellContext } from '@urbicon-ui/blocks';

  // Realistic activity data spread across the month
  const events: CalendarEvent[] = [
    { id: '1', title: 'Standup', start: new Date(2026, 2, 2) },
    { id: '2', title: 'Code Review', start: new Date(2026, 2, 3) },
    { id: '3', title: 'Standup', start: new Date(2026, 2, 3) },
    { id: '4', title: 'Standup', start: new Date(2026, 2, 4) },
    { id: '5', title: 'Planning', start: new Date(2026, 2, 5) },
    { id: '6', title: 'Standup', start: new Date(2026, 2, 5) },
    { id: '7', title: 'Review', start: new Date(2026, 2, 5) },
    { id: '8', title: 'Standup', start: new Date(2026, 2, 9) },
    { id: '9', title: 'Deep Work', start: new Date(2026, 2, 9) },
    { id: '10', title: 'Standup', start: new Date(2026, 2, 10) },
    { id: '11', title: 'Release', start: new Date(2026, 2, 10) },
    { id: '12', title: 'Hotfix', start: new Date(2026, 2, 10) },
    { id: '13', title: 'Monitoring', start: new Date(2026, 2, 10) },
    { id: '14', title: 'Standup', start: new Date(2026, 2, 11) },
    { id: '15', title: 'Standup', start: new Date(2026, 2, 12) },
    { id: '16', title: 'Retro', start: new Date(2026, 2, 12) },
    { id: '17', title: 'Standup', start: new Date(2026, 2, 16) },
    { id: '18', title: 'Sprint Review', start: new Date(2026, 2, 16) },
    { id: '19', title: 'Demo', start: new Date(2026, 2, 16) },
    { id: '20', title: 'Standup', start: new Date(2026, 2, 17) },
    { id: '21', title: 'Hackathon', start: new Date(2026, 2, 19) },
    { id: '22', title: 'Hackathon', start: new Date(2026, 2, 19) },
    { id: '23', title: 'Hackathon', start: new Date(2026, 2, 19) },
    { id: '24', title: 'Demo', start: new Date(2026, 2, 19) },
    { id: '25', title: 'Hackathon', start: new Date(2026, 2, 19) },
    { id: '26', title: 'Standup', start: new Date(2026, 2, 20) },
    { id: '27', title: 'Standup', start: new Date(2026, 2, 23) },
    { id: '28', title: 'Planning', start: new Date(2026, 2, 23) },
    { id: '29', title: 'Standup', start: new Date(2026, 2, 24) },
    { id: '30', title: 'Review', start: new Date(2026, 2, 25) },
    { id: '31', title: 'Standup', start: new Date(2026, 2, 25) },
    { id: '32', title: 'Deploy', start: new Date(2026, 2, 25) },
    { id: '33', title: 'Standup', start: new Date(2026, 2, 26) },
    { id: '34', title: 'Standup', start: new Date(2026, 2, 30) },
    { id: '35', title: 'Quarterly report', start: new Date(2026, 2, 31) },
    { id: '36', title: 'Deploy', start: new Date(2026, 2, 31) },
    { id: '37', title: 'Review', start: new Date(2026, 2, 31) }
  ];

  /** Map event count to a heatmap intensity level (0–4) */
  function heatLevel(count: number): number {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 3;
    return 4;
  }

  const heatBg = [
    '', // 0 – no bg
    'bg-emerald-500/15',
    'bg-emerald-500/30',
    'bg-emerald-500/50',
    'bg-emerald-500/75'
  ];

  // Heatmap ink, mode-aware via the CSS light-dark() function (darker emerald in
  // light mode, lighter in dark). This follows `color-scheme` natively — incl.
  // system mode, where there is no `.dark` class — so it needs no `dark:` override
  // (which the design linter flags and which would silently break in system mode).
  const heatText = [
    'text-text-primary', // 0 – no heat
    'text-[color:light-dark(var(--color-emerald-700),var(--color-emerald-300))]',
    'text-[color:light-dark(var(--color-emerald-800),var(--color-emerald-200))]',
    'text-[color:light-dark(var(--color-emerald-900),var(--color-emerald-100))]',
    'text-[color:light-dark(white,var(--color-emerald-950))]'
  ];
</script>

<div class="max-w-sm">
  <Calendar {events} showEventList showViewSwitcher={false} defaultMonth={2} defaultYear={2026}>
    {#snippet dayCell(ctx: DayCellContext)}
      {@const level = heatLevel(ctx.events.length)}
      <!-- A heatmap cell is read-only, so it renders as a div, not a button. -->
      <div
        class="flex h-10 w-full items-center justify-center rounded-md text-sm tabular-nums
          {ctx.isOutsideMonth ? 'opacity-20' : ''}
          {heatBg[level]}
          {ctx.isToday ? 'font-black underline decoration-2 underline-offset-2' : ''}
          {level > 0
          ? heatText[level]
          : ctx.isOutsideMonth
            ? 'text-text-quaternary'
            : 'text-text-primary'}"
      >
        {ctx.date.getDate()}
      </div>
    {/snippet}
  </Calendar>

  <!-- Heatmap legend -->
  <div class="mt-3 flex items-center justify-end gap-1.5 px-3">
    <span class="text-text-tertiary text-xs">Less</span>
    {#each [0, 1, 2, 3, 4] as lvl (lvl)}
      <span class="border-border-subtle size-3 rounded-sm border {heatBg[lvl] || 'bg-surface-base'}"
      ></span>
    {/each}
    <span class="text-text-tertiary text-xs">More</span>
  </div>
</div>
