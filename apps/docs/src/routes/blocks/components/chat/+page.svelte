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
  title="Chat Component"
  description="A full-height layout shell for a chat: a pinned header, a scrollable message body, and a pinned composer."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="Chat"
  description="A full-height layout shell for a chat: a pinned header, a scrollable message body, and a pinned composer. It holds no state of its own — the messages array lives in your component."
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
      Chat stacks an optional header, a <a href={resolve('/blocks/components/chat-message-list')}
        >ChatMessageList</a
      >
      body, and a
      <a href={resolve('/blocks/components/prompt-input')}>PromptInput</a>
      composer. The
      <a href={resolve('/ai/chat')}>live playground</a>
      shows the full streaming stack.
    </p>
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Chat, ChatMessageList, PromptInput } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('blocks/components/chat/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
