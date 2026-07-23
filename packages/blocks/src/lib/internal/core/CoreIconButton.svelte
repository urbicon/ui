<!--
  CoreIconButton — behaviour-only internal core for the small icon-only controls
  embedded inside other public components (Badge's remove ×, Dialog/Drawer close
  ×). It renders a native `<button type="button">` with just the interaction
  baseline (flex-centred content, pointer/select affordance, focus-visible reset,
  disabled inertness). Visual identity — size, radius, colour, ring, shadow — comes
  entirely from the call-site's `class` (a `*.variants.ts` slot), NOT from a variant
  engine pass here: this core deliberately does not touch tv()/mint/tokens, which is
  what lets a public component embed a control without importing another public
  component (keeps the public-to-public import graph clean, see internal/core/).

  The base classes are structural plumbing, deliberately NOT tw-merged against the
  incoming `class` (no engine here): a consumer slot class targeting one of these
  buckets (display/cursor/select/disabled-opacity) is resolved by stylesheet order,
  not by the override ladder. That is accepted: overrides belong on the call-site's
  variants slot (which merges correctly bucket-by-bucket); the plumbing is not an
  override surface. Under `unstyled` the plumbing also stays — stripping
  `disabled:pointer-events-none` & co. would break behaviour, not styling.

  INTERNAL — never exported from the package barrel, no docs/MCP entry. For a full
  themed button use the public `Button`.

  restProps-first spread (COMPONENT-API-CONVENTIONS §restProps ordering): the
  explicit attributes come AFTER `{...restProps}` so component-owned wiring wins —
  `aria-label` is required (an icon-only button has no text accessible name) and
  can never be clobbered, and `type="button"` stays a submit-safe default.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let {
    'aria-label': ariaLabel,
    class: className = '',
    disabled = false,
    onclick,
    children,
    ...restProps
  }: {
    /** Required — an icon-only control has no text to name it. */
    'aria-label': string;
    class?: string;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  } & Omit<
    HTMLButtonAttributes,
    'aria-label' | 'class' | 'disabled' | 'onclick' | 'children'
  > = $props();
</script>

<button
  {...restProps}
  type="button"
  {disabled}
  {onclick}
  aria-label={ariaLabel}
  class={[
    'inline-flex items-center justify-center cursor-pointer select-none',
    'focus-visible:outline-none',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    className
  ]}
>
  {@render children()}
</button>
