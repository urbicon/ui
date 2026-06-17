<script lang="ts">
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';

  const categories: CalendarEventCategory[] = [
    { id: 'release', label: 'Release', color: '#8b5cf6' },
    { id: 'holiday', label: 'Feiertag', color: '#ef4444' },
    { id: 'vacation', label: 'Urlaub', color: '#06b6d4' }
  ];

  const events: CalendarEvent[] = [
    { id: 'ny', title: 'Neujahr', start: new Date(2026, 0, 1), categoryId: 'holiday' },
    { id: 'v1', title: 'v1.0 Release', start: new Date(2026, 0, 15), categoryId: 'release' },
    {
      id: 'ski',
      title: 'Skiurlaub',
      start: new Date(2026, 1, 14),
      end: new Date(2026, 1, 21),
      categoryId: 'vacation'
    },
    { id: 'v2', title: 'v2.0 Release', start: new Date(2026, 2, 20), categoryId: 'release' },
    {
      id: 'easter',
      title: 'Ostern',
      start: new Date(2026, 3, 5),
      end: new Date(2026, 3, 6),
      categoryId: 'holiday'
    },
    { id: 'may', title: 'Tag der Arbeit', start: new Date(2026, 4, 1), categoryId: 'holiday' },
    { id: 'v3', title: 'v3.0 Release', start: new Date(2026, 5, 10), categoryId: 'release' },
    {
      id: 'summer',
      title: 'Sommerurlaub',
      start: new Date(2026, 6, 20),
      end: new Date(2026, 7, 7),
      categoryId: 'vacation'
    },
    { id: 'v4', title: 'v4.0 Release', start: new Date(2026, 8, 15), categoryId: 'release' },
    { id: 'unity', title: 'Tag der Einheit', start: new Date(2026, 9, 3), categoryId: 'holiday' },
    { id: 'v5', title: 'v5.0 Release', start: new Date(2026, 11, 1), categoryId: 'release' },
    {
      id: 'xmas',
      title: 'Weihnachten',
      start: new Date(2026, 11, 24),
      end: new Date(2026, 11, 26),
      categoryId: 'holiday'
    }
  ];
</script>

<Calendar
  view="year"
  views={['month', 'year']}
  {events}
  {categories}
  showLegend
  defaultYear={2026}
  locale="de-DE"
/>
