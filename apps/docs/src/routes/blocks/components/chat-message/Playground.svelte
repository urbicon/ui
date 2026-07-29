<!--
  ChatMessage-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.

  Die Bühne zeigt **zwei** Nachrichten, nicht eine. Grund ist eine Konvention der
  Komponente: Nur `layout: 'bubble' × role: 'user'` bekommt einen Tint (plus
  `flex-row-reverse`), die Assistenten-Antwort ist bewusst grundlos, wie in jedem
  Chat-Client. An einer einzelnen Assistenten-Nachricht sah der `layout`-Regler
  deshalb tot aus — er wirkt erst im Nebeneinander.

  `codeGenerator` statt `codeSetup`, weil der Schnipsel einen *Verlauf* zeigt
  (`{#each}` über zwei Nachrichten), nicht ein einzelnes Tag. Die Daten kommen
  aus derselben Funktion, die die Bühne rendert, und werden gedruckt statt
  abgeschrieben — der Schnipsel kann also nicht von der Vorschau abweichen.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { ChatMessage, type ChatMessageData } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    serializeValue
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const questionText = 'How does the renderer keep a long streamed answer cheap?';

  const answerText =
    'Here is the plan. The renderer parses the growing string into a **component tree** — no `{@html}` anywhere — so settled blocks stay cached and only the tail re-renders.\n\n1. Text parts flow through StreamingMarkdown\n2. Every link is checked against the URL policy\n3. `[1]` markers resolve to citation chips';

  /**
   * Frage + Antwort. Die Frage ist immer die des Nutzers — sie stellt den
   * Kontrast her, an dem `layout` überhaupt sichtbar wird; der Regler bestimmt,
   * von wem die *Antwort* kommt.
   */
  function threadFor(replyRole: string): ChatMessageData[] {
    return [
      {
        id: 'pg-question',
        role: 'user',
        parts: [{ type: 'text', text: questionText }],
        createdAt: new Date('2026-01-01T09:40:00'),
        status: 'complete'
      },
      {
        id: 'pg-reply',
        role: replyRole === 'user' || replyRole === 'system' ? replyRole : 'assistant',
        parts: [{ type: 'text', text: answerText }],
        createdAt: new Date('2026-01-01T09:41:00'),
        status: 'complete'
      }
    ];
  }

  function regenerate() {}

  const controls = deriveControls(componentData, {
    pick: ['layout', 'density'],
    extra: [
      {
        type: 'dropdown',
        key: 'role',
        label: 'Reply role',
        items: [
          { label: 'assistant', value: 'assistant' },
          { label: 'user', value: 'user' },
          { label: 'system', value: 'system' }
        ],
        defaultValue: 'assistant'
      }
    ]
  });

  const axisDefaults = defaultValuesOf(controls);

  /**
   * Der Schnipsel. Die beiden Achsen stehen nur da, wenn sie vom Startwert
   * abweichen — dieselbe Regel, die `generateDefaultCode` für einzelne Tags
   * anwendet; hier von Hand, weil der Verlauf ein `{#each}` braucht, das der
   * Generator nicht bauen kann.
   */
  function threadSnippet(values: Record<string, unknown>): string {
    const thread = threadFor(String(values.role ?? 'assistant'));
    const axes = (['layout', 'density'] as const)
      .filter((key) => values[key] !== undefined && values[key] !== axisDefaults[key])
      .map((key) => `\n    ${key}="${values[key]}"`)
      .join('');
    return `<script lang="ts">
  import { ChatMessage } from '@urbicon-ui/blocks';

  const thread = ${serializeValue(thread, 2)};

  function regenerate() {
    // re-run the last assistant turn
  }
<\/script>

{#each thread as message (message.id)}
  <ChatMessage
    {message}${axes}
    onRegenerate={message.role === 'assistant' ? regenerate : undefined}
  />
{/each}`;
  }
</script>

<PlaygroundConfigurator
  componentName="ChatMessage"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeGenerator={threadSnippet}
>
  {#snippet children(values)}
    {@const thread = threadFor(String(values.role ?? 'assistant'))}
    <div class="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {#each thread as message (message.id)}
        <ChatMessage
          {message}
          layout={values.layout as 'bubble' | 'plain'}
          density={values.density as 'comfortable' | 'compact'}
          onRegenerate={message.role === 'assistant' ? regenerate : undefined}
        />
      {/each}
    </div>
  {/snippet}
</PlaygroundConfigurator>
