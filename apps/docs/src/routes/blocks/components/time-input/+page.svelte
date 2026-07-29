<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { TimeInput } from '@urbicon-ui/blocks';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'form-family', title: 'Date + Time', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];
</script>

<SeoMeta
  title="TimeInput Component"
  description="Segmented time-of-day field with per-segment arrow-key stepping and 12- or 24-hour display."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="TimeInput"
  description="Segmented time-of-day field — hour / minute (/ second) cells in one unified control, with per-segment Arrow-key stepping, digit auto-advance, and 12- or 24-hour display. The value is always a canonical 24-hour HH:MM string."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <Section
    marker="05"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="06" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { TimeInput } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/time-input/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
