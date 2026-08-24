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
   */
  let {
    label,
    active = false,
    disabled = false,
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
    disabled?: boolean;
    /**
     * Why this tool has nothing to offer, already translated — the sentence
     * `toolEmptyKey` picked for the axis. Setting it disables the trigger and
     * is the only way this shell explains itself; a trigger that wants to be
     * inert without a reason passes `disabled` instead.
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
</script>

<!--
  Der Tooltip liefert KEINEN zugänglichen Namen: er setzt `aria-describedby`, und das
  auch nur solange er offen ist. Eine Beschreibung ist kein Name — der Button trägt
  nur ein `aria-hidden`-SVG, und axe meldete hier bis 6.48.0 fünf `button-name`-Verstöße
  pro Tabelle (WCAG 2.1 A / 4.1.2). Deshalb zusätzlich `aria-label`.

  Ist das Werkzeug leer, sagt der Satz das auf zwei Wegen, weil keiner davon für
  ein `disabled` Control überall gleich funktioniert: `title` braucht überhaupt
  kein Event, und der zugängliche Name trägt ihn hinter den Werkzeugnamen — der
  Name bleibt „welches Werkzeug", die Erklärung kommt dahinter. Der Tooltip
  bekommt denselben Satz für die Fälle, in denen der Browser den Hover doch
  ausliefert.
-->
<Tooltip label={unavailable ?? label}>
  <Button
    variant="ghost"
    intent="neutral"
    size="sm"
    {active}
    disabled={disabled || unavailable !== undefined}
    class={triggerClass}
    aria-expanded={expanded}
    aria-haspopup={haspopup}
    aria-label={unavailable ? `${label} · ${unavailable}` : label}
    title={unavailable}
    {onclick}
    {onkeydown}
    data-testid={testId}
  >
    {@render icon()}
    {@render counter?.()}
  </Button>
</Tooltip>
