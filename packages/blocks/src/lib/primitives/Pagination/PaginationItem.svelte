<script lang="ts">
  import Button from '../Button/Button.svelte';
  import type { PaginationItemProps } from '.';

  let {
    children,
    page,
    active = false,
    disabled = false,
    loading = false,
    size = 'md',
    variant = 'outlined',
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
  <!-- eslint-disable svelte/no-navigation-without-resolve -->
  <a
    {href}
    class="focus-visible:outline-primary/50 inline-block no-underline focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 {className}"
    tabindex={disabled ? -1 : 0}
    aria-disabled={disabled || undefined}
    aria-current={active ? 'page' : undefined}
  >
    <Button
      {size}
      {variant}
      {intent}
      {tier}
      {disabled}
      {loading}
      {mint}
      pressed={active}
      tabindex={-1}
    >
      {#if children}
        {@render children()}
      {:else if page !== undefined}
        {page}
      {/if}
    </Button>
  </a>
  <!-- eslint-enable svelte/no-navigation-without-resolve -->
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
    pressed={active}
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
