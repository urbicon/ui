<script lang="ts">
  import { type ChatToolCallPart, ToolCallCard } from '@urbicon-ui/blocks';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { asset, resolve } from '$app/paths';
  import { componentData } from './api';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';

  const relatedLinks = buildRelatedLinks(componentData);

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
  description="A collapsible card for one agent tool call: a status header with the tool name, and JSON input/output (or an error) in the body. It starts expanded when the call fails."
/>

<DocsPageLayout
  title="ToolCallCard"
  description="A collapsible card for one agent tool call: a status header with the tool name, and JSON input/output (or an error) in the body. It starts expanded when the call fails."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
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
      href={asset('blocks/components/tool-call-card/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
