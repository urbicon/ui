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
   */
  let {
    label,
    active = false,
    disabled = false,
    triggerClass = undefined,
    expanded = false,
    haspopup = 'listbox',
    icon,
    counter,
    onclick = undefined,
    testId = undefined
  }: {
    /** Human name of the tool — the tooltip and the accessible name. */
    label: string;
    active?: boolean;
    disabled?: boolean;
    /** The lit-state classes of this particular tool. */
    triggerClass?: string;
    expanded?: boolean;
    haspopup?: 'listbox' | 'true' | 'dialog' | 'menu';
    icon: Snippet;
    /** Badge shown after the label — a count of what this tool is doing. */
    counter?: Snippet;
    onclick?: () => void;
    testId?: string;
  } = $props();
</script>

<!--
  Der Tooltip liefert KEINEN zugänglichen Namen: er setzt `aria-describedby`, und das
  auch nur solange er offen ist. Eine Beschreibung ist kein Name — der Button trägt
  nur ein `aria-hidden`-SVG, und axe meldete hier bis 6.48.0 fünf `button-name`-Verstöße
  pro Tabelle (WCAG 2.1 A / 4.1.2). Deshalb zusätzlich `aria-label`.
-->
<Tooltip {label}>
  <Button
    variant="ghost"
    intent="neutral"
    size="sm"
    {active}
    {disabled}
    class={triggerClass}
    aria-expanded={expanded}
    aria-haspopup={haspopup}
    aria-label={label}
    {onclick}
    data-testid={testId}
  >
    {@render icon()}
    {@render counter?.()}
  </Button>
</Tooltip>
