<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import Button from '../Button/Button.svelte';
  import Dialog from '../Dialog/Dialog.svelte';
  import type { ConfirmDialogProps } from './index';

  const bt = useBlocksI18n();

  let {
    open = $bindable(false),
    title,
    description,
    intent = 'danger',
    confirmLabel,
    cancelLabel,
    confirmIntent,
    onConfirm,
    onCancel,
    loading = false,
    closeOnBackdropClick = true,
    closeOnEscape = true,
    children,
    ...rest
  }: ConfirmDialogProps = $props();

  let busy = $state(false);
  const isLoading = $derived(loading || busy);
  const effectiveConfirmIntent = $derived(
    confirmIntent ?? (intent === 'neutral' ? 'primary' : intent)
  );

  async function handleConfirm() {
    if (isLoading) return;
    if (!onConfirm) {
      open = false;
      return;
    }
    try {
      busy = true;
      await onConfirm();
      open = false;
    } finally {
      busy = false;
    }
  }

  function handleCancel() {
    if (isLoading) return;
    onCancel?.();
    open = false;
  }
</script>

<Dialog
  {...rest}
  bind:open
  {title}
  {intent}
  size="sm"
  closeOnBackdropClick={closeOnBackdropClick && !isLoading}
  closeOnEscape={closeOnEscape && !isLoading}
  hideCloseButton={isLoading}
  onClose={handleCancel}
>
  {#if description}
    <p class="text-text-secondary text-sm leading-relaxed">{description}</p>
  {/if}
  {#if children}
    {@render children()}
  {/if}

  {#snippet footer()}
    <Button variant="ghost" intent="neutral" onclick={handleCancel} disabled={isLoading}>
      {cancelLabel ?? bt('button.cancel')}
    </Button>
    <Button intent={effectiveConfirmIntent} onclick={handleConfirm} loading={isLoading}>
      {confirmLabel ?? bt('button.confirm')}
    </Button>
  {/snippet}
</Dialog>
