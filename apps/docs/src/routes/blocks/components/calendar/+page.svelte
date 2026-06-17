<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'api', title: 'API Reference', order: 4 },
    { id: 'installation', title: 'Installation', order: 5 }
  ];

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

  function codeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      variant: 'default',
      size: 'md',
      selectionMode: 'single',
      showWeekNumbers: false,
      showOutsideDays: true,
      fixedWeeks: false,
      eventPopover: false,
      showMiniCalendar: false,
      animated: true,
      disabled: false
    };

    const props = Object.entries(vals)
      .filter(([key, value]) => {
        if (value === null || value === undefined) return false;
        if (key in defaults && value === defaults[key]) return false;
        if (value === false) return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'boolean') return value ? key : '';
        if (typeof value === 'string') return `${key}="${value}"`;
        return `${key}={${JSON.stringify(value)}}`;
      })
      .filter(Boolean);

    const propsStr = props.length > 0 ? `\n  ${props.join('\n  ')}\n` : ' ';

    return `<Calendar${propsStr}  events={events}
  categories={categories}
  onEventClick={handleEventClick}
  showLegend
/>`;
  }
</script>

<SeoMeta
  title="Calendar Component"
  description="Feature-rich calendar with month, week, day, year, and agenda views. Supports events, time grid, drag & drop, recurrence, date range selection, and custom rendering."
/>

<DocsPageLayout
  title="Calendar"
  description="Feature-rich calendar with month, week, day, year, and agenda views. Supports events, time grid, drag & drop, recurrence, date range selection, and custom rendering."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Calendar"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'default', value: 'default' },
            { label: 'bordered', value: 'bordered' },
            { label: 'ghost', value: 'ghost' }
          ],
          defaultValue: 'default'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'selectionMode',
          label: 'Selection Mode',
          items: [
            { label: 'single', value: 'single' },
            { label: 'range', value: 'range' },
            { label: 'multiple', value: 'multiple' }
          ],
          defaultValue: 'single'
        },
        { type: 'checkbox', key: 'showWeekNumbers', label: 'Week Numbers', defaultValue: false },
        { type: 'checkbox', key: 'showOutsideDays', label: 'Outside Days', defaultValue: true },
        { type: 'checkbox', key: 'fixedWeeks', label: 'Fixed Weeks', defaultValue: false },
        { type: 'checkbox', key: 'eventPopover', label: 'Event Popover', defaultValue: false },
        { type: 'checkbox', key: 'showMiniCalendar', label: 'Mini Calendar', defaultValue: false },
        { type: 'checkbox', key: 'animated', label: 'Animated', defaultValue: true },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        variant: 'default',
        size: 'md',
        selectionMode: 'single',
        showWeekNumbers: false,
        showOutsideDays: true,
        fixedWeeks: false,
        eventPopover: false,
        showMiniCalendar: false,
        animated: true,
        disabled: false
      }}
      showHeader={false}
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
            locale="de-DE"
            defaultMonth={2}
            defaultYear={2026}
          />
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="03"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="04" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Calendar, CalendarHeader, CalendarGrid } from '@urbicon-ui/blocks';
import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/calendar/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
