<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset, resolve } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'api', title: 'API Reference', order: 2 },
    { id: 'installation', title: 'Installation', order: 3 }
  ];

  const DESC =
    'Range selection in two clicks — start and end date in one calendar popover, closing itself once both are set. Shares the DatePicker surface: same sizes, variants, constraints, and locale handling.';
</script>

<SeoMeta title="DateRangePicker Component" description={DESC} />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="DateRangePicker"
  description={DESC}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <Playground />
  </Section>

  <Section
    marker="02"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <Section marker="03" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { DateRangePicker } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/date-range-picker/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
