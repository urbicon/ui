<script lang="ts">
  import { Button, Tooltip } from '@urbicon-ui/blocks';
  import type { Snippet } from 'svelte';

  /**
   * The shared shell of the five filter-bar triggers. They differ in icon,
   * label, lit hue and counter — not in shape.
   *
   * The five that use this shell are capsule-only: the narrow bar has sheet
   * sections instead (see ToolsSheet), reached from one button that repeats the
   * shape by hand — ghost / neutral / `sm`, lit when it has something to report
   * — but skips the Tooltip, which is there to tell five glyphs apart. This
   * carried a `stacked` mode for the popover stack that preceded the sheet; the
   * mode is gone with the stack.
   *
   * The bar half of the empty-state policy lives here too — see `unavailable`.
   * Composing "which tool" with "why it is dead" once, in the shell all five
   * share, is what keeps the five triggers from phrasing it five ways again
   * (#254); the sheet half is ToolEmptyNote.
   *
   * There is deliberately no way to make one of these inert *without* a reason.
   * A dead trigger that says nothing is the state #254 was filed about, so the
   * prop that produced it is gone rather than documented.
   */
  let {
    label,
    active = false,
    unavailable = undefined,
    triggerClass = undefined,
    expanded = false,
    haspopup = 'listbox',
    icon,
    counter,
    onclick = undefined,
    onkeydown = undefined,
    testId = undefined
  }: {
    /** Human name of the tool — the tooltip and the accessible name. */
    label: string;
    active?: boolean;
    /**
     * Why this tool has nothing to offer, already translated — the sentence
     * `toolEmptyKey` picked for the axis. Setting it is what makes the trigger
     * inert, and the sentence is the whole point of it.
     */
    unavailable?: string;
    /** The lit-state classes of this particular tool. */
    triggerClass?: string;
    expanded?: boolean;
    haspopup?: 'listbox' | 'true' | 'dialog' | 'menu';
    icon: Snippet;
    /** Badge shown after the label — a count of what this tool is doing. */
    counter?: Snippet;
    onclick?: () => void;
    /** Keyboard affordances the wrapped overlay needs on its trigger (e.g. ArrowDown-opens for a menu). */
    onkeydown?: (e: KeyboardEvent) => void;
    testId?: string;
  } = $props();

  /**
   * `aria-disabled` plus a swallowed activation, NOT the native `disabled` —
   * the pattern PaginationItem, MenuItem and SegmentGroup already use, and both
   * halves of the difference matter for this control:
   *
   * - **It stays focusable.** A natively disabled button is out of the tab
   *   order, so a keyboard user of the wide bar could never reach the sentence
   *   at all — the sheet section that otherwise carries it exists only below
   *   the bar's `@md` step. Focusable also means Tooltip's `onfocusin` fires,
   *   so the sentence is reachable without a pointer.
   * - **It survives going inert under the user's own hands.** These tools empty
   *   themselves while in use: remove the last running filter of a hidden
   *   column and this trigger goes from live to empty with focus inside its own
   *   popover. Natively disabled, the browser blurs it, and Popover's Escape
   *   restore (`focusTrigger`) is a spec no-op on a disabled button — focus
   *   ends up stranded on `<body>`.
   *
   * Refusing the activation is therefore this component's own job, and it has
   * to cover the click *and* Enter/Space: the overlays wrap this trigger in a
   * span/div carrying their own `onclick`/`onkeydown` (Popover and Select both
   * do), so an unstopped event opens the panel from the wrapper even though the
   * button itself did nothing.
   */
  const inert = $derived(unavailable !== undefined);

  function handleClick(event: MouseEvent) {
    if (inert) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onclick?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (inert) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    onkeydown?.(event);
  }

  // The look of the refusal. `aria-disabled:` rather than Button's own
  // `disabled:` compound, which keys off the attribute this trigger no longer
  // sets — the same two classes Guide and TimeInput use for the same reason.
  const buttonClass = $derived(
    [triggerClass, inert ? 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50' : '']
      .filter(Boolean)
      .join(' ')
  );

  // Name and tooltip say the same thing, and both keep naming the tool: five
  // undifferentiated glyphs are why this shell has a Tooltip at all, so an
  // unavailable trigger reading only "No column can be sorted" would take the
  // identification away at the moment it is least obvious.
  const spokenLabel = $derived(unavailable ? `${label} · ${unavailable}` : label);
</script>

<!--
  Der Tooltip liefert KEINEN zugänglichen Namen: er setzt `aria-describedby`, und das
  auch nur solange er offen ist. Eine Beschreibung ist kein Name — der Button trägt
  nur ein `aria-hidden`-SVG, und axe meldete hier bis 6.48.0 fünf `button-name`-Verstöße
  pro Tabelle (WCAG 2.1 A / 4.1.2). Deshalb zusätzlich `aria-label`.

  Kein `title` daneben: die Erklärung steht schon im zugänglichen Namen, und ein
  `title` wird per HTML-AAM zur *description* — derselbe Satz zweimal angesagt.
-->
<Tooltip label={spokenLabel}>
  <Button
    variant="ghost"
    intent="neutral"
    size="sm"
    {active}
    class={buttonClass}
    aria-expanded={expanded}
    aria-haspopup={haspopup}
    aria-label={spokenLabel}
    aria-disabled={inert || undefined}
    onclick={handleClick}
    onkeydown={handleKeydown}
    data-testid={testId}
  >
    {@render icon()}
    {@render counter?.()}
  </Button>
</Tooltip>
