<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { ToolCallCard, type ChatToolCallPart } from '@urbicon-ui/blocks';
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
    { id: 'installation', title: 'Installation' }
  ];

  type ToolState = ChatToolCallPart['state'];

  // Build a representative tool-call part for the chosen lifecycle state — a
  // pending/running call has input only, complete adds output, error adds a
  // message.

  function codeGenerator(vals: Record<string, unknown>): string {
    const state = (vals.state as ToolState) ?? 'running';
    return `<ToolCallCard toolCall={call} />

<!-- where the consumer owns and updates \`call\` -->
<!-- call.state === '${state}' -->`;
  }
</script>

<SeoMeta
  title="ToolCallCard Component"
  description="Collapsible card that renders one agent tool call — a status header with the tool name and JSON input/output (or an error) in the body. Opens itself on failure."
/>

<DocsPageLayout
  title="ToolCallCard"
  description="Collapsible card that renders one agent tool call — a status header with the tool name and JSON input/output (or an error) in the body. Opens itself on failure."
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
      code={`import { ToolCallCard } from '@urbicon-ui/blocks';
import type { ChatToolCallPart } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/tool-call-card/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
