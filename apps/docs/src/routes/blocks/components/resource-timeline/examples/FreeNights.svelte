<script lang="ts">
  import { ResourceTimeline } from '@urbicon-ui/blocks';
  import { toIso } from '@urbicon-ui/blocks/date';

  interface Stay {
    id: string;
    roomId: string;
    guest: string;
    from: string;
    /** Inclusive: the last night, not the check-out morning. */
    to: string;
  }

  const rooms = [
    { id: 'firn-02', label: 'Firn 02', description: 'Room' },
    { id: 'firn-05', label: 'Firn 05', description: 'Corner Room' },
    { id: 'firn-08', label: 'Firn 08', description: 'Suite' }
  ];

  const stays: Stay[] = [
    { id: 's1', roomId: 'firn-02', guest: 'Weber', from: '2026-06-15', to: '2026-06-17' },
    { id: 's2', roomId: 'firn-05', guest: 'Haldar', from: '2026-06-18', to: '2026-06-21' },
    { id: 's3', roomId: 'firn-08', guest: 'Ferreira', from: '2026-06-16', to: '2026-06-18' }
  ];

  let status = $state('');
</script>

<div class="w-full">
  <ResourceTimeline
    value={new Date(2026, 5, 15)}
    locale="en-US"
    resources={rooms}
    items={stays}
    getResourceId={(stay) => stay.roomId}
    getRange={(stay) => ({ start: stay.from, end: stay.to })}
    getLabel={(stay) => stay.guest}
    onCellClick={(room, date) => (status = `New booking: ${room.label} · ${toIso(date)}`)}
    onItemClick={(stay) => (status = `${stay.guest} is already booked here`)}
  >
    {#snippet cell({ isOccupied, isDisabled })}
      <!-- Painted on free nights only; the click itself is onCellClick's job, so
           the cell keeps its single tab stop and works from the keyboard too. -->
      {#if !isOccupied && !isDisabled}
        <span class="text-text-tertiary grid h-full place-items-center text-xs opacity-50">+</span>
      {/if}
    {/snippet}
  </ResourceTimeline>

  <p class="text-text-secondary mt-3 text-sm">
    {status || 'Click a free night, or press Enter on one.'}
  </p>
</div>
