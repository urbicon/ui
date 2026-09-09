<!--
  Internal: the one place in this package where a request outcome becomes
  markup — the live regions every component reports into, whether it is a page
  (through AuthPageShell), a manager, or one of AccountSettings' four per-form
  regions. Not exported from the package.

  Two regions, one per urgency, both always in the DOM: a screen reader
  announces a content change only inside a live region that already existed
  when the content arrived. An error lands in the assertive `role="alert"`
  region, a success and the pending `children` in the polite `role="status"`
  one, so a "saved" message does not interrupt whatever is being read.

  The inner `Alert` carries no role of its own (`role={undefined}` removes the
  one it hard-codes): a live region inside a live region is announced twice, or
  not at all, depending on the reader. Error and success stay exclusive by
  construction (the error wins), so a component cannot leave a stale success
  next to a fresh error.

  One wrapper around both regions, not two siblings: the managers and the
  AccountSettings forms place this component in a `flex flex-col gap-*` column,
  where every child costs a gap whether or not it has a size — two top-level
  elements would open a hole in those layouts.
-->
<script lang="ts">
  import { Alert } from '@urbicon-ui/blocks';
  import type { Snippet } from 'svelte';

  interface Props {
    /** Current error text; empty string renders the (silent) live regions only. */
    error: string;
    /** Success text, announced politely. Empty = none. */
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

<div>
  <div role="alert">
    {#if error}
      <Alert intent="danger" role={undefined} {size} {unstyled} class={className}>
        {error}
      </Alert>
    {/if}
  </div>
  <div role="status">
    {#if !error}
      {#if success}
        <Alert intent="success" role={undefined} {size} {unstyled} class={successClass}>
          {success}
        </Alert>
      {:else if children}
        {@render children()}
      {/if}
    {/if}
  </div>
</div>
