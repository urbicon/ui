<script lang="ts">
  import { Planner } from '@urbicon-ui/blocks';

  interface Slot {
    id: string;
    date: string;
    time: string;
    booked: boolean;
  }

  const slots: Slot[] = [
    { id: '1', date: '2026-06-15', time: '09:00', booked: true },
    { id: '2', date: '2026-06-15', time: '14:00', booked: false },
    { id: '3', date: '2026-06-16', time: '11:00', booked: false },
    { id: '4', date: '2026-06-18', time: '10:00', booked: true },
    { id: '5', date: '2026-06-18', time: '16:00', booked: false },
    { id: '6', date: '2026-06-19', time: '13:00', booked: false }
  ];

  let selectedDate = $state<Date | undefined>(new Date(2026, 5, 16));
</script>

<Planner
  view="week"
  items={slots}
  getDate={(s) => s.date}
  sort={(a, b) => a.time.localeCompare(b.time)}
  value={new Date(2026, 5, 15)}
  bind:selectedDate
  locale="en-US"
  slotClasses={{
    header: 'rounded-t-xl bg-surface-inverted px-3',
    headerTitle: 'text-text-inverted',
    navButton: 'text-text-inverted/70 hover:text-text-inverted hover:bg-white/10',
    cell: 'rounded-xl border-2 transition-all'
  }}
>
  {#snippet cell({ items, isSelected })}
    <div class={['flex flex-col gap-1', isSelected && 'font-medium']}>
      {#each items as slot (slot.id)}
        <span
          class={[
            'rounded-md px-2 py-1 text-sm tabular-nums',
            slot.booked
              ? 'bg-danger-subtle text-danger line-through'
              : 'bg-success-subtle text-success'
          ]}
        >
          {slot.time}
        </span>
      {/each}
    </div>
  {/snippet}
</Planner>
