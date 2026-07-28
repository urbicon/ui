<!--
  CoreFieldMessage — the helper/error line under a form field, shared by every
  component in the Form family WITHOUT any of them importing another public
  component: Input, Textarea, Select, Combobox, Checkbox, Toggle, RadioGroup,
  Slider, PinInput, TimeInput.

  INTERNAL — never exported from the package barrel, no docs/MCP entry.

  This is part (b) of the field-chrome de-duplication: part (a) moved the shared
  tv() class STRINGS into `internal/field-chrome.ts` (debt-fix-wave-5), and the
  same block of MARKUP stayed hand-copied in every `.svelte` file. The first cut
  covered the three components the debt entry named; the block turned out to be
  verbatim in seven more, which is where most of the copies actually were.

  What it owns: the error-beats-helper precedence, `role="alert"` on the error
  arm only, and wiring the right id onto the right arm. What it does NOT own:
  the look. The call site resolves its own `message` slot (respecting `unstyled`
  and `slotClasses`) and passes the finished class string, exactly as
  CoreIconButton and CoreSpinner take theirs — a core carries behaviour, the
  embedding component carries visual identity.

  Only the error arm is a live region. The helper text is static descriptive
  content that is already reachable through `aria-describedby`; announcing it
  via `role="alert"` would interrupt the user for text that did not change.

  Deliberately NOT extracted alongside it: the label. It looks like the same
  kind of copy but it is not — the element is dictated by what the field is.
  Input, Textarea and Combobox render a real `<label for={fieldId}>` because
  each has exactly one focusable element; Select adds an `id` so its trigger
  BUTTON can also be named by `aria-labelledby`; PinInput, TimeInput and
  RadioGroup render a `<span id>` behind `aria-labelledby` on a `role="group"`,
  having many focusable segments and no single field a `for` could point at;
  Checkbox and Toggle put the text inside the wrapping `<label>` next to the
  control, and Slider's sits in a header row beside the value read-out. Those
  are five different a11y shapes, so unifying them would be a regression rather
  than a de-duplication. The label stays at the call sites.

  The one call site that wraps this component in markup of its own is Textarea:
  its message shares a `justify-between` footer row with the character counter,
  so it keeps an empty `<span>` for the no-message case to hold the counter
  right. That spacer is layout, not scaffolding, and stays there.
-->
<script lang="ts">
  let {
    error,
    helper,
    errorId,
    helperId,
    class: className = '',
    helperClass
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
    /**
     * Resolved class for the helper arm, when the call site styles it through a
     * slot of its own instead of reusing `message`. Only Combobox does — it
     * exposes `slotClasses.helper` next to `slotClasses.message`, so the two
     * tones are slot constants there rather than one `messageType` axis.
     * Defaults to `class`, which is what every other field passes.
     */
    helperClass?: string;
  } = $props();
</script>

{#if error}
  <div id={errorId} class={className} role="alert">
    {error}
  </div>
{:else if helper}
  <div id={helperId} class={helperClass ?? className}>
    {helper}
  </div>
{/if}
