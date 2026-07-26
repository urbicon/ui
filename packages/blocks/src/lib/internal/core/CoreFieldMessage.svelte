<!--
  CoreFieldMessage — the helper/error line under a form field, shared by Input,
  PinInput and TimeInput WITHOUT any of them importing another public component.

  INTERNAL — never exported from the package barrel, no docs/MCP entry.

  This is part (b) of the field-chrome de-duplication: part (a) moved the shared
  tv() class STRINGS into `internal/field-chrome.ts` (debt-fix-wave-5), and the
  same block of MARKUP stayed hand-copied in all three `.svelte` files.

  What it owns: the error-beats-helper precedence, `role="alert"` on the error
  arm only, and wiring the right id onto the right arm. What it does NOT own:
  the look. The call site resolves its own `message` slot (respecting `unstyled`
  and `slotClasses`) and passes the finished class string, exactly as
  CoreIconButton and CoreSpinner take theirs — a core carries behaviour, the
  embedding component carries visual identity.

  Only the error arm is a live region. The helper text is static descriptive
  content that is already reachable through `aria-describedby`; announcing it
  via `role="alert"` would interrupt the user for text that did not change.

  Deliberately NOT extracted alongside it: the label. Input renders a real
  `<label for={fieldId}>` because it has exactly one focusable element, while
  PinInput and TimeInput render a `<span id>` referenced by `aria-labelledby`
  on a `role="group"` — they have many focusable segments and no single field a
  `for` could point at. That divergence is correct a11y, not duplication, so it
  stays at the call sites.
-->
<script lang="ts">
  let {
    error,
    helper,
    errorId,
    helperId,
    class: className = ''
  }: {
    /** Error text. Wins over `helper` when both are set. */
    error?: string;
    /** Helper text, shown only when there is no error. */
    helper?: string;
    /** Id for the error arm — must match what `aria-describedby` points at. */
    errorId?: string;
    /** Id for the helper arm — must match what `aria-describedby` points at. */
    helperId?: string;
    /** The resolved `message` slot class from the call site. */
    class?: string;
  } = $props();
</script>

{#if error}
  <div id={errorId} class={className} role="alert">
    {error}
  </div>
{:else if helper}
  <div id={helperId} class={className}>
    {helper}
  </div>
{/if}
