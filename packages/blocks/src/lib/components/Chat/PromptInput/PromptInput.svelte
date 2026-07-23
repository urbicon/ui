<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import SendIconDefault from '$lib/icons/SendIcon.svelte';
  import SquareIconDefault from '$lib/icons/SquareIcon.svelte';
  import PaperclipIconDefault from '$lib/icons/PaperclipIcon.svelte';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import FileIconDefault from '$lib/icons/FileIcon.svelte';
  import {
    partitionIntake,
    revokeIntakePreviews,
    formatFileSize,
    type FileIntakeEntry,
    type FileIntakeConstraints,
    type FileIntakeMessages
  } from '$lib/utils/file-intake';
  import { promptInputVariants, type PromptInputVariants } from './prompt-input.variants';
  import type { PromptInputProps } from './index';

  let {
    value = $bindable(''),
    attachments = $bindable<FileIntakeEntry[]>([]),
    onValueChange,
    onSubmit,
    onStop,
    onAttachmentReject,
    submitOn = 'enter',
    clearOnSubmit = true,
    placeholder,
    disabled = false,
    busy = false,
    autofocus = false,
    minRows = 1,
    maxRows = 8,
    label = 'Message',
    sendLabel = 'Send',
    stopLabel = 'Stop',
    attachLabel = 'Attach file',
    removeAttachmentLabel = (name: string) => `Remove ${name}`,
    allowAttachments = false,
    preventDocumentDrop = true,
    accept,
    maxFiles,
    maxFileSize,
    validate,
    size = 'md',
    leading,
    trailing,
    hint,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: PromptInputProps = $props();

  const bt = useBlocksI18n();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const SendIcon = resolveIcon('send', SendIconDefault);
  const SquareIcon = resolveIcon('square', SquareIconDefault);
  const PaperclipIcon = resolveIcon('paperclip', PaperclipIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);
  const FileIcon = resolveIcon('file', FileIconDefault);

  const variantProps: PromptInputVariants = $derived({ size });
  const styles = $derived(promptInputVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'PromptInput', preset, variantProps, slotClassesProp)
  );

  function cls(name: keyof typeof slotClasses, extra?: string | (string | undefined)[]) {
    const extras = Array.isArray(extra) ? extra : [extra];
    if (unstyled) {
      return [slotClasses?.[name], ...extras].filter(Boolean).join(' ');
    }
    const slotFns = styles as Record<string, (args: { class?: unknown }) => string>;
    return slotFns[name]({ class: [slotClasses?.[name], ...extras] });
  }

  // ── IDs & a11y ───────────────────────────────────────────────────────────────
  const propsId = $props.id();
  const fieldId = `prompt-input-${propsId}`;
  const errorId = `${fieldId}-error`;

  // aria-keyshortcuts reflects the active submit binding so AT users know the
  // gesture (Enter vs Cmd/Ctrl+Enter) that sends the message.
  const keyshortcuts = $derived(submitOn === 'enter' ? 'Enter' : 'Meta+Enter Control+Enter');

  // ── Auto-resize (measured pattern, mirrors Textarea.svelte) ────────────────────
  let textareaRef = $state<HTMLTextAreaElement>();
  const lineHeight = $derived(size === 'sm' ? 20 : 24);

  function adjustHeight() {
    if (!textareaRef) return;
    textareaRef.style.height = 'auto';
    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows * lineHeight;
    const scrollHeight = textareaRef.scrollHeight;
    textareaRef.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    textareaRef.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  // Re-measure on every value change (typing and programmatic clear alike).
  $effect(() => {
    void value;
    adjustHeight();
  });

  // Focus once when requested — a bare native `autofocus` attribute is
  // unreliable for a chromeless textarea mounted inside a bordered surface.
  $effect(() => {
    if (autofocus && textareaRef) textareaRef.focus();
  });

  // ── Value ──────────────────────────────────────────────────────────────────
  function handleInput(event: Event & { currentTarget: HTMLTextAreaElement }) {
    value = event.currentTarget.value;
    onValueChange?.(value);
    adjustHeight();
  }

  const canSubmit = $derived((value.trim().length > 0 || attachments.length > 0) && !disabled);

  function submit() {
    if (disabled || busy) return;
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    // Hand out a shallow copy so a consumer that keeps the array by reference
    // (e.g. clearOnSubmit=false) is not aliased to our still-mutating state.
    onSubmit({ text, attachments: [...attachments] });
    // Clear any stale inline rejection on EVERY successful submit, regardless
    // of clearOnSubmit — the error described the previous intake, not this send.
    error = '';
    if (clearOnSubmit) {
      value = '';
      onValueChange?.('');
      // Ownership of the accepted entries transfers to the consumer — the
      // submitted files (and their preview object-URLs) live on in the
      // consumer's message list, so we clear the reference WITHOUT revoking.
      attachments = [];
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    // IME guard — never submit while a composition is in progress.
    if (event.isComposing || event.keyCode === 229) return;

    const withMod = event.metaKey || event.ctrlKey;
    if (submitOn === 'enter') {
      if (event.shiftKey) return; // Shift+Enter inserts a newline.
      // While busy, DON'T preventDefault — let Enter insert a newline so the
      // user can keep composing during a streaming response (mod-enter parity).
      // Swallowing the keystroke here would drop it entirely.
      if (busy) return;
      // Empty-idle Enter still preventDefaults: submit() no-ops, and we
      // deliberately suppress the leading newline (chat convention).
      event.preventDefault();
      submit();
    } else {
      if (!withMod) return; // Plain Enter inserts a newline in mod-enter mode.
      event.preventDefault();
      submit();
    }
  }

  // ── Attachments ──────────────────────────────────────────────────────────────
  let error = $state('');
  let dragging = $state(false);
  let fileInputEl = $state<HTMLInputElement>();
  let rootEl = $state<HTMLDivElement>();

  const acceptString = $derived(Array.isArray(accept) ? accept.join(',') : (accept ?? ''));

  // Error texts reuse FileUpload's i18n keys exactly — no new keys for a second
  // intake surface. `bt` is reactive, so building this per-intake keeps locale
  // changes correct.
  const messages: FileIntakeMessages = {
    invalidType: (type) => bt('fileUpload.invalidType', { type }),
    tooLarge: (formattedSize) => bt('fileUpload.tooLarge', { size: formattedSize }),
    tooSmall: (formattedSize) => bt('fileUpload.tooSmall', { size: formattedSize }),
    exists: () => bt('fileUpload.exists'),
    tooMany: (count) => bt('fileUpload.tooMany', { count: String(count) })
  };

  function addFiles(incoming: File[]) {
    if (!allowAttachments || disabled || incoming.length === 0) return;
    const constraints: FileIntakeConstraints = { accept, maxFiles, maxFileSize, validate };
    const { accepted, rejected } = partitionIntake(
      incoming,
      attachments,
      constraints,
      messages,
      'attachment'
    );

    if (accepted.length > 0) {
      attachments = [...attachments, ...accepted];
      error = ''; // A successful add clears the previous rejection line.
    }
    if (rejected.length > 0) {
      error = rejected[0].errors[0]?.message ?? '';
      onAttachmentReject?.(rejected);
    }
  }

  async function removeAttachment(entry: FileIntakeEntry, index: number) {
    // Explicit removal — the entry never reached the consumer, so we own and
    // revoke its preview object-URL here.
    revokeIntakePreviews([entry]);
    attachments = attachments.filter((a) => a.id !== entry.id);
    // Move focus deterministically after the chip leaves the DOM so keyboard
    // users don't get dropped to <body>: the chip now at this index (the one
    // that was next), else the last remaining chip (the previous one), else the
    // textarea when the strip is empty.
    await tick();
    const buttons = rootEl?.querySelectorAll<HTMLButtonElement>('[data-attachment-remove]');
    if (buttons && buttons.length > 0) {
      buttons[Math.min(index, buttons.length - 1)]?.focus();
    } else {
      textareaRef?.focus();
    }
  }

  function openFilePicker() {
    if (!disabled) fileInputEl?.click();
  }

  function handleFileInputChange(event: Event & { currentTarget: HTMLInputElement }) {
    const selected = Array.from(event.currentTarget.files ?? []);
    if (selected.length > 0) addFiles(selected);
    event.currentTarget.value = '';
  }

  function handlePaste(event: ClipboardEvent) {
    if (!allowAttachments || disabled) return;
    const pasted = Array.from(event.clipboardData?.files ?? []);
    if (pasted.length > 0) {
      event.preventDefault();
      addFiles(pasted);
    }
  }

  function handleDragOver(event: DragEvent) {
    if (!allowAttachments || disabled) return;
    event.preventDefault();
    dragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    // Only clear when leaving the composer itself, not when moving between
    // its children (which fire dragleave against the child).
    if (event.currentTarget === event.target) dragging = false;
  }

  function handleDrop(event: DragEvent) {
    if (!allowAttachments || disabled) return;
    dragging = false;
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    // Only claim the drop when it carries files. A text-selection drop must
    // fall through to the native textarea (inserts the dragged text), so we
    // never preventDefault for it.
    if (dropped.length === 0) return;
    event.preventDefault();
    addFiles(dropped);
  }

  // Prevent a file misdropped OUTSIDE the composer from navigating the page
  // away (browser default for a dropped file). Effective only while the
  // attachment surface is enabled. Mirrors FileUpload's document guard.
  $effect(() => {
    if (!allowAttachments || !preventDocumentDrop) return;
    function preventDrop(event: DragEvent) {
      // Only guard drops OUTSIDE the composer. Inside, the composer's own
      // handlers act (file drops), and a text-selection drop must reach the
      // native textarea — so we must not preventDefault the bubbled event here.
      if (rootEl && event.target instanceof Node && rootEl.contains(event.target)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    }
    document.addEventListener('dragover', preventDrop);
    document.addEventListener('drop', preventDrop);
    return () => {
      document.removeEventListener('dragover', preventDrop);
      document.removeEventListener('drop', preventDrop);
    };
  });

  // Reset the drag highlight if a drag ends anywhere (dropped outside, or the
  // pointer left the window) — otherwise the ring stays stuck after such a drag.
  $effect(() => {
    if (!allowAttachments) return;
    function clearDrag() {
      dragging = false;
    }
    window.addEventListener('dragend', clearDrag);
    return () => window.removeEventListener('dragend', clearDrag);
  });

  // Non-submitted attachments own their previews — revoke on teardown. Submitted
  // entries were already cleared from `attachments` (without revoking), so this
  // only frees what the user left behind.
  onDestroy(() => {
    revokeIntakePreviews(attachments);
  });

  const iconSize = $derived(size === 'sm' ? 16 : 18);
</script>

<div
  bind:this={rootEl}
  {...restProps}
  class={cls('root', className)}
  data-dragging={allowAttachments && dragging ? 'true' : undefined}
  ondragover={allowAttachments ? handleDragOver : undefined}
  ondragleave={allowAttachments ? handleDragLeave : undefined}
  ondrop={allowAttachments ? handleDrop : undefined}
>
  {#if allowAttachments}
    <input
      bind:this={fileInputEl}
      type="file"
      accept={acceptString || undefined}
      multiple={maxFiles !== 1}
      {disabled}
      class="sr-only"
      tabindex={-1}
      aria-hidden="true"
      onchange={handleFileInputChange}
    />
  {/if}

  {#if allowAttachments && attachments.length > 0}
    <ul class={cls('attachmentsStrip')} aria-label={attachLabel}>
      {#each attachments as entry, i (entry.id)}
        <li class={cls('attachmentChip')}>
          <!-- Decorative: the adjacent attachmentName span carries the file
               name — a filled alt would read it twice (review finding). -->
          <span class={cls('attachmentThumb')} aria-hidden="true">
            {#if entry.preview}
              <img src={entry.preview} alt="" />
            {:else}
              <FileIcon size={16} />
            {/if}
          </span>
          <span class={cls('attachmentName')} title={entry.file.name}>{entry.file.name}</span>
          <span class={cls('attachmentSize')}>{formatFileSize(entry.file.size)}</span>
          <button
            type="button"
            class={cls('attachmentRemove')}
            data-attachment-remove
            aria-label={removeAttachmentLabel(entry.file.name)}
            onclick={() => removeAttachment(entry, i)}
          >
            <CloseIcon size={14} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <textarea
    bind:this={textareaRef}
    id={fieldId}
    class={cls('textarea')}
    {value}
    {placeholder}
    {disabled}
    rows={minRows}
    aria-label={label}
    aria-keyshortcuts={keyshortcuts}
    aria-describedby={error ? errorId : undefined}
    oninput={handleInput}
    onkeydown={handleKeydown}
    onpaste={handlePaste}></textarea>

  <div class={cls('actions')}>
    <div class={cls('leading')}>
      {#if allowAttachments}
        <button
          type="button"
          class={cls('attachButton')}
          aria-label={attachLabel}
          {disabled}
          onclick={openFilePicker}
        >
          <PaperclipIcon size={iconSize} />
        </button>
      {/if}
      {@render leading?.()}
    </div>

    <div class={cls('trailing')}>
      {@render trailing?.()}
      {#if busy}
        <button
          type="button"
          class={cls('stopButton')}
          aria-label={stopLabel}
          onclick={() => onStop?.()}
        >
          <SquareIcon size={iconSize} />
        </button>
      {:else}
        <button
          type="button"
          class={cls('sendButton')}
          aria-label={sendLabel}
          disabled={!canSubmit}
          onclick={submit}
        >
          <SendIcon size={iconSize} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Live rejection line — the region is PERMANENTLY in the DOM (present
       before its text, so AT reliably announces the change; see ChatMessage's
       copy-status span). Empty state collapses to sr-only: still in the
       accessibility tree, but reserving no layout. -->
  <div id={errorId} class={error ? cls('error') : 'sr-only'} role="status">{error}</div>

  {#if hint}
    <div class={cls('hint')}>{@render hint()}</div>
  {/if}
</div>
