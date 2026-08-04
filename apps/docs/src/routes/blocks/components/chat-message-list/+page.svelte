<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import { ChatMessageList, type ChatMessageData } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'scroll-engine', title: 'Scroll engine' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="ChatMessageList Component"
  description="Scrollable conversation log with a stick-to-bottom engine: follows streaming content while you're at the bottom, breaks off on upward scroll, offers a jump-back pill with a new-message counter, and anchors the scroll position when older history is prepended."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="ChatMessageList"
  description="Scrollable conversation log with a stick-to-bottom engine — follows streaming content while the reader is at the bottom, breaks off on upward scroll, offers a jump-back pill with a new-message counter, and anchors the scroll position when older history is prepended. Announces generation start and the settled answer to screen readers once, not per token."
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
      Scroll to the bottom and press <strong>Append</strong> — the list follows. Now scroll up
      first, then append: following breaks (the badge flips to <em>paused</em>) and the jump-back
      pill shows how many messages you missed. Click the pill to re-stick. For streaming, tool calls
      and citations in motion, open the
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
      code={`import { ChatMessageList } from '@urbicon-ui/blocks';
import type { ChatMessageData, ChatMessageListItemContext } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/chat-message-list/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
