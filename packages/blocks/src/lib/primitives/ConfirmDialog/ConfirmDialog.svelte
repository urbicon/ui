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
    onError,
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
    if (!onConfirm) {
      open = false;
      return;
    }
    try {
      busy = true;
      await onConfirm();
      open = false;
    } catch (error) {
      // Failure contract: skip the auto-close (dialog stays open) and re-enable
      // (busy cleared in `finally`) so the user can retry or cancel. The
      // rejection is handed to `onError`; without one it is surfaced DEV-only
      // instead of escaping the ignored onclick promise as an unhandled
      // rejection (Combobox queryFn / Toast promise precedent). A throwing
      // `onError` is a consumer bug and deliberately escapes (fail-loud,
      // mirrors createCronRunner).
      if (onError) {
        onError(error);
      } else if (import.meta.env?.DEV) {
        console.error('[ConfirmDialog] onConfirm rejected:', error);
      }
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
    <!--
      In flight, each button carries exactly one guard, and the two differ on
      purpose. Cancel is `disabled`: nothing can abort a running `onConfirm`,
      so a cancel mid-flight would report onCancel for an action that still
      completes. Confirm carries `loading` and must not be `disabled`: it is
      the element holding focus while the promise is pending, and Chromium
      drops focus to <body> the moment a focused button becomes disabled
      (measured; `aria-busy` keeps it in place). Button drops the click itself
      while `loading`, so `handleConfirm` needs no re-entrancy check of its
      own — it is reachable only through this button, and Enter/Space arrive
      as native clicks.
    -->
    <Button variant="ghost" intent="neutral" onclick={handleCancel} disabled={isLoading}>
      {cancelLabel ?? bt('button.cancel')}
    </Button>
    <Button intent={effectiveConfirmIntent} onclick={handleConfirm} loading={isLoading}>
      {confirmLabel ?? bt('button.confirm')}
    </Button>
  {/snippet}
</Dialog>
