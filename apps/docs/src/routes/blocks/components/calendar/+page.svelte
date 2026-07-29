<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'api', title: 'API Reference', order: 4 },
    { id: 'installation', title: 'Installation', order: 5 }
  ];

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
    <Playground />
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
</DocsPageLayout>
