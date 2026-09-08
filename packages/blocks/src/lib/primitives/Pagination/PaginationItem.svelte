<script lang="ts">
  import { isMintOff, mintAttachment } from '$lib/mint';
  // Direct import (not the barrel), as in Button: the scale factory ships
  // statically as the apply() fallback; every other mint name stays demand-loaded.
  import { scaleMint } from '$lib/mint/engine';
  import { getBlocksConfig } from '$lib/provider';
  import { getTierContext } from '$lib/utils/tier-context';
  import { resolveClassChain } from '$lib/utils/variants';
  import Button from '../Button/Button.svelte';
  import { buttonVariants } from '../Button/button.variants';
  import { paginationLinkVariants } from './pagination.variants';
  import type { PaginationItemProps } from '.';

  // `active`, NOT `pressed`: press is a *moment* (scale-[0.98], brightness-90,
  // shadow-xs) and cannot express "you are here" — on the transparent surface
  // of an outlined/ghost pager none of the three is even visible, which left
  // the current page findable only via `aria-current`. Button's `active` axis
  // is the state encoding (outlined promotes to filled, ghost gets the subtle
  // fill + ring + semibold).
  let {
    children,
    page,
    active = false,
    disabled = false,
    loading = false,
    size = 'md',
    // Mirrors Pagination's default (see the note there).
    variant = 'ghost',
    intent = 'primary',
    tier,
    href,
    onPageClick,
    mint = 'none',
    // Destructured, not spread: it is a `Button` prop, and on the anchor —
    // which resolves no cascade — it would reach the DOM as `<a preset="…">`.
    preset,
    unstyled: unstyledProp = false,
    class: className = '',
    ...restProps
  }: PaginationItemProps = $props();

  function handleClick() {
    if (disabled || loading) return;
    onPageClick?.(page);
  }

  // ── The link form ──────────────────────────────────────────────────────
  // With `href` the item IS the `<a>`: interactive content inside an anchor is
  // invalid HTML, so the anchor wears `buttonVariants` itself and holds nothing
  // but its label — the recipe COMPONENT-API-CONVENTIONS.md § Polymorphic
  // Elements gives consumers, plus the three things this component knows and a
  // call site does not: the tier off the context, the press-cue token, the mint.
  //
  // No provider cascade reaches the anchor (measured: a `defaults.Button`
  // rule lands on the button form and on nothing here), and neither of the two
  // ways to give it one is available. Resolving under `Button` would dress an
  // element that is not a Button, and `provider/component-slots.test.ts`
  // refuses it — a component resolves under the name it is exported as.
  // Resolving under `PaginationItem` would mean the `slotClasses`/`preset`
  // surface this component does not declare. The consumer recipe has the same
  // ceiling, and `class` is the way through it — see the `href` prop.
  //
  // `onclick` is `Omit`ted from the props type: the handler below is what makes
  // `disabled` and `loading` mean anything on a link, so it cannot be composed
  // with a caller's.
  const blocksConfig = getBlocksConfig();
  const tierCtx = getTierContext();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit');

  const styles = $derived(
    buttonVariants({
      tier: effectiveTier,
      intent,
      variant,
      size,
      loading: loading || undefined,
      // What Button passes: its own prop defaults to `overlay`, and only that
      // value leaves the per-size gap alone (measured at `lg`: `start` drops
      // `gap-2.5` to `gap-2` for the spinner this form does not draw).
      loadingPlacement: 'overlay',
      active: active || undefined
    })
  );
  // Anchor-only chrome, including the `opacity-100` that keeps the label lit
  // where a loading Button fades it out behind the overlay spinner.
  const chrome = $derived(paginationLinkVariants({ loading: loading || undefined }));

  // The same switch Button throws: with the mint off — this item's default —
  // the press sink `active:scale-[var(--blocks-press-scale)]` goes flat too.
  const pressCueClass = $derived(isMintOff(mint) ? '[--blocks-press-scale:1]' : '');

  // The anchor navigates or it does nothing: `disabled` and `loading` both
  // cancel activation, which is what the button form's guard means on a link.
  // `loading` draws no spinner here — the label stays where it is and the
  // browser reports the navigation. `onPageClick` is the button form's.
  function handleLinkClick(event: MouseEvent) {
    if (disabled || loading) event.preventDefault();
  }
</script>

{#if href}
  <!-- `href` is consumer-provided (internal or external) — `resolve()` only
       applies to statically-known SvelteKit routes. restProps spreads FIRST so
       the modelled state wins; the ARIA attributes after it fall back to the
       caller's value rather than removing it (an explicit `undefined` after a
       spread strips the attribute). -->
  <a
    {@attach mintAttachment(mint, {
      enabled: !disabled && !loading,
      fallbacks: { scale: scaleMint }
    })}
    {...restProps}
    {href}
    class={[
      `blocks-intent-${intent}`,
      unstyled
        ? resolveClassChain(pressCueClass, className)
        : styles.base({ class: [pressCueClass, chrome.base(), className] })
    ]}
    tabindex={disabled ? -1 : restProps.tabindex}
    aria-disabled={disabled ? true : restProps['aria-disabled']}
    aria-busy={loading ? true : restProps['aria-busy']}
    aria-current={active ? 'page' : restProps['aria-current']}
    onclick={handleLinkClick}
  >
    <span class={unstyled ? '' : styles.content({ class: chrome.content() })}>
      {#if children}
        {@render children()}
      {:else if page !== undefined}
        {page}
      {/if}
    </span>
  </a>
{:else}
  <Button
    {size}
    {variant}
    {intent}
    {tier}
    {disabled}
    {loading}
    {mint}
    {active}
    {preset}
    unstyled={unstyledProp}
    onclick={handleClick}
    aria-current={active ? 'page' : undefined}
    class={className}
    {...restProps}
  >
    {#if children}
      {@render children()}
    {:else if page !== undefined}
      {page}
    {/if}
  </Button>
{/if}
