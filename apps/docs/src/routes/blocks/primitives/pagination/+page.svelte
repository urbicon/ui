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
  import { Pagination } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];
</script>

<SeoMeta
  title="Pagination Component"
  description="Page navigation with customizable range, layouts, intents, and boundary control."
/>

<DocsPageLayout
  title="Pagination"
  description="Page navigation with customizable range, layouts, intents, and boundary control."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Pagination"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'number',
          key: 'currentPage',
          label: 'Current Page',
          min: 1,
          max: 20,
          defaultValue: 5
        },
        {
          type: 'number',
          key: 'totalPages',
          label: 'Total Pages',
          min: 1,
          max: 50,
          defaultValue: 12
        },
        {
          type: 'dropdown',
          key: 'layout',
          label: 'Layout',
          items: [
            { label: 'default', value: 'default' },
            { label: 'navigation', value: 'navigation' },
            { label: 'table', value: 'table' },
            { label: 'minimal', value: 'minimal' }
          ],
          defaultValue: 'default'
        },
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'outlined', value: 'outlined' },
            { label: 'filled', value: 'filled' },
            { label: 'ghost', value: 'ghost' }
          ],
          defaultValue: 'outlined'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'primary', value: 'primary' },
            { label: 'secondary', value: 'secondary' },
            { label: 'success', value: 'success' },
            { label: 'warning', value: 'warning' },
            { label: 'danger', value: 'danger' },
            { label: 'neutral', value: 'neutral' }
          ],
          defaultValue: 'primary'
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
          key: 'mint',
          label: 'Mint',
          items: [
            { label: 'none', value: 'none' },
            { label: 'scale', value: 'scale' },
            { label: 'ripple', value: 'ripple' },
            { label: 'glow', value: 'glow' }
          ],
          defaultValue: 'none'
        },
        {
          type: 'number',
          key: 'visiblePages',
          label: 'Visible Pages',
          min: 3,
          max: 9,
          step: 1,
          defaultValue: 5
        },
        { type: 'checkbox', key: 'showNumbers', label: 'Show Numbers', defaultValue: true },
        { type: 'checkbox', key: 'showPreviousNext', label: 'Prev/Next', defaultValue: true },
        { type: 'checkbox', key: 'showFirstLast', label: 'First/Last', defaultValue: false },
        { type: 'checkbox', key: 'showInfo', label: 'Show Info', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        currentPage: 5,
        totalPages: 12,
        layout: 'default',
        variant: 'outlined',
        intent: 'primary',
        size: 'md',
        mint: 'none',
        visiblePages: 5,
        showNumbers: true,
        showPreviousNext: true,
        showFirstLast: false,
        showInfo: false,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Pagination
          currentPage={values.currentPage}
          totalPages={values.totalPages}
          layout={values.layout}
          variant={values.variant}
          intent={values.intent}
          size={values.size}
          mint={values.mint}
          visiblePages={values.visiblePages}
          showNumbers={values.showNumbers}
          showPreviousNext={values.showPreviousNext}
          showFirstLast={values.showFirstLast}
          showInfo={values.showInfo}
          disabled={values.disabled}
          onPageChange={(p: number) => {
            values.currentPage = p;
          }}
        />
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Pagination } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/pagination/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
