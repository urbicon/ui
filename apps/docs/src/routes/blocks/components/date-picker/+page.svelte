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
  import { DatePicker } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
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
      size: 'md',
      inputVariant: 'outlined',
      calendarVariant: 'default',
      clearable: true,
      showWeekNumbers: false,
      disabled: false,
      required: false
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

    return `<DatePicker${propsStr}  bind:value={selectedDate}
  label="Datum"
  locale="de-DE"
/>`;
  }
</script>

<SeoMeta
  title="DatePicker Component"
  description="Date picker with calendar popup. Supports single date and date range selection, validation constraints, clearable input, and multiple visual variants."
/>

<DocsPageLayout
  title="DatePicker"
  description="Date picker with calendar popup. Supports single date and date range selection, validation constraints, clearable input, and multiple visual variants."
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
      componentName="DatePicker"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'xs', value: 'xs' },
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'inputVariant',
          label: 'Input Variant',
          items: [
            { label: 'outlined', value: 'outlined' },
            { label: 'filled', value: 'filled' },
            { label: 'ghost', value: 'ghost' },
            { label: 'underline', value: 'underline' }
          ],
          defaultValue: 'outlined'
        },
        {
          type: 'dropdown',
          key: 'calendarVariant',
          label: 'Calendar Variant',
          items: [
            { label: 'default', value: 'default' },
            { label: 'bordered', value: 'bordered' },
            { label: 'ghost', value: 'ghost' }
          ],
          defaultValue: 'default'
        },
        { type: 'checkbox', key: 'clearable', label: 'Clearable', defaultValue: true },
        { type: 'checkbox', key: 'showWeekNumbers', label: 'Week Numbers', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false },
        { type: 'checkbox', key: 'required', label: 'Required', defaultValue: false }
      ]}
      values={{
        size: 'md',
        inputVariant: 'outlined',
        calendarVariant: 'default',
        clearable: true,
        showWeekNumbers: false,
        disabled: false,
        required: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="mx-auto max-w-xs">
          <DatePicker
            size={values.size}
            inputVariant={values.inputVariant}
            calendarVariant={values.calendarVariant}
            clearable={values.clearable}
            showWeekNumbers={values.showWeekNumbers}
            disabled={values.disabled}
            required={values.required}
            label="Datum"
            placeholder="Datum auswaehlen"
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
      code={`import { DatePicker, DateRangePicker } from '@urbicon-ui/blocks';
import type { DatePickerProps, DateRangePickerProps } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/date-picker/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
