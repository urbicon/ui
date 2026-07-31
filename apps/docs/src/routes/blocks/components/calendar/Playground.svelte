<!--
  Calendar-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const demoCategories: CalendarEventCategory[] = [
    { id: 'meeting', label: 'Meeting', color: '#8b5cf6' },
    { id: 'deadline', label: 'Deadline', color: '#ef4444' },
    { id: 'focus', label: 'Fokuszeit', color: '#3b82f6' },
    { id: 'social', label: 'Social', color: '#06b6d4' }
  ];

  const demoEvents: CalendarEvent[] = [
    {
      id: '1',
      title: 'Sprint Planning',
      start: new Date(2026, 2, 2),
      categoryId: 'meeting',
      description: 'Sprint 14 Planung'
    },
    { id: '2', title: 'Design Review', start: new Date(2026, 2, 5), categoryId: 'meeting' },
    { id: '3', title: 'Release v3.0', start: new Date(2026, 2, 7), categoryId: 'deadline' },
    {
      id: '4',
      title: 'Deep Work',
      start: new Date(2026, 2, 9, 10, 0),
      end: new Date(2026, 2, 9, 12, 0),
      allDay: false,
      categoryId: 'focus'
    },
    { id: '5', title: 'Team Lunch', start: new Date(2026, 2, 10), categoryId: 'social' },
    {
      id: '6',
      title: 'Standup',
      start: new Date(2026, 2, 10, 9, 0),
      end: new Date(2026, 2, 10, 9, 30),
      allDay: false,
      categoryId: 'meeting'
    },
    {
      id: '7',
      title: '1:1 Sarah',
      start: new Date(2026, 2, 11, 14, 0),
      end: new Date(2026, 2, 11, 15, 0),
      allDay: false,
      categoryId: 'meeting'
    },
    { id: '8', title: 'Retro', start: new Date(2026, 2, 12), categoryId: 'meeting' },
    { id: '9', title: 'Code Freeze', start: new Date(2026, 2, 14), categoryId: 'deadline' },
    {
      id: '10',
      title: 'Konferenz',
      start: new Date(2026, 2, 16),
      end: new Date(2026, 2, 18),
      categoryId: 'social',
      description: 'SvelteConf Berlin'
    },
    { id: '11', title: 'Sprint Review', start: new Date(2026, 2, 19), categoryId: 'meeting' },
    {
      id: '12',
      title: 'Hackathon',
      start: new Date(2026, 2, 23),
      end: new Date(2026, 2, 24),
      categoryId: 'social'
    },
    { id: '13', title: 'Quartalsbericht', start: new Date(2026, 2, 25), categoryId: 'deadline' },
    { id: '14', title: 'Sprint Planning', start: new Date(2026, 2, 26), categoryId: 'meeting' },
    { id: '15', title: 'Go Live', start: new Date(2026, 2, 31), categoryId: 'deadline' }
  ];

  function handleEventClick(event: CalendarEvent) {
    alert(`Event: ${event.title}${event.description ? `\n${event.description}` : ''}`);
  }

  const controls = deriveControls(componentData, {
    pick: [
      'variant',
      'size',
      'selectionMode',
      'showWeekNumbers',
      'showOutsideDays',
      'fixedWeeks',
      'eventPopover',
      'showMiniCalendar',
      'animated',
      'disabled'
    ],
    overrides: {
      selectionMode: { label: 'Selection Mode' },
      showWeekNumbers: { label: 'Week Numbers' },
      showOutsideDays: { label: 'Outside Days', defaultValue: true },
      fixedWeeks: { label: 'Fixed Weeks' },
      eventPopover: { label: 'Event Popover' },
      showMiniCalendar: { label: 'Mini Calendar' },
      animated: { defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Calendar"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Calendar } from '@urbicon-ui/blocks';"],
    consts: { events: demoEvents, categories: demoCategories },
    bind: ['events', 'categories']
  }}
>
  {#snippet children(values)}
    <div class="w-full">
      <Calendar
        variant={values.variant}
        size={values.size}
        selectionMode={values.selectionMode}
        showWeekNumbers={values.showWeekNumbers}
        showOutsideDays={values.showOutsideDays}
        fixedWeeks={values.fixedWeeks}
        eventPopover={values.eventPopover}
        showMiniCalendar={values.showMiniCalendar}
        animated={values.animated}
        disabled={values.disabled}
        events={demoEvents}
        categories={demoCategories}
        onEventClick={handleEventClick}
        showLegend
        showEventList
        defaultDate={new Date(2026, 2, 9)}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
