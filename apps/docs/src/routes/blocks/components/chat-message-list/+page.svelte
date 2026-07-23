<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { Badge, Button, ChatMessageList, type ChatMessageData } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const relatedLinks = buildRelatedLinks(componentData);

  function seed(): ChatMessageData[] {
    const out: ChatMessageData[] = [];
    for (let i = 1; i <= 6; i++) {
      out.push(
        {
          id: `seed-${i}-q`,
          role: 'user',
          parts: [{ type: 'text', text: `Question ${i}: how does the follow-scroll behave?` }],
          status: 'complete'
        },
        {
          id: `seed-${i}-a`,
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: `Answer ${i}: while you sit at the bottom the list follows new content. Scroll up and it lets go — a jump-back pill appears with the count of what you missed.`
            }
          ],
          status: 'complete'
        }
      );
    }
    return out;
  }

  let listMessages = $state<ChatMessageData[]>(seed());
  let following = $state(true);
  let appendCounter = 0;

  function appendMessage() {
    appendCounter += 1;
    listMessages = [
      ...listMessages,
      {
        id: `append-${appendCounter}`,
        role: appendCounter % 2 === 1 ? 'assistant' : 'user',
        parts: [
          {
            type: 'text',
            text: `Appended message ${appendCounter}. If you were at the bottom the list followed me here; if you had scrolled up, the counter on the jump pill just ticked up instead.`
          }
        ],
        status: 'complete'
      }
    ];
  }

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'scroll-engine', title: 'Scroll engine', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
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
  <Section id="playground" intent="primary">
    <p class="text-text-secondary mb-6 text-sm leading-relaxed">
      Scroll to the bottom and press <strong>Append</strong> — the list follows. Now scroll up
      first, then append: following breaks (the badge flips to <em>paused</em>) and the jump-back
      pill shows how many messages you missed. Click the pill to re-stick. For streaming, tool calls
      and citations in motion, open the
      <a class="text-primary hover:underline" href={resolve('/ai/chat')}>live playground</a>.
    </p>
    <PlaygroundConfigurator
      showHeader={false}
      componentName="ChatMessageList"
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
        }
      ]}
      values={{ layout: 'bubble' }}
    >
      {#snippet children(values)}
        <div
          class="border-border-default rounded-contain mx-auto flex h-[26rem] max-w-2xl flex-col overflow-hidden border"
        >
          <div class="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
            <Badge intent={following ? 'success' : 'neutral'} variant="soft" size="sm">
              {following ? 'following' : 'paused'}
            </Badge>
            <Button size="sm" variant="outlined" class="ms-auto" onclick={appendMessage}>
              Append
            </Button>
          </div>
          <ChatMessageList
            messages={listMessages}
            layout={values.layout as 'bubble' | 'plain'}
            onStickChange={(stuck) => (following = stuck)}
            listLabel="Demo conversation"
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

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
