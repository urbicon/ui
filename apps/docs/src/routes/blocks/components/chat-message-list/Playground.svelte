<!--
  ChatMessageList-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Badge, Button, ChatMessageList, type ChatMessageData } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

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

  const controls = deriveControls(componentData, {
    pick: ['layout'],
    overrides: {
      layout: {
        type: 'dropdown',
        label: 'Layout',
        items: [
          { label: 'bubble', value: 'bubble' },
          { label: 'plain', value: 'plain' }
        ],
        defaultValue: 'bubble'
      }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="ChatMessageList"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { ChatMessageList } from '@urbicon-ui/blocks';"],
    state: { messages: listMessages },
    bind: ['messages']
  }}
>
  {#snippet children(values)}
    <div
      class="border-border-default rounded-contain mx-auto flex h-[26rem] max-w-2xl flex-col overflow-hidden border"
    >
      <div class="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
        <Badge intent={following ? 'success' : 'neutral'} variant="soft" size="sm">
          {following ? 'following' : 'paused'}
        </Badge>
        <Button size="sm" variant="outlined" class="ms-auto" onclick={appendMessage}>Append</Button>
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
