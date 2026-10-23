<script lang="ts">
  import { Planner } from '@urbicon-ui/blocks';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import { componentData } from './api';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
</script>

<SeoMeta
  title="Planner Component"
  description="A date grid for planning: give it items, a getDate to bucket them onto days, and a cell snippet that renders each day. Use it for a meal plan, a shift roster, or booking slots."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  stability={componentData?.stability}
  title="Planner"
  description="A date grid for planning: give it items, a getDate to bucket them onto days, and a cell snippet that renders each day. Use it for a meal plan, a shift roster, or booking slots."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
>
  <Section id="playground" title="Playground" intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Planner } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('blocks/components/planner/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
