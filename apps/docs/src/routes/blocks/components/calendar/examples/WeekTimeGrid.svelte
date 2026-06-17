<script lang="ts">
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';

  const categories: CalendarEventCategory[] = [
    { id: 'meeting', label: 'Meeting', color: '#8b5cf6' },
    { id: 'focus', label: 'Fokuszeit', color: '#3b82f6' },
    { id: 'break', label: 'Pause', color: '#22c55e' }
  ];

  const monday = new Date(2026, 2, 9);

  const events: CalendarEvent[] = [
    {
      id: '1',
      title: 'Daily Standup',
      start: new Date(2026, 2, 9, 9, 0),
      end: new Date(2026, 2, 9, 9, 30),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '2',
      title: 'Deep Work: API',
      start: new Date(2026, 2, 9, 10, 0),
      end: new Date(2026, 2, 9, 12, 0),
      allDay: false,
      categoryId: 'focus'
    },
    {
      id: '3',
      title: 'Mittagspause',
      start: new Date(2026, 2, 9, 12, 0),
      end: new Date(2026, 2, 9, 13, 0),
      allDay: false,
      categoryId: 'break'
    },
    {
      id: '4',
      title: 'Design Review',
      start: new Date(2026, 2, 9, 14, 0),
      end: new Date(2026, 2, 9, 15, 0),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '5',
      title: 'Daily Standup',
      start: new Date(2026, 2, 10, 9, 0),
      end: new Date(2026, 2, 10, 9, 30),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '6',
      title: '1:1 mit Sarah',
      start: new Date(2026, 2, 10, 10, 0),
      end: new Date(2026, 2, 10, 10, 45),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '7',
      title: 'Frontend Sprint',
      start: new Date(2026, 2, 10, 11, 0),
      end: new Date(2026, 2, 10, 13, 0),
      allDay: false,
      categoryId: 'focus'
    },
    {
      id: '8',
      title: 'Code Review',
      start: new Date(2026, 2, 10, 14, 30),
      end: new Date(2026, 2, 10, 15, 30),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '9',
      title: 'Daily Standup',
      start: new Date(2026, 2, 11, 9, 0),
      end: new Date(2026, 2, 11, 9, 30),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '10',
      title: 'Sprint Planning',
      start: new Date(2026, 2, 11, 10, 0),
      end: new Date(2026, 2, 11, 12, 0),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '11',
      title: 'Deep Work: Tests',
      start: new Date(2026, 2, 11, 13, 0),
      end: new Date(2026, 2, 11, 16, 0),
      allDay: false,
      categoryId: 'focus'
    },
    {
      id: '12',
      title: 'Daily Standup',
      start: new Date(2026, 2, 12, 9, 0),
      end: new Date(2026, 2, 12, 9, 30),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '13',
      title: 'Architektur-Review',
      start: new Date(2026, 2, 12, 11, 0),
      end: new Date(2026, 2, 12, 12, 30),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '14',
      title: 'Deep Work: Refactoring',
      start: new Date(2026, 2, 12, 14, 0),
      end: new Date(2026, 2, 12, 17, 0),
      allDay: false,
      categoryId: 'focus'
    },
    {
      id: '15',
      title: 'Daily Standup',
      start: new Date(2026, 2, 13, 9, 0),
      end: new Date(2026, 2, 13, 9, 30),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '16',
      title: 'Sprint Review',
      start: new Date(2026, 2, 13, 10, 0),
      end: new Date(2026, 2, 13, 11, 0),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '17',
      title: 'Retro',
      start: new Date(2026, 2, 13, 11, 0),
      end: new Date(2026, 2, 13, 12, 0),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '18',
      title: 'Team-Event',
      start: new Date(2026, 2, 13, 15, 0),
      end: new Date(2026, 2, 13, 17, 0),
      allDay: false,
      categoryId: 'break'
    },
    {
      id: 'allday-1',
      title: 'Sprint 14',
      start: monday,
      end: new Date(2026, 2, 13),
      allDay: true,
      categoryId: 'focus'
    }
  ];
</script>

<Calendar
  view="week"
  showViewSwitcher={false}
  {events}
  {categories}
  showLegend
  showTimeGrid
  timeGridStartHour={8}
  timeGridEndHour={18}
  timeGridInterval={30}
  locale="de-DE"
  defaultMonth={2}
  defaultYear={2026}
/>
