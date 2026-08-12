<script lang="ts">
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, DateCategory } from '@urbicon-ui/blocks';

  const categories: DateCategory[] = [
    { id: 'meeting', label: 'Meeting', color: '#8b5cf6' },
    { id: 'deadline', label: 'Deadline', color: '#ef4444' },
    { id: 'social', label: 'Social', color: '#06b6d4' },
    { id: 'health', label: 'Gesundheit', color: '#22c55e' }
  ];

  const events: CalendarEvent[] = [
    {
      id: '1',
      title: 'Sprint Planning',
      start: new Date(2026, 2, 2),
      categoryId: 'meeting',
      description: 'Sprint 14 planen'
    },
    {
      id: '2',
      title: 'Zahnarzt',
      start: new Date(2026, 2, 4),
      categoryId: 'health',
      helperText: '10:00 Uhr'
    },
    { id: '3', title: 'Design Review', start: new Date(2026, 2, 5), categoryId: 'meeting' },
    {
      id: '4',
      title: 'Release v3.0',
      start: new Date(2026, 2, 7),
      categoryId: 'deadline',
      description: 'Production Deployment'
    },
    { id: '5', title: 'Team Lunch', start: new Date(2026, 2, 10), categoryId: 'social' },
    {
      id: '6',
      title: 'Retro',
      start: new Date(2026, 2, 12),
      categoryId: 'meeting',
      description: 'Sprint 13 Retrospektive'
    },
    { id: '7', title: 'Projektabgabe', start: new Date(2026, 2, 14), categoryId: 'deadline' },
    { id: '8', title: 'Yoga', start: new Date(2026, 2, 16), categoryId: 'health' },
    { id: '9', title: 'Sprint Review', start: new Date(2026, 2, 16), categoryId: 'meeting' },
    {
      id: '10',
      title: 'Geburtstag Anna',
      start: new Date(2026, 2, 19),
      categoryId: 'social',
      description: 'Geschenk besorgen!'
    },
    { id: '11', title: 'Code Freeze', start: new Date(2026, 2, 21), categoryId: 'deadline' },
    { id: '12', title: 'Hackathon', start: new Date(2026, 2, 23), categoryId: 'social' },
    { id: '13', title: 'Sprint Planning', start: new Date(2026, 2, 24), categoryId: 'meeting' },
    {
      id: '14',
      title: 'Vorsorge',
      start: new Date(2026, 2, 26),
      categoryId: 'health',
      helperText: '14:30 Uhr'
    },
    { id: '15', title: 'Quartalsbericht', start: new Date(2026, 2, 31), categoryId: 'deadline' }
  ];

  let selectedDate = $state<Date | undefined>(undefined);
</script>

<div class="max-w-sm">
  <Calendar
    {events}
    {categories}
    bind:value={selectedDate}
    showEventList
    showLegend
    showWeekNumbers
    locale="de-DE"
    defaultMonth={2}
    defaultYear={2026}
    showViewSwitcher={false}
  />
</div>
