<script lang="ts">
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';

  const categories: CalendarEventCategory[] = [
    { id: 'work', label: 'Work', color: '#8b5cf6' },
    { id: 'personal', label: 'Personal', color: '#f97316' },
    { id: 'health', label: 'Health', color: '#22c55e' }
  ];

  const events: CalendarEvent[] = [
    {
      id: '1',
      title: 'Sprint Planning',
      start: new Date(2026, 2, 10),
      categoryId: 'work',
      description: 'Sprint 14 planning with the team'
    },
    {
      id: '2',
      title: 'Dentist',
      start: new Date(2026, 2, 11),
      categoryId: 'health',
      helperText: '10:00 AM'
    },
    { id: '3', title: 'Code Review', start: new Date(2026, 2, 11), categoryId: 'work' },
    {
      id: '4',
      title: 'Yoga class',
      start: new Date(2026, 2, 12),
      categoryId: 'health',
      helperText: '6:00 PM'
    },
    {
      id: '5',
      title: 'Release v3.0',
      start: new Date(2026, 2, 14),
      categoryId: 'work',
      description: 'Production Deployment'
    },
    {
      id: '6',
      title: "Max's birthday party",
      start: new Date(2026, 2, 15),
      categoryId: 'personal'
    },
    { id: '7', title: 'Retro', start: new Date(2026, 2, 16), categoryId: 'work' },
    {
      id: '8',
      title: 'Parent-teacher night',
      start: new Date(2026, 2, 18),
      categoryId: 'personal',
      helperText: '7:30 PM'
    },
    {
      id: '9',
      title: 'Hackathon',
      start: new Date(2026, 2, 20),
      categoryId: 'work',
      description: 'Build an AI prototype'
    },
    {
      id: '10',
      title: 'Hackathon',
      start: new Date(2026, 2, 21),
      categoryId: 'work',
      description: 'Demo & presentation'
    },
    {
      id: '11',
      title: 'Morning run',
      start: new Date(2026, 2, 22),
      categoryId: 'health',
      helperText: '7:00 AM'
    },
    { id: '12', title: 'Quarterly report', start: new Date(2026, 2, 25), categoryId: 'work' }
  ];
</script>

<div class="max-w-md">
  <Calendar
    view="agenda"
    showViewSwitcher={false}
    {events}
    {categories}
    showLegend
    agendaDays={21}
    locale="en-US"
    defaultDate={new Date(2026, 2, 10)}
  />
</div>
