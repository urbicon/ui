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
  import { ReasoningDisclosure, type ChatReasoningPart } from '@urbicon-ui/blocks';
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

  const sampleText = `The user wants a range, not a single date.

- \`DatePicker\` binds one \`Date\`; the range preset keeps one popover for both bounds.
- I'll point them at \`mode="range"\` and the \`onValueChange\` shape.`;

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
  description="Collapsed, muted disclosure for a model's thinking trace — a pulsing 'Thinking' label while streaming, 'Thought for Xs' once settled, rendered through StreamingMarkdown."
/>

<DocsPageLayout
  title="ReasoningDisclosure"
  description="Collapsed, muted disclosure for a model's thinking trace — a pulsing 'Thinking' label while streaming, 'Thought for Xs' once settled, rendered through StreamingMarkdown."
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
      componentName="ReasoningDisclosure"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        { type: 'checkbox', key: 'streaming', label: 'Streaming', defaultValue: false },
        {
          type: 'number',
          key: 'durationMs',
          label: 'Duration (ms)',
          min: 0,
          max: 60000,
          step: 100,
          defaultValue: 4200
        }
      ]}
      values={{ streaming: false, durationMs: 4200 }}
      showHeader={false}
    >
      {#snippet children(values)}
        {@const streaming = Boolean(values.streaming)}
        {@const durationMs = Number(values.durationMs ?? 0)}
        <div class="mx-auto max-w-lg">
          <ReasoningDisclosure
            reasoning={{
              type: 'reasoning',
              text: sampleText,
              durationMs: durationMs > 0 ? durationMs : undefined
            } as ChatReasoningPart}
            {streaming}
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

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
