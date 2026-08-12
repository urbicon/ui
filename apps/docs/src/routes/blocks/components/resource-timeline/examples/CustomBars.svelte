<script lang="ts">
  import { ResourceTimeline } from '@urbicon-ui/blocks';

  interface Stay {
    id: string;
    roomId: string;
    guest: string;
    firstNight: string;
    lastNight: string;
  }

  const rooms = [
    { id: 'cala-01', label: 'Cala 01', description: 'Garden Room' },
    { id: 'cala-07', label: 'Cala 07', description: 'Corner Room' },
    { id: 'cala-11', label: 'Cala 11', description: 'Suite' }
  ];

  const stays: Stay[] = [
    {
      id: 's1',
      roomId: 'cala-01',
      guest: 'Amaral',
      firstNight: '2026-06-10',
      lastNight: '2026-06-17'
    },
    {
      id: 's2',
      roomId: 'cala-07',
      guest: 'Bianchi',
      firstNight: '2026-06-13',
      lastNight: '2026-06-25'
    },
    {
      id: 's3',
      roomId: 'cala-11',
      guest: 'Marek',
      firstNight: '2026-06-17',
      lastNight: '2026-06-19'
    }
  ];
</script>

<ResourceTimeline
  size="lg"
  value={new Date(2026, 5, 15)}
  locale="en-US"
  resources={rooms}
  items={stays}
  getResourceId={(stay) => stay.roomId}
  getRange={(stay) => ({ start: stay.firstNight, end: stay.lastNight })}
  getLabel={(stay) => `${stay.guest}, ${stay.firstNight} to ${stay.lastNight}`}
>
  {#snippet span({ item, totalDays, isStart, isEnd })}
    <span class="truncate">
      {isStart ? '' : '… '}{item.guest} · {totalDays} nights{isEnd ? '' : ' …'}
    </span>
  {/snippet}
</ResourceTimeline>
