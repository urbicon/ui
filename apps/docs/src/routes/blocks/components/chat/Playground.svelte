<!--
  Chat-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import {
    Badge,
    Chat,
    ChatMessageList,
    PromptInput,
    type ChatMessageData
  } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let messages = $state<ChatMessageData[]>([
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
    messages = [
      ...messages,
      {
        id: `chat-shell-user-${++submitCounter}`,
        role: 'user',
        parts: [{ type: 'text', text: payload.text }],
        createdAt: new Date(),
        status: 'complete'
      }
    ];
  }

  // `Chat` hat keine Variant-Achsen, die als Knopf taugen — die Schalter zeigen
  // seine eigentliche Leistung: dass Kopf und Composer optional sind.
  const controls = deriveControls(componentData, {
    pick: [],
    extra: [
      { type: 'checkbox', key: 'showHeader', label: 'Header', defaultValue: true },
      { type: 'checkbox', key: 'showComposer', label: 'Composer', defaultValue: true }
    ]
  });
</script>

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

<PlaygroundConfigurator
  componentName="Chat"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Chat, ChatMessageList } from '@urbicon-ui/blocks';"],
    state: { messages }
  }}
>
  {#snippet children(values)}
    <div
      class="border-border-default rounded-contain mx-auto h-[26rem] max-w-2xl overflow-hidden border"
    >
      <Chat
        header={values.showHeader ? shellHeader : undefined}
        composer={values.showComposer ? shellComposer : undefined}
      >
        <ChatMessageList {messages} listLabel="Demo conversation" />
      </Chat>
    </div>
  {/snippet}
</PlaygroundConfigurator>
