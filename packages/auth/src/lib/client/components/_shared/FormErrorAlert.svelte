<!--
  Internal: the one place in this package where a request outcome becomes
  markup — the aria-live region every component reports into, whether it is a
  page (through AuthPageShell), a manager, or one of AccountSettings' four
  per-form regions. The region itself always renders: screen readers only
  announce content changes inside a live region that already exists in the DOM.
  Error and success are exclusive by construction (the error wins), so a
  component cannot leave a stale success next to a fresh error. Not exported
  from the package.
-->
<script lang="ts">
  import { Alert } from '@urbicon-ui/blocks';
  import type { Snippet } from 'svelte';

  interface Props {
    /** Current error text; empty string renders the (silent) live region only. */
    error: string;
    /** Success text, announced through the same region. Empty = none. */
    success?: string;
    /** Alert size — `md` where the message is the page's whole content (VerifyEmailPage). */
    size?: 'sm' | 'md';
    unstyled?: boolean;
    /** Classes for the error Alert (pass the component's resolved `error` slot). */
    class?: string;
    /** Classes for the success Alert (the component's resolved `success` slot). */
    successClass?: string;
    /**
     * Rendered while there is nothing to announce — a pending state that has
     * to live in the same region so that its replacement by the outcome is one
     * announced content change (VerifyEmailPage's spinner).
     */
    children?: Snippet;
  }

  let {
    error,
    success = '',
    size = 'sm',
    unstyled = false,
    class: className,
    successClass,
    children
  }: Props = $props();
</script>

<div aria-live="polite">
  {#if error}
    <Alert intent="danger" {size} {unstyled} class={className}>
      {error}
    </Alert>
  {:else if success}
    <Alert intent="success" {size} {unstyled} class={successClass}>
      {success}
    </Alert>
  {:else if children}
    {@render children()}
  {/if}
</div>
