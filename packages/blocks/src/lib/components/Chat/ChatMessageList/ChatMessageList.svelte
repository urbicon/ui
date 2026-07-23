<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import ArrowDownIconDefault from '$lib/icons/ArrowDownIcon.svelte';
  import MessageSquareIconDefault from '$lib/icons/MessageSquareIcon.svelte';
  import { Badge } from '$lib/primitives/Badge';
  import { EmptyState } from '../../EmptyState';
  import type { ChatMessageData, ChatMessageStatus } from '../chat.types';
  import ChatMessage from '../ChatMessage/ChatMessage.svelte';
  import { chatMessageListVariants } from './chat-message-list.variants';
  import {
    appendedCount,
    classifyTransition,
    type ListIdSnapshot,
    type ListTransition,
    resolveScrollIntent
  } from './chat-scroll';
  import type { ChatMessageListProps } from './index';

  const ArrowDownIcon = resolveIcon('arrowDown', ArrowDownIconDefault);
  const MessageSquareIcon = resolveIcon('messageSquare', MessageSquareIconDefault);

  let {
    messages,
    message: messageSnippet,
    empty,
    urlPolicy,
    partRenderers,
    layout,
    density,
    onRegenerate,
    onRetry,
    onStickChange,
    listLabel = 'Conversation',
    scrollToBottomLabel = 'Scroll to bottom',
    newMessagesLabel = 'New messages',
    generatingLabel = 'Generating response…',
    errorLabel = 'Something went wrong',
    abortedLabel = 'Generation stopped',
    emptyTitle = 'No messages yet',
    emptyDescription,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ChatMessageListProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const styles = $derived(chatMessageListVariants({}));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'ChatMessageList', preset, {}, slotClassesProp)
  );

  function slot(name: keyof typeof styles, extra?: string | false): string {
    const overrides = [slotClasses?.[name], extra].filter(Boolean).join(' ');
    if (unstyled) return overrides;
    return styles[name]({ class: overrides });
  }

  // ── Stick state ──────────────────────────────────────────────────────────
  // `stuck` = the list follows growing content. See chat-scroll.ts for the
  // direction/proximity model that classifies scroll events without any
  // "programmatic scroll" suppression flag.
  let viewportRef = $state<HTMLDivElement>();
  let contentRef = $state<HTMLDivElement>();
  let stuck = $state(true);
  let newCount = $state(0);
  let lastScrollTop = 0;

  const showJumpButton = $derived(!stuck && messages.length > 0);

  function scrollNow(behavior: ScrollBehavior = 'instant') {
    const el = viewportRef;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  /**
   * Scroll to the newest message and resume following. Exposed on the
   * instance (`bind:this`) for consumer-driven jumps.
   */
  export function scrollToBottom(behavior: ScrollBehavior = 'instant') {
    setStuck(true);
    scrollNow(behavior);
  }

  function setStuck(next: boolean) {
    if (stuck === next) return;
    stuck = next;
    if (next) newCount = 0;
    onStickChange?.(next);
  }

  function handleScroll() {
    const el = viewportRef;
    if (!el) return;
    const snapshot = {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight
    };
    const intent = resolveScrollIntent(snapshot, lastScrollTop);
    lastScrollTop = snapshot.scrollTop;
    if (intent === 'stick') setStuck(true);
    else if (intent === 'unstick') setStuck(false);
  }

  // Follow growing content (streaming tokens) and viewport resizes while
  // stuck. Content growth below the fold never fires scroll events, so the
  // engine observes sizes instead.
  $effect(() => {
    const viewport = viewportRef;
    const content = contentRef;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (stuck) scrollNow();
    });
    ro.observe(viewport);
    if (content) ro.observe(content);
    return () => ro.disconnect();
  });

  // ── List transitions (append / prepend / replace) ────────────────────────
  // The pre-effect classifies the change and snapshots the scroll metrics
  // BEFORE the DOM updates; the post-effect applies the matching correction
  // after. Plain (non-reactive) carriers hand the verdict across the pair.
  let prevIds: ListIdSnapshot = { firstId: undefined, lastId: undefined, length: 0 };
  let pendingTransition: ListTransition = 'none';
  let pendingPrependHeight = 0;
  let pendingPrependTop = 0;
  let pendingAppended = 0;

  $effect.pre(() => {
    const next: ListIdSnapshot = {
      firstId: messages[0]?.id,
      lastId: messages[messages.length - 1]?.id,
      length: messages.length
    };
    const transition = classifyTransition(prevIds, next);
    pendingTransition = transition;
    if (transition === 'append') pendingAppended = appendedCount(prevIds.length, next.length);
    if (transition === 'prepend' && viewportRef) {
      pendingPrependHeight = viewportRef.scrollHeight;
      pendingPrependTop = viewportRef.scrollTop;
    }
    prevIds = next;
  });

  $effect(() => {
    // Subscribe to the SAME signals as the pre-effect (length + boundary ids),
    // not just the array reference: an in-place `messages.push(m)` — the
    // idiomatic Svelte-5 stream append — changes length but not the reference,
    // and `void messages` alone would miss it (review finding, P2 wave).
    void messages.length;
    void messages[0]?.id;
    void messages[messages.length - 1]?.id;
    const transition = pendingTransition;
    pendingTransition = 'none';

    if (transition === 'prepend' && viewportRef) {
      // Keep the previously visible message visually still: shift scrollTop
      // by exactly the height the prepended history added above it.
      const delta = viewportRef.scrollHeight - pendingPrependHeight;
      viewportRef.scrollTop = pendingPrependTop + delta;
      lastScrollTop = viewportRef.scrollTop;
    } else if (transition === 'initial' || transition === 'replace') {
      // A conversation opens (or resets) at its newest message.
      setStuck(true);
      scrollNow();
    } else if (transition === 'append') {
      if (stuck) scrollNow();
      else newCount += pendingAppended;
    }
  });

  // ── Screen-reader strategy ───────────────────────────────────────────────
  // The visible log is aria-live="off" — announcing every streamed token is
  // spam. A visually hidden status region announces the start of generation
  // and, when a reply settles, its full text once (a deliberate trade-off:
  // the answer is what the user asked for; a short cue would force a manual
  // hunt through the log). Transitions settling in the SAME tick collapse to
  // the last one — accepted: parallel assistant streams are out of scope.
  let announcement = $state('');
  // Deliberately a plain Map, NOT SvelteMap: it is only read/written inside
  // the effect below — reactivity here would re-trigger that very effect.
  const announcedStatus = new Map<string, ChatMessageStatus | undefined>();
  // First effect run only REGISTERS the mounted history — announcing it would
  // read the newest old message aloud on every conversation open.
  let announceSyncDone = false;

  function messageText(msg: ChatMessageData): string {
    return msg.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n\n');
  }

  function settledAnnouncement(msg: ChatMessageData): string {
    if (msg.status === 'error') return errorLabel;
    if (msg.status === 'aborted') return abortedLabel;
    return messageText(msg);
  }

  $effect(() => {
    const seen = new Set<string>();
    const announceable = announceSyncDone;
    for (const msg of messages) {
      seen.add(msg.id);
      if (msg.role !== 'assistant') continue;
      const prev = announcedStatus.get(msg.id);
      const known = announcedStatus.has(msg.id);
      if (msg.status === 'streaming' && prev !== 'streaming') {
        if (announceable || !known) announcement = generatingLabel;
      } else if (known && prev === 'streaming' && msg.status !== 'streaming') {
        // Settle: text when there is any, the error/aborted label otherwise —
        // never leave a stale "generating" in the region (review finding).
        announcement = settledAnnouncement(msg) || '';
      } else if (announceable && !known && msg.status !== 'streaming') {
        // A reply that arrives already settled (fast/cached models stream
        // nothing) must still be announced (review finding).
        announcement = settledAnnouncement(msg) || announcement;
      }
      announcedStatus.set(msg.id, msg.status);
    }
    for (const id of announcedStatus.keys()) {
      if (!seen.has(id)) announcedStatus.delete(id);
    }
    announceSyncDone = true;
  });
