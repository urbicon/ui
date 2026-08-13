<script lang="ts">
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';

  const categories: CalendarEventCategory[] = [
    { id: 'conf', label: 'Conference', color: '#8b5cf6' },
    { id: 'vacation', label: 'Vacation', color: '#06b6d4' },
    { id: 'sprint', label: 'Sprint', color: '#f97316' },
    { id: 'deadline', label: 'Deadline', color: '#ef4444' }
  ];

  const events: CalendarEvent[] = [
    {
      id: '1',
      title: 'SvelteConf',
      start: new Date(2026, 2, 5),
      end: new Date(2026, 2, 7),
      categoryId: 'conf',
      description: 'Three-day Svelte conference in Berlin'
    },
    {
      id: '2',
      title: 'Sprint 14',
      start: new Date(2026, 2, 9),
      end: new Date(2026, 2, 20),
      categoryId: 'sprint'
    },
    {
      id: '3',
      title: 'Ski trip',
      start: new Date(2026, 2, 14),
      end: new Date(2026, 2, 21),
      categoryId: 'vacation',
      description: 'Zillertal'
    },
    { id: '4', title: 'Code Freeze', start: new Date(2026, 2, 18), categoryId: 'deadline' },
    {
      id: '5',
      title: 'Hackathon',
      start: new Date(2026, 2, 23),
      end: new Date(2026, 2, 24),
      categoryId: 'conf'
    },
    {
      id: '6',
      title: 'Release Week',
      start: new Date(2026, 2, 25),
      end: new Date(2026, 2, 27),
      categoryId: 'sprint',
      description: 'Deployment & Monitoring'
    }
  ];

  let selectedDate = $state<Date | undefined>(undefined);
</script>

<div class="max-w-md">
  <Calendar
    {events}
    {categories}
    bind:value={selectedDate}
    showEventList
    showLegend
    eventPopover
    locale="de-DE"
    defaultMonth={2}
    defaultYear={2026}
    showViewSwitcher={false}
  />
</div>
