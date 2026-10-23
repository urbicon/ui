<script lang="ts">
  import { ResourceTimeline } from '@urbicon-ui/blocks';
  import { daysBetween, isoToDate } from '@urbicon-ui/blocks/date';

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

  // What a bar shows, built from the stay alone because `getLabel` sees only the
  // item. It opens the bar's accessible name: a name has to contain the text its
  // control shows (WCAG 2.5.3), or speech input cannot reach the bar by it.
  const barText = (stay: Stay) =>
    `${stay.guest} · ${daysBetween(isoToDate(stay.firstNight), isoToDate(stay.lastNight)) + 1} nights`;
</script>

<ResourceTimeline
  size="lg"
  value={new Date(2026, 5, 15)}
  locale="en-US"
  resources={rooms}
  items={stays}
  getResourceId={(stay) => stay.roomId}
  getRange={(stay) => ({ start: stay.firstNight, end: stay.lastNight })}
  getLabel={(stay) => `${barText(stay)}, ${stay.firstNight} to ${stay.lastNight}`}
>
  {#snippet span({ item, isStart, isEnd })}
    <span class="truncate">
      {isStart ? '' : '… '}{barText(item)}{isEnd ? '' : ' …'}
    </span>
  {/snippet}
</ResourceTimeline>
