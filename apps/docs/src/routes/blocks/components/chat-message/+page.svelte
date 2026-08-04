<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import { ChatMessage, type ChatMessageData } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  ('Here is the plan. The renderer parses the growing string into a **component tree** — no `{@html}` anywhere — so settled blocks stay cached and only the tail re-renders.\n\n1. Text parts flow through StreamingMarkdown\n2. Every link is checked against the URL policy\n3. `[1]` markers resolve to citation chips');

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'part-dispatch', title: 'Part dispatch' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="ChatMessage Component"
  description="Renders one chat message: its ordered parts (markdown text, reasoning, tool calls, attachments) plus a citation footer, copy/regenerate actions, and an error/aborted alert with retry."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="ChatMessage"
  description="Renders one message and its ordered parts — markdown text via StreamingMarkdown, reasoning, tool-call status, attachment chips, and a deduplicated citation footer — with a hover-revealed copy/regenerate bar and an error/aborted alert. bubble tints and aligns per role; plain is a document-like full-width column."
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
    <p class="text-text-secondary mb-6 text-sm leading-relaxed">
      One message rendered on its own. Flip the layout between the tinted
      <code class="text-text-primary">bubble</code> and the document-like
      <code class="text-text-primary">plain</code> column, change the role to see the per-role tint
      and alignment, and hover the message to reveal the copy / regenerate bar. For the whole
      conversation in motion, open the
      <a class="text-primary hover:underline" href={resolve('/ai/chat')}>live playground</a>.
    </p>
    <Playground />
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { ChatMessage } from '@urbicon-ui/blocks';
import type {
  ChatMessageData,
  ChatMessagePart,
  ChatToolCallPart,
  ChatReasoningPart,
  CitationSource
} from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/chat-message/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
