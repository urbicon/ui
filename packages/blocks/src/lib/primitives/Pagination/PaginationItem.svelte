<script lang="ts">
  import Button from '../Button/Button.svelte';
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
    class: className = '',
    ...restProps
  }: PaginationItemProps = $props();

  function handleClick() {
    if (disabled || loading) return;
    onPageClick?.(page);
  }
</script>

{#if href}
  <!-- Link-based pagination item. `href` is consumer-provided (internal or
       external) — `resolve()` only applies to statically-known SvelteKit
       routes. -->
  <a
    {href}
    class={paginationLinkVariants({ class: className })}
    tabindex={disabled ? -1 : 0}
    aria-disabled={disabled || undefined}
    aria-current={active ? 'page' : undefined}
  >
    <Button {size} {variant} {intent} {tier} {disabled} {loading} {mint} {active} tabindex={-1}>
      {#if children}
        {@render children()}
      {:else if page !== undefined}
        {page}
      {/if}
    </Button>
  </a>
{:else}
  <!-- Button-based pagination item -->
  <Button
    {size}
    {variant}
    {intent}
    {tier}
    {disabled}
    {loading}
    {mint}
    {active}
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

<style>
  /* Link wrapper styling */
  a[aria-disabled='true'] {
    pointer-events: none;
    opacity: 0.5;
  }

  a :global(.blocks-button) {
    pointer-events: none; /* Let the link handle the click */
  }
</style>
