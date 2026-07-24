<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { Alert, Avatar, Button, Skeleton, Tooltip } from '$lib/primitives';
  import { resolveIcon } from '$lib/icons';
  import SparklesIconDefault from '$lib/icons/SparklesIcon.svelte';
  import UserIconDefault from '$lib/icons/UserIcon.svelte';
  import InfoIconDefault from '$lib/icons/InfoCircleIcon.svelte';
  import CopyIconDefault from '$lib/icons/CopyIcon.svelte';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import RefreshIconDefault from '$lib/icons/RefreshIcon.svelte';
  import FileIconDefault from '$lib/icons/FileIcon.svelte';
  import { formatFileSize } from '$lib/utils/file-intake';
  import StreamingMarkdown from '../StreamingMarkdown/StreamingMarkdown.svelte';
  import CitationChip from '../CitationChip/CitationChip.svelte';
  import ReasoningDisclosure from '../ReasoningDisclosure/ReasoningDisclosure.svelte';
  import ToolCallCard from '../ToolCallCard/ToolCallCard.svelte';
  import type { CitationSource } from '../CitationChip';
  import { checkLinkUrl } from '../markdown/url-policy.js';
  import type { ChatMessagePart, ChatRole } from '../chat.types';
  import { chatMessageVariants, type ChatMessageVariants } from './chat-message.variants';
  import type { ChatMessageProps } from './index';

  type AttachmentPart = Extract<ChatMessagePart, { type: 'attachment' }>;

  let {
    message,
    urlPolicy,
    onRegenerate,
    onRetry,
    avatar,
    actions,
    metadata,
    partRenderers,
    layout = 'bubble',
    density = 'comfortable',
    roleLabels,
    copyLabel = 'Copy message',
    copiedLabel = 'Copied',
    regenerateLabel = 'Regenerate',
    retryLabel = 'Retry',
    errorLabel = 'Something went wrong',
    abortedLabel = 'Generation stopped',
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ChatMessageProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const SparklesIcon = resolveIcon('sparkles', SparklesIconDefault);
  const UserIcon = resolveIcon('user', UserIconDefault);
  const InfoIcon = resolveIcon('info', InfoIconDefault);
  const CopyIcon = resolveIcon('copy', CopyIconDefault);
  const CheckIcon = resolveIcon('check', CheckIconDefault);
  const RefreshIcon = resolveIcon('refresh', RefreshIconDefault);
  const FileIcon = resolveIcon('file', FileIconDefault);

  const variantProps: ChatMessageVariants = $derived({ layout, density, role: message.role });
  const styles = $derived(chatMessageVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'ChatMessage', preset, variantProps, slotClassesProp)
  );

  function cls(name: keyof typeof slotClasses, extra?: string | (string | undefined)[]) {
    if (unstyled) {
      const own = slotClasses?.[name];
      return [own, ...(Array.isArray(extra) ? extra : [extra])].filter(Boolean).join(' ');
    }
    const slotFns = styles as Record<string, (args: { class?: unknown }) => string>;
    return slotFns[name]({
      class: [slotClasses?.[name], ...(Array.isArray(extra) ? extra : [extra])]
    });
  }

  const status = $derived(message.status ?? 'complete');
  const lastIndex = $derived(message.parts.length - 1);

  // Sources are collected out of the flow into a single numbered footer row and
  // also feed StreamingMarkdown so `[id]` markers resolve to chips. Deduped by
  // id (first occurrence wins): models routinely cite one source repeatedly,
  // and a duplicate id would crash the keyed footer each (review finding).
  const sources = $derived.by<CitationSource[]>(() => {
    const byId = new Map<string, CitationSource>();
    for (const p of message.parts) {
      if (p.type === 'source' && !byId.has(p.id)) {
        byId.set(p.id, { id: p.id, title: p.title, url: p.url, snippet: p.snippet });
      }
    }
    return [...byId.values()];
  });

  // Concatenated text parts — what the copy action writes to the clipboard.
  const copyText = $derived(
    message.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n\n')
  );

  // Zero-parts streaming placeholder. An empty *trailing* text part already gets
  // StreamingMarkdown's cursor, so only the genuinely empty message needs this.
  const showPlaceholder = $derived(message.status === 'streaming' && message.parts.length === 0);

  const DEFAULT_ROLE_LABELS: Record<ChatRole, string> = {
    user: 'You',
    assistant: 'Assistant',
    system: 'System'
  };
  const roleLabel = $derived(roleLabels?.[message.role] ?? DEFAULT_ROLE_LABELS[message.role]);

  const createdAtIso = $derived(message.createdAt?.toISOString());
  const createdAtTime = $derived(
    message.createdAt?.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );

  // ── Copy interaction ─────────────────────────────────────────────────────
  let copied = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(copyText);
      copied = true;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        copied = false;
        resetTimer = undefined;
      }, 2000);
    } catch (err) {
      // Never confirm a copy that failed (e.g. denied clipboard permission).
      console.error('ChatMessage: failed to copy message', err);
    }
  }

  $effect(() => () => {
    if (resetTimer) clearTimeout(resetTimer);
  });
