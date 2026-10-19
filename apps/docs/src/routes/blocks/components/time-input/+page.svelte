<script lang="ts">
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import { TimeInput } from '@urbicon-ui/blocks';
  const relatedLinks = buildRelatedLinks(componentData);
</script>

<SeoMeta
  title="TimeInput Component"
  description="Segmented time-of-day field with per-segment arrow-key stepping and 12- or 24-hour display."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="TimeInput"
  description="A field for entering a time of day: hour, minute and optional seconds cells, stepped with the Arrow keys and shown in 12- or 24-hour. The bound value is a 24-hour string (HH:MM, or HH:MM:SS with seconds) once the time is complete, null while it is half-typed, and undefined while the field is empty."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { TimeInput } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('blocks/components/time-input/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
