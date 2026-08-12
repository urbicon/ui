<script lang="ts">
  import { ResourceTimeline } from '@urbicon-ui/blocks';

  interface Stay {
    id: string;
    roomId: string;
    guest: string;
    firstNight: string;
    lastNight: string;
    state: 'confirmed' | 'option';
  }

  const rooms = [
    { id: 'duna-03', label: 'Duna 03', description: 'Room' },
    { id: 'duna-06', label: 'Duna 06', description: 'Garden Room' },
    { id: 'duna-09', label: 'Duna 09', description: 'Suite' }
  ];

  const states = [
    { id: 'confirmed', label: 'Confirmed', color: 'oklch(0.62 0.13 250)' },
    { id: 'option', label: 'Option', color: 'oklch(0.83 0.13 90)' }
  ];

  const stays: Stay[] = [
    {
      id: 's1',
      roomId: 'duna-03',
      guest: 'Varela',
      firstNight: '2026-06-15',
      lastNight: '2026-06-17',
      state: 'confirmed'
    },
    {
      id: 's2',
      roomId: 'duna-06',
      guest: 'Camacho',
      firstNight: '2026-06-17',
      lastNight: '2026-06-20',
      state: 'option'
    },
    {
      id: 's3',
      roomId: 'duna-09',
      guest: 'Pons',
      firstNight: '2026-06-16',
      lastNight: '2026-06-21',
      state: 'confirmed'
    }
  ];
</script>

<ResourceTimeline
  variant="ghost"
  value={new Date(2026, 5, 15)}
  locale="en-US"
  resources={rooms}
  items={stays}
  categories={states}
  getResourceId={(stay) => stay.roomId}
  getCategoryId={(stay) => stay.state}
  getRange={(stay) => ({ start: stay.firstNight, end: stay.lastNight })}
  getLabel={(stay) => stay.guest}
  slotClasses={{
    base: 'bg-surface-elevated border-border-subtle rounded-2xl border px-4 pb-3',
    header: 'border-b-0',
    headerTitle: 'text-text-tertiary text-xs tracking-[0.18em] uppercase',
    corner: 'bg-transparent',
    dayHeaderRow: 'border-b-0',
    dayHeaderWeekday: 'text-text-tertiary',
    dayHeaderDate: 'text-text-secondary font-normal',
    laneHeader: 'bg-transparent',
    laneLabel: 'text-2xs text-text-secondary tracking-[0.14em] uppercase',
    laneDescription: 'hidden',
    span: 'rounded-full shadow-[var(--blocks-shadow-sm)]',
    legend: 'justify-end'
  }}
/>
