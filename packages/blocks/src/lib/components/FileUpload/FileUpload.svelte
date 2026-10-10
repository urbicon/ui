<script lang="ts">
  import { useBlocksI18n } from '#lib';
  import type { FileUploadProps, FileUploadFile, FileUploadSlotName } from './index';
  import { fileUploadVariants, type FileUploadVariants } from './fileUpload.variants';
  import { getBlocksConfig, resolveSlotClasses } from '#lib/provider/index.js';
  import { resolveIcon } from '#lib/icons/index.js';
  import UploadCloudIconDefault from '#lib/icons/UploadCloudIcon.svelte';
  import FileIconDefault from '#lib/icons/FileIcon.svelte';
  import CloseIconDefault from '#lib/icons/CloseIcon.svelte';
  import CheckCircleIconDefault from '#lib/icons/CheckCircleIcon.svelte';
  import DangerCircleIconDefault from '#lib/icons/DangerCircleIcon.svelte';
  import { mintAttachment } from '#lib';
  import { Progress } from '#lib/primitives/Progress/index.js';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreSpinner from '#lib/internal/core/CoreSpinner.svelte';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { onDestroy } from 'svelte';
  import {
    createIntakeEntry,
    dragItemsMatchAccept,
    formatFileSize,
    partitionIntake,
    revokeIntakePreviews,
    type FileIntakeConstraints,
    type FileIntakeMessages
  } from '#lib/utils/file-intake.js';
  import { resolveClassChain } from '#lib/utils/variants.js';

  const bt = useBlocksI18n();

  const UploadCloudIcon = resolveIcon('uploadCloud', UploadCloudIconDefault);
  const FileIconComp = resolveIcon('file', FileIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);
  const CheckCircleIcon = resolveIcon('checkCircle', CheckCircleIconDefault);
  const DangerIcon = resolveIcon('danger', DangerCircleIconDefault);

  let {
    children,
    fileItem: fileItemSnippet,
    dropzoneIcon,
    title = 'Drop files here or click to browse',
    description,
    accept,
    maxFiles = Infinity,
    maxFileSize = Infinity,
    minFileSize = 0,
    multiple = false,
    validate,
    allowDrop = true,
    allowPaste = false,
    preventDocumentDrop = true,
    disabled = false,
    required = false,
    name,
    files = $bindable([]),
    file = $bindable<File | null>(null),
    onFileAccept,
    onFileReject,
    onFilesChange,
    onFileRemove,
    size = 'md',
    intent = 'neutral',
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp,
    preset,
    // These address the control, so they go to the file input; the rest stays on the region.
    id: idProp,
    'aria-describedby': ariaDescribedby,
    'aria-labelledby': ariaLabelledby,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
    ...restProps
  }: FileUploadProps = $props();

  const propsId = $props.id();
  const dropzoneId = `file-upload-${propsId}-dropzone`;

  // ── Provider ───────────────────────────────────────────────────────────────

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // ── State ──────────────────────────────────────────────────────────────────

  let inputEl = $state<HTMLInputElement>();
  let dropzoneEl = $state<HTMLDivElement>();
  let dragging = $state(false);
  let dragInvalid = $state(false);
  let dragCounter = $state(0);

  // ── Derived ────────────────────────────────────────────────────────────────

  const maxFilesReached = $derived(files.length >= maxFiles);
  const showDropzone = $derived(!maxFilesReached || files.length === 0);
  const effectiveMultiple = $derived(multiple || maxFiles > 1);
  const acceptString = $derived(Array.isArray(accept) ? accept.join(',') : (accept ?? ''));

  const regionName = $derived(restProps['aria-label'] ?? bt('accessibility.fileUpload'));
  // Internal id first, the consumer's last (COMPONENT-API-CONVENTIONS § restProps ordering);
  // only while the dropzone is mounted, so the reference never dangles.
  const describedBy = $derived(
    [showDropzone ? dropzoneId : undefined, ariaDescribedby].filter(Boolean).join(' ') || undefined
  );

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the dropzone's active variants.
  const variantProps: FileUploadVariants = $derived({
    size,
    intent,
    dragging,
    invalid: dragInvalid,
    disabled
  });

  const styles = $derived(fileUploadVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'FileUpload',
      preset,
      variantProps,
      slotClassesProp,
      fileUploadVariants.config
    )
  );

  const iconSize = $derived({ sm: 24, md: 32, lg: 40 }[size ?? 'md']);
  const itemIconSize = $derived({ sm: 16, md: 20, lg: 24 }[size ?? 'md']);
  const progressSize = $derived<'xs' | 'sm'>(size === 'lg' ? 'sm' : 'xs');

  // ── Slot Helper ────────────────────────────────────────────────────────────

  function slot(slotName: FileUploadSlotName, extra?: string): string {
    const overrides = resolveClassChain(slotClasses?.[slotName], extra);
    if (unstyled) return overrides;
    const styleFn = (styles as Record<string, (opts?: { class?: string }) => string>)[slotName];
    return styleFn?.({ class: overrides }) ?? overrides;
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  // Error texts wired from the component's i18n source; injected into the
  // shared file-intake core so its pure functions stay label-agnostic. Texts
  // are identical to the pre-refactor inline `bt('fileUpload.*')` calls.
  const messages: FileIntakeMessages = {
    invalidType: (type) => bt('fileUpload.invalidType', { type }),
    tooLarge: (size) => bt('fileUpload.tooLarge', { size }),
    tooSmall: (size) => bt('fileUpload.tooSmall', { size }),
    exists: () => bt('fileUpload.exists'),
    tooMany: (count) => bt('fileUpload.tooMany', { count: String(count) })
  };

  const constraints = $derived<FileIntakeConstraints>({
    accept,
    maxFiles,
    maxFileSize,
    minFileSize,
    validate
  });

  // ── File Processing ────────────────────────────────────────────────────────

  // Two-way sync between `files[0]` and the convenience `file` binding.
  // `lastSyncedFile` is the snapshot we last wrote to `file` — comparing
  // against it lets us tell whether the change came from `files` (internal,
  // mirror to `file`) or from `file` itself (external, mirror to `files`).
  let lastSyncedFile = $state<File | null>(null);

  // Mirror `files` into the native `<input type="file">` so files added
  // via drag/drop, paste, or programmatic `bind:files` participate in
  // FormData submits — not just files picked through the file dialog.
  // Assigning `inputEl.files` programmatically does not fire `change`,
  // so this never re-enters `handleInputChange`.
  $effect(() => {
    if (!inputEl) return;
    const dt = new DataTransfer();
    for (const entry of files) dt.items.add(entry.file);
    inputEl.files = dt.files;
  });

  $effect(() => {
    const filesHead = files[0]?.file ?? null;

    if (filesHead !== lastSyncedFile) {
      lastSyncedFile = filesHead;
      file = filesHead;
      return;
    }

    if (file === lastSyncedFile) return;

    if (file === null) {
      revokeIntakePreviews(files);
      files = [];
      lastSyncedFile = null;
      onFilesChange?.(files);
      return;
    }

    const old = files[0];
    if (old) revokeIntakePreviews([old]);
    files = [createIntakeEntry(file)];
    lastSyncedFile = file;
    onFilesChange?.(files);
  });

  function processFiles(incoming: File[]) {
    if (disabled) return;

    const { accepted, rejected } = partitionIntake(incoming, files, constraints, messages);

    if (accepted.length > 0) {
      files = [...files, ...accepted];
      onFileAccept?.(accepted);
      onFilesChange?.(files);
    }

    if (rejected.length > 0) {
      onFileReject?.(rejected);
    }
  }

  function removeFile(entry: FileUploadFile) {
    revokeIntakePreviews([entry]);
    files = files.filter((f) => f.id !== entry.id);
    onFileRemove?.(entry);
    onFilesChange?.(files);
  }

  onDestroy(() => {
    revokeIntakePreviews(files);
  });

  // ── Drag Handlers ──────────────────────────────────────────────────────────

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !allowDrop) return;
    dragCounter++;
    dragging = true;

    if (accept && e.dataTransfer?.items?.length) {
      dragInvalid = !dragItemsMatchAccept(e.dataTransfer.items, accept);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !allowDrop) return;
    dragCounter--;
    if (dragCounter === 0) {
      dragging = false;
      dragInvalid = false;
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragging = false;
    dragInvalid = false;
    dragCounter = 0;
    if (disabled || !allowDrop) return;

    const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
    if (droppedFiles.length > 0) processFiles(droppedFiles);
  }

  // ── Input Handler ──────────────────────────────────────────────────────────

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const selected = Array.from(target.files ?? []);
    if (selected.length > 0) processFiles(selected);
    target.value = '';
  }

  // ── Paste Handler ──────────────────────────────────────────────────────────

  $effect(() => {
    if (!allowPaste || disabled) return;

    function handlePaste(e: ClipboardEvent) {
      const pastedFiles = Array.from(e.clipboardData?.files ?? []);
      if (pastedFiles.length > 0) {
        e.preventDefault();
        processFiles(pastedFiles);
      }
    }

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  });

  // ── Document Drop Prevention ───────────────────────────────────────────────

  $effect(() => {
    if (!preventDocumentDrop) return;

    function preventDrop(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    }

    document.addEventListener('dragover', preventDrop);
    document.addEventListener('drop', preventDrop);
    return () => {
      document.removeEventListener('dragover', preventDrop);
      document.removeEventListener('drop', preventDrop);
    };
  });

  // ── Mint ─────────────────────────────────────────────────────────────────

  function openFilePicker() {
    if (!disabled && inputEl) inputEl.click();
  }

  // A full list takes the dropzone away, but a `<label for>` click still reaches the input.
  function handleInputClick(e: MouseEvent) {
    if (!showDropzone) e.preventDefault();
  }

  // Focus scrolls only the 1px input into view, centred, which leaves a dropzone taller than
  // half its scroller partly outside it. Keyboard focus, the kind that shows the ring, brings
  // the whole dropzone in; a label click does not match `:focus-visible` and scrolls nothing
  // more than before.
  function handleInputFocus() {
    if (inputEl?.matches(':focus-visible')) {
      dropzoneEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
</script>

<!--
  Spread first, so the region landmark survives a consumer `role`. Its name is the consumer's
  `aria-label` when given: two uploads on one page need two landmark names, and the i18n
  default is the same for every instance.

  `relative` makes the root the containing block of the `sr-only` input below, and holds under
  `unstyled` too. Focus scrolls that block's chain into view: from an unpositioned root it skips
  any unpositioned scroller the upload sits in, so the scroller stays put while the page or an
  `overflow-hidden` ancestor scrolls. A position class of the consumer's still replaces it.
-->
<div
  {...restProps}
  class={resolveClassChain(
    'relative',
    unstyled
      ? resolveClassChain(slotClasses?.root, className)
      : styles.root({ class: [slotClasses?.root, className] })
  )}
  role="region"
  aria-label={regionName}
>
  <!--
    The control. `<label for>` reaches only labelable elements, so this visually hidden input —
    not the region, not the dropzone — takes `id` and the field's ARIA, and Enter/Space and a
    label click open the picker natively. It must precede the dropzone: that sibling shows its
    focus ring through `peer`. It stays mounted while a full list hides the dropzone, as the
    label's target and the carrier of `files` into FormData, but leaves the tab order then —
    no ring host is left on screen — and cancels the picker a label click would open.

    `title` is the lowest-ranked name source: a `<label>` outranks it, so a FormField label still
    names the control, and without one it is what satisfies axe's `label` rule. Chromium itself
    names an unlabelled file input by its button text ("Choose File" / "Choose Files") and ranks
    that above `title`.
  -->
  <input
    bind:this={inputEl}
    id={idProp}
    type="file"
    accept={acceptString || undefined}
    multiple={effectiveMultiple}
    {disabled}
    {required}
    {name}
    onclick={handleInputClick}
    onfocus={handleInputFocus}
    onchange={handleInputChange}
    class="peer sr-only"
    title={regionName}
    tabindex={showDropzone ? undefined : -1}
    aria-labelledby={ariaLabelledby}
    aria-describedby={describedBy}
    aria-invalid={ariaInvalid}
    aria-required={ariaRequired}
    aria-disabled={showDropzone ? undefined : 'true'}
  />

  {#if showDropzone}
    <!--
      Pointer and drop surface only: the keyboard path to the picker is the input above, so the
      dropzone takes no focus and needs no key handler. Its content describes the input.
      `aria-disabled` marks its dimmed text as part of an inactive component, which WCAG 1.4.3
      exempts from contrast; without it axe's `color-contrast` reports a disabled dropzone.
    -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      bind:this={dropzoneEl}
      id={dropzoneId}
      {@attach mintAttachment(mint, { enabled: !disabled })}
      class={slot('dropzone')}
      aria-disabled={disabled || undefined}
      data-blocks-dropzone-state={dragging ? (dragInvalid ? 'reject' : 'accept') : 'idle'}
      ondragenter={allowDrop ? handleDragEnter : undefined}
      ondragover={allowDrop ? handleDragOver : undefined}
      ondragleave={allowDrop ? handleDragLeave : undefined}
      ondrop={allowDrop ? handleDrop : undefined}
      onclick={openFilePicker}
    >
      {#if children}
        {@render children()}
      {:else}
        <div class={slot('dropzoneIcon')}>
          {#if dropzoneIcon}
            {@render dropzoneIcon()}
          {:else}
            <UploadCloudIcon size={iconSize} />
          {/if}
        </div>
        <div class={slot('dropzoneTitle')}>
          {title}
        </div>
        {#if description}
          <div class={slot('dropzoneDescription')}>
            {description}
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- File list -->
  {#if files.length > 0}
    <div class={slot('fileList')} role="list" aria-live="polite" aria-relevant="additions removals">
      {#each files as entry (entry.id)}
        <div
          class={slot('fileItem')}
          role="listitem"
          data-status={entry.status}
          transition:fly={{ y: 8, duration: 150, easing: quintOut }}
        >
          {#if fileItemSnippet}
            {@render fileItemSnippet({ fileEntry: entry, remove: () => removeFile(entry) })}
          {:else}
            <!-- Preview / File Icon -->
            <div class={slot('fileItemPreview')}>
              {#if entry.preview}
                <img
                  src={entry.preview}
                  alt={entry.file.name}
                  class="rounded-modify size-full object-cover"
                />
              {:else}
                <FileIconComp size={itemIconSize} />
              {/if}
            </div>

            <!-- File Info -->
            <div class={slot('fileItemInfo')}>
              <span class={slot('fileItemName')} title={entry.file.name}>
                {entry.file.name}
              </span>
              <span class={slot('fileItemSize')}>
                {formatFileSize(entry.file.size)}
              </span>

              {#if entry.status === 'uploading' && entry.progress !== undefined}
                <div class={slot('fileItemProgress')}>
                  <Progress
                    {unstyled}
                    value={entry.progress}
                    size={progressSize}
                    intent={intent === 'neutral' ? 'primary' : intent}
                  />
                </div>
              {/if}

              {#if entry.errors.length > 0}
                <span class={slot('fileItemError')}>
                  {entry.errors[0].message}
                </span>
              {/if}
            </div>

            <!-- Status indicator -->
            <div class={slot('fileItemStatusIcon')}>
              {#if entry.status === 'uploading'}
                <!--
                  CoreSpinner instead of the public Spinner (see internal/core/).
                  The old call was `visible` (explicitly true) with no label
                  override, and this branch already gates rendering on the
                  uploading status — so the core needs no {#if} of its own.
                  Deliberate a11y delta: the old Spinner emitted role="status" +
                  aria-live + an sr-only "Loading..." inside the file list's own
                  aria-live="polite" region (nested live regions); the core emits
                  no semantics — the list region owns announcements. The spinner
                  stays `text-primary` (the FILL tone, not the `-text` tier)
                  deliberately: it is a mark that mirrors the always-primary
                  progress bar above (Progress resolves fileUpload's
                  primary|neutral intent to primary either way), and a mark must
                  match its partner surface byte-for-byte — the text tier would
                  put ring and bar one stop apart. The sibling
                  text-success-text/text-danger-text icons mark the TERMINAL
                  states and are free-standing, so they take the text tier.
                  It wins the duel against the core's
                  `text-current` by stylesheet order (theme colors sort after
                  keyword colors).
                -->
                <CoreSpinner size="xs" class="text-primary" />
              {:else if entry.status === 'complete'}
                <CheckCircleIcon size={itemIconSize} class="text-success-text" />
              {:else if entry.status === 'error'}
                <DangerIcon size={itemIconSize} class="text-danger-text" />
              {/if}
            </div>

            <!-- Remove button -->
            <button
              type="button"
              class={slot('fileItemRemoveButton')}
              onclick={() => removeFile(entry)}
              aria-label={bt('accessibility.removeFile', { name: entry.file.name })}
            >
              <CloseIcon size={(itemIconSize ?? 20) - 4} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  :global([data-blocks-dropzone-state='accept']) {
    animation: blocks-dropzone-pulse 1.5s ease-in-out infinite;
  }

  @keyframes -global-blocks-dropzone-pulse {
    0%,
    100% {
      border-color: var(--color-primary);
    }
    50% {
      border-color: var(--color-primary-hover);
    }
  }
</style>
