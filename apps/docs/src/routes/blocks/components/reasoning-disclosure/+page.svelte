<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import { ReasoningDisclosure, type ChatReasoningPart } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const streaming = Boolean(vals.streaming);
    const durationMs = Number(vals.durationMs ?? 0);
    const durationLine = !streaming && durationMs > 0 ? `, durationMs: ${durationMs}` : '';
    return `<ReasoningDisclosure
  reasoning={{ type: 'reasoning', text${durationLine} }}
  streaming={${streaming}}
/>`;
  }
</script>

<SeoMeta
  title="ReasoningDisclosure Component"
  description="A collapsed, muted disclosure for a model's thinking trace: a 'Thinking' label while it streams, 'Thought for Xs' once it settles."
/>

<DocsPageLayout
  title="ReasoningDisclosure"
  description="A collapsed, muted disclosure for a model's thinking trace: a 'Thinking' label while it streams, 'Thought for Xs' once it settles."
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
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <Section
    marker
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { ReasoningDisclosure } from '@urbicon-ui/blocks';
import type { ChatReasoningPart } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/reasoning-disclosure/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
