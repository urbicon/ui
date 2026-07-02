<!--
  Internal: the aria-live error region every auth component repeated (review
  R18). The region itself always renders — screen readers only announce content
  changes inside a live region that already exists in the DOM — and the Alert
  appears once `error` is non-empty. Not exported from the package.
-->
<script lang="ts">
  import { Alert } from '@urbicon-ui/blocks';

  interface Props {
    /** Current error text; empty string renders the (silent) live region only. */
    error: string;
    unstyled?: boolean;
    /** Classes for the Alert itself (pass the page's resolved error slot). */
    class?: string;
  }

  let { error, unstyled = false, class: className }: Props = $props();
</script>

<div aria-live="polite">
  {#if error}
    <Alert intent="danger" size="sm" {unstyled} class={className}>
      {error}
    </Alert>
  {/if}
</div>
