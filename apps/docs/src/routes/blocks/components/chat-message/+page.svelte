<script lang="ts">
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
</script>

<SeoMeta
  title="ChatMessage Component"
  description="Renders one chat message: its ordered parts (markdown text, reasoning, tool calls, attachments) plus a citation footer, copy/regenerate actions, and an error/aborted alert with retry."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="ChatMessage"
  description="Renders one chat message and its ordered parts: markdown text, reasoning, tool calls, attachments, and a citation footer, with copy and regenerate actions and per-role styling."
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <p class="text-text-secondary mb-6 text-sm leading-relaxed">
      Change the layout, reply role, and density to see how a message renders. The
      <code class="text-text-primary">bubble</code> layout tints and aligns by role;
      <code class="text-text-primary">plain</code> is a full-width column. Hover a message to reveal
      its copy and regenerate bar. The
      <a href={resolve('/ai/chat')}>live playground</a>
      shows a full streaming conversation.
    </p>
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
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
      href={asset('blocks/components/chat-message/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