</script>

{#snippet defaultAvatar(role: ChatRole)}
  <Avatar size="sm" class={cls('avatar')}>
    {#if role === 'assistant'}
      <SparklesIcon size={16} />
    {:else if role === 'user'}
      <UserIcon size={16} />
    {:else}
      <InfoIcon size={16} />
    {/if}
  </Avatar>
{/snippet}

{#snippet attachmentChip(part: AttachmentPart)}
  {@const linkCheck =
    part.url != null ? checkLinkUrl(part.url, urlPolicy) : ({ ok: false } as const)}
  {#if linkCheck.ok}
    <a
      class={cls('attachment')}
      href={linkCheck.href}
      target="_blank"
      rel="noopener noreferrer"
      download
    >
      <FileIcon size={16} class={cls('attachmentIcon')} />
      <span class={cls('attachmentName')}>{part.name}</span>
      {#if part.size != null}<span class={cls('attachmentSize')}>{formatFileSize(part.size)}</span
        >{/if}
    </a>
  {:else}
    <span class={cls('attachment')}>
      <FileIcon size={16} class={cls('attachmentIcon')} />
      <span class={cls('attachmentName')}>{part.name}</span>
      {#if part.size != null}<span class={cls('attachmentSize')}>{formatFileSize(part.size)}</span
        >{/if}
    </span>
  {/if}
{/snippet}

{#snippet body()}
  <div class={cls('partsFlow')}>
    {#each message.parts as part, index (index)}
      <!--
        Parts are append-only during streaming: array position IS identity, so
        the index key is stable here (the documented exception to the
        no-index-as-key rule).
      -->
      {#if part.type === 'text'}
        {#if partRenderers?.text}
          {@render partRenderers.text(part)}
        {:else}
          <StreamingMarkdown
            content={part.text}
            streaming={message.status === 'streaming' && index === lastIndex}
            sources={sources.length ? sources : undefined}
            {urlPolicy}
            size="sm"
          />
        {/if}
      {:else if part.type === 'reasoning'}
        {#if partRenderers?.reasoning}
          {@render partRenderers.reasoning(part)}
        {:else}
          <!-- Streaming while it is the trailing part: once the answer text
               starts flowing behind it, the reasoning is settled. -->
          <ReasoningDisclosure
            reasoning={part}
            streaming={status === 'streaming' && index === lastIndex}
            {urlPolicy}
          />
        {/if}
      {:else if part.type === 'tool-call'}
        {#if partRenderers?.['tool-call']}
          {@render partRenderers['tool-call'](part)}
        {:else}
          <ToolCallCard toolCall={part} />
        {/if}
      {:else if part.type === 'attachment'}
        {#if partRenderers?.attachment}
          {@render partRenderers.attachment(part)}
        {:else}
          {@render attachmentChip(part)}
        {/if}
      {:else if part.type === 'a2ui'}
        <!-- No default renderer by design: A2UIView is opt-in via
             `partRenderers.a2ui` so it stays out of the base bundle. Wire it up
             with `{#snippet a2ui(part)}<A2UIView payload={part.payload} … />{/snippet}`
             (see A2UIView's JSDoc). Without the snippet, an a2ui part renders nothing. -->
        {#if partRenderers?.a2ui}{@render partRenderers.a2ui(part)}{/if}
      {/if}
      <!-- part.type === 'source' is intentionally skipped: sources render in the
           citation footer, never inline. -->
    {/each}

    {#if showPlaceholder}
      <div class={cls('placeholder')}>
        <Skeleton variant="text" width="40%" />
      </div>
    {/if}
  </div>
{/snippet}

{#snippet retryAction()}
  <Button size="sm" onclick={onRetry}>
    <RefreshIcon size={14} />
    {retryLabel}
  </Button>
{/snippet}

{#snippet defaultActions()}
  <div class={cls('actions')}>
    <!-- No copy for text-less messages (tool-call/reasoning-only): copying an
         empty string and confirming "Copied" would be a lie (review finding). -->
    {#if copyText}
      <Tooltip label={copyLabel}>
        <button
          type="button"
          class={cls('actionButton')}
          onclick={copyMessage}
          aria-label={copied ? copiedLabel : copyLabel}
        >
          {#if copied}
            <CheckIcon size={16} />
          {:else}
            <CopyIcon size={16} />
          {/if}
        </button>
      </Tooltip>
    {/if}
    {#if onRegenerate}
      <Tooltip label={regenerateLabel}>
        <button
          type="button"
          class={cls('actionButton')}
          onclick={onRegenerate}
          aria-label={regenerateLabel}
        >
          <RefreshIcon size={16} />
        </button>
      </Tooltip>
    {/if}
  </div>
{/snippet}

<!--
  `column` wraps the bubble together with everything that hangs under it —
  citations, the status alert, the footer. They must be siblings of the bubble
  INSIDE the column, not of `container`: the column is what carries the
  role-dependent side (`items-end` for a user message), so the timestamp ends up
  under the bubble's own edge instead of at the left margin.
-->
{#snippet belowBubble()}
  {#if sources.length}
    <div class={cls('sourcesFooter')}>
      {#each sources as source, i (source.id)}
        <CitationChip {source} index={i + 1} {urlPolicy} />
      {/each}
    </div>
  {/if}

  {#if status === 'error' || status === 'aborted'}
    <div class={cls('statusAlert')}>
      <Alert
        intent={status === 'error' ? 'danger' : 'warning'}
        title={status === 'error' ? errorLabel : abortedLabel}
        actions={onRetry ? retryAction : undefined}
      />
    </div>
  {/if}

  <div class={cls('footer')}>
    {#if actions}
      {@render actions({ message })}
    {:else}
      {@render defaultActions()}
    {/if}
    {#if metadata}
      {@render metadata({ message })}
    {:else if createdAtTime}
      <time class={cls('metadata')} datetime={createdAtIso}>{createdAtTime}</time>
    {/if}
  </div>
{/snippet}

<div class={cls('root', className)} data-role={message.role} data-status={status} {...restProps}>
  {#if layout === 'plain'}
    <div class={cls('header')}>
      {#if avatar}
        {@render avatar({ role: message.role })}
      {:else}
        {@render defaultAvatar(message.role)}
      {/if}
      <span class={cls('roleName')}>{roleLabel}</span>
    </div>
    <div class={cls('column')}>
      <div class={cls('bubble')}>
        {@render body()}
      </div>
      {@render belowBubble()}
    </div>
  {:else}
    <div class={cls('container')}>
      {#if message.role !== 'user'}
        {#if avatar}
          {@render avatar({ role: message.role })}
        {:else}
          {@render defaultAvatar(message.role)}
        {/if}
      {/if}
      <div class={cls('column')}>
        <div class={cls('bubble')}>
          {@render body()}
        </div>
        {@render belowBubble()}
      </div>
    </div>
  {/if}

  <!-- Copy confirmation for screen readers — a live status region, present
       before `copied` flips so it always announces the change. -->
  <span class="sr-only" role="status">{copied ? copiedLabel : ''}</span>
</div>
