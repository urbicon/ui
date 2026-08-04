<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import {
    Badge,
    Chat,
    ChatMessageList,
    PromptInput,
    type ChatMessageData
  } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  let playgroundMessages = $state<ChatMessageData[]>([
    {
      id: 'chat-shell-1',
      role: 'user',
      parts: [{ type: 'text', text: 'What does the Chat shell actually do?' }],
      createdAt: new Date('2026-01-01T10:00:00'),
      status: 'complete'
    },
    {
      id: 'chat-shell-2',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'It is pure structure — a pinned **header**, a scrollable **body**, and a pinned **composer**. The `min-h-0` flex chain hands scrolling to the body so the page itself never scrolls.'
        }
      ],
      createdAt: new Date('2026-01-01T10:00:05'),
      status: 'complete'
    }
  ]);
  let submitCounter = 0;

  function playgroundSubmit(payload: { text: string }) {
    if (!payload.text) return;
    playgroundMessages = [
      ...playgroundMessages,
      {
        id: `chat-shell-user-${++submitCounter}`,
        role: 'user',
        parts: [{ type: 'text', text: payload.text }],
        createdAt: new Date(),
        status: 'complete'
      }
    ];
  }

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'anatomy', title: 'Anatomy' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="Chat Component"
  description="Full-height layout shell for a chat surface: a pinned header, a scrollable conversation body, and a pinned composer, with the min-h-0 flex discipline that keeps the page from scrolling."
/>

{#snippet shellHeader()}
  <div class="flex items-center gap-2 px-4 py-2.5">
    <span class="text-text-primary text-sm font-medium">Assistant</span>
    <Badge intent="success" variant="soft" size="sm">online</Badge>
  </div>
{/snippet}

{#snippet shellComposer()}
  <div class="p-3">
    <PromptInput placeholder="Message the assistant…" onSubmit={playgroundSubmit} />
  </div>
{/snippet}

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="Chat"
  description="Full-height layout shell for a chat surface: a pinned header, a scrollable conversation body, and a pinned composer. Pure structure — no state, no context — with the min-h-0 flex discipline that hands scrolling to the body so the page never scrolls."
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
      The shell composes a <a
        class="text-primary hover:underline"
        href={resolve('/blocks/components/chat-message-list')}>ChatMessageList</a
      >
      body with an optional header and
      <a class="text-primary hover:underline" href={resolve('/blocks/components/prompt-input')}
        >PromptInput</a
      >
      composer. Send a message to watch the body scroll while the composer stays pinned. For the complete
      streaming stack, open the
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
      code={`import { Chat, ChatMessageList, PromptInput } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/chat/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
