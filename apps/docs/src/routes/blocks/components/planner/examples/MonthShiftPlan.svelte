<script lang="ts">
  import { Planner, Badge } from '@urbicon-ui/blocks';

  type Shift = 'early' | 'late' | 'night';
  interface Assignment {
    id: string;
    date: string;
    shift: Shift;
    person: string;
  }

  const SHIFT_META: Record<Shift, { label: string; intent: 'success' | 'warning' | 'primary' }> = {
    early: { label: 'Early', intent: 'success' },
    late: { label: 'Late', intent: 'warning' },
    night: { label: 'Night', intent: 'primary' }
  };
  const SHIFT_ORDER: Record<Shift, number> = { early: 0, late: 1, night: 2 };

  // A fortnight of shift assignments across June 2026.
  const assignments: Assignment[] = [
    { id: 'a', date: '2026-06-08', shift: 'early', person: 'Mara' },
    { id: 'b', date: '2026-06-08', shift: 'night', person: 'Jon' },
    { id: 'c', date: '2026-06-10', shift: 'late', person: 'Ada' },
    { id: 'd', date: '2026-06-11', shift: 'early', person: 'Leo' },
    { id: 'e', date: '2026-06-12', shift: 'night', person: 'Mara' },
    { id: 'f', date: '2026-06-15', shift: 'early', person: 'Ada' },
    { id: 'g', date: '2026-06-15', shift: 'late', person: 'Jon' },
    { id: 'h', date: '2026-06-18', shift: 'late', person: 'Leo' },
    { id: 'i', date: '2026-06-22', shift: 'night', person: 'Ada' },
    { id: 'j', date: '2026-06-25', shift: 'early', person: 'Mara' }
  ];
</script>

<Planner
  view="month"
  items={assignments}
  getDate={(a) => a.date}
  sort={(a, b) => SHIFT_ORDER[a.shift] - SHIFT_ORDER[b.shift]}
  value={new Date(2026, 5, 1)}
  locale="en-US"
  highlightWeekend
>
  {#snippet cell({ items })}
    <div class="flex flex-wrap gap-1">
      {#each items as a (a.id)}
        <Badge intent={SHIFT_META[a.shift].intent} size="sm">
          {SHIFT_META[a.shift].label} · {a.person}
        </Badge>
      {/each}
    </div>
  {/snippet}
</Planner>
