<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { ChatMessage, type ChatMessageData } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  const bodyText =
    'Here is the plan. The renderer parses the growing string into a **component tree** — no `{@html}` anywhere — so settled blocks stay cached and only the tail re-renders.\n\n1. Text parts flow through StreamingMarkdown\n2. Every link is checked against the URL policy\n3. `[1]` markers resolve to citation chips';

  function playgroundMessage(role: string): ChatMessageData {
    return {
      id: 'pg-message',
      role: role === 'user' || role === 'system' ? role : 'assistant',
      parts: [{ type: 'text', text: bodyText }],
      createdAt: new Date('2026-01-01T09:41:00'),
      status: 'complete'
    };
  }

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'part-dispatch', title: 'Part dispatch', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
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
  <Section id="playground" intent="primary">
    <p class="text-text-secondary mb-6 text-sm leading-relaxed">
      One message rendered on its own. Flip the layout between the tinted
      <code class="text-text-primary">bubble</code> and the document-like
      <code class="text-text-primary">plain</code> column, change the role to see the per-role tint
      and alignment, and hover the message to reveal the copy / regenerate bar. For the whole
      conversation in motion, open the
      <a class="text-primary hover:underline" href={resolve('/ai/chat')}>live playground</a>.
    </p>
    <PlaygroundConfigurator
      showHeader={false}
      componentName="ChatMessage"
      controls={[
        {
          type: 'dropdown',
          key: 'layout',
          label: 'Layout',
          items: [
            { label: 'bubble', value: 'bubble' },
            { label: 'plain', value: 'plain' }
          ],
          defaultValue: 'bubble'
        },
        {
          type: 'dropdown',
          key: 'density',
          label: 'Density',
          items: [
            { label: 'comfortable', value: 'comfortable' },
            { label: 'compact', value: 'compact' }
          ],
          defaultValue: 'comfortable'
        },
        {
          type: 'dropdown',
          key: 'role',
          label: 'Role',
          items: [
            { label: 'assistant', value: 'assistant' },
            { label: 'user', value: 'user' },
            { label: 'system', value: 'system' }
          ],
          defaultValue: 'assistant'
        }
      ]}
      values={{ layout: 'bubble', density: 'comfortable', role: 'assistant' }}
    >
      {#snippet children(values)}
        <div class="mx-auto w-full max-w-2xl">
          <ChatMessage
            message={playgroundMessage(String(values.role ?? 'assistant'))}
            layout={values.layout as 'bubble' | 'plain'}
            density={values.density as 'comfortable' | 'compact'}
            onRegenerate={() => {}}
          />
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

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
