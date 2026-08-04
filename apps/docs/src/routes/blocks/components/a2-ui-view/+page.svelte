<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import { A2UIView } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'concept', title: 'How it works' },
    { id: 'examples', title: 'Examples' },
    { id: 'integration', title: 'Integration' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];

  // Two clean catalog-conformant payloads for the playground. Both are what an
  // agent would emit as JSONL — a `createSurface` header, one `updateComponents`
  // tree of catalog components, and an `updateDataModel` seed. The consumer just
  // hands the accumulated array to A2UIView.

  function codeGenerator(vals: Record<string, unknown>): string {
    const streaming = vals.streaming === true;
    return `<!-- Wire A2UIView in as the 'a2ui' part renderer of a ChatMessage. -->
<ChatMessageList {messages} partRenderers={{ a2ui: a2uiPart }} />

{#snippet a2uiPart(part)}
  <A2UIView
    payload={part.payload}
    streaming={${streaming}}
    {urlPolicy}
    onAction={(event) => sendUserTurn(\`[ui-action] \${JSON.stringify(event)}\`)}
    onValidationError={(issues) => reportToAgent(issues)}
  />
{/snippet}`;
  }
</script>

<SeoMeta
  title="A2UIView Component"
  description="Renders a trusted-catalog A2UI (Agent-to-UI, v0.9.1 basic subset) payload into live, interactive Urbicon components — whitelist-only and fail-loud."
/>

<DocsPageLayout
  title="A2UIView"
  description="Renders a trusted-catalog A2UI (Agent-to-UI, v0.9.1 basic subset) payload into live, interactive Urbicon components — whitelist-only and fail-loud."
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
    marker="05"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker="06" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { A2UIView, a2uiSystemPrompt } from '@urbicon-ui/blocks';
import type { A2uiActionEvent, A2uiValidationIssue } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/a2-ui-view/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
