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
  import { ToolCallCard, type ChatToolCallPart } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'api', title: 'API Reference', order: 4 },
    { id: 'installation', title: 'Installation', order: 5 }
  ];

  type ToolState = ChatToolCallPart['state'];

  // Build a representative tool-call part for the chosen lifecycle state — a
  // pending/running call has input only, complete adds output, error adds a
  // message.
  function partFor(state: ToolState): ChatToolCallPart {
    const base = {
      type: 'tool-call' as const,
      id: 'get_weather-1',
      name: 'get_weather',
      input: { city: 'Berlin', unit: 'celsius' }
    };
    if (state === 'complete') {
      return { ...base, state, output: { temperature: 21, condition: 'Partly cloudy' } };
    }
    if (state === 'error') {
      return { ...base, state, errorMessage: 'Upstream timed out after 30s (ETIMEDOUT)' };
    }
    return { ...base, state };
  }

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
    <PlaygroundConfigurator
      componentName="ToolCallCard"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'state',
          label: 'State',
          items: [
            { label: 'pending', value: 'pending' },
            { label: 'running', value: 'running' },
            { label: 'complete', value: 'complete' },
            { label: 'error', value: 'error' }
          ],
          defaultValue: 'running'
        }
      ]}
      values={{ state: 'running' }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="mx-auto max-w-lg">
          {#key values.state}
            <ToolCallCard toolCall={partFor(values.state as ToolState)} />
          {/key}
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

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