</script>

<div
  {...restProps}
  class={unstyled
    ? [slotClasses?.root, className].filter(Boolean).join(' ')
    : styles.root({ class: [slotClasses?.root, className] })}
  data-stuck={stuck || undefined}
>
  <!-- Focusable scroll container (axe: scrollable-region-focusable) -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={viewportRef}
    class={slot('viewport')}
    role="region"
    aria-label={listLabel}
    tabindex="0"
    onscroll={handleScroll}
  >
    {#if messages.length === 0}
      <div class={slot('empty')}>
        {#if empty}
          {@render empty()}
        {:else}
          <EmptyState icon={MessageSquareIcon} title={emptyTitle} description={emptyDescription} />
        {/if}
      </div>
    {:else}
      <div bind:this={contentRef} class={slot('content')} role="log" aria-live="off">
        {#each messages as msg, i (msg.id)}
          {@const isLast = i === messages.length - 1}
          {#if messageSnippet}
            {@render messageSnippet({ message: msg, index: i, isLast })}
          {:else}
            <ChatMessage
              message={msg}
              {urlPolicy}
              {partRenderers}
              {layout}
              {density}
              onRegenerate={isLast && msg.role === 'assistant' && onRegenerate
                ? () => onRegenerate(msg)
                : undefined}
              onRetry={onRetry ? () => onRetry(msg) : undefined}
            />
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  {#if showJumpButton}
    <button
      type="button"
      class={slot('newButton')}
      aria-label={newCount > 0 ? `${newCount} ${newMessagesLabel}` : scrollToBottomLabel}
      onclick={() => {
        scrollToBottom();
        // Re-sticking unmounts this button — hand focus to the viewport so a
        // keyboard activation does not drop focus to <body> (WCAG 2.4.3).
        viewportRef?.focus();
      }}
    >
      <ArrowDownIcon size={16} />
      {#if newCount > 0}
        <Badge intent="primary" size="xs" counter>{newCount}</Badge>
      {/if}
    </button>
  {/if}

  <div class="sr-only" role="status">{announcement}</div>
</div>
