<script lang="ts">
  // Test-only composition for SidebarLayout's `toggle` snippet. The payload is
  // spread onto a real <button>, which is the thing under test — a
  // createRawSnippet of plain HTML would assert the ids the test already knows
  // instead of the attributes a consumer actually receives. Lives under
  // __fixtures__/ so it is excluded from the published package and is never
  // collected as a test file. Not exported from the barrel.
  import type { MobileHeaderContext, SidebarLayoutProps, SidebarToggleContext } from '../index';
  import SidebarLayout from '../SidebarLayout.svelte';

  let {
    open = $bindable(false),
    withToggle = true,
    withMobileHeader = false,
    ...layoutProps
  }: Partial<SidebarLayoutProps> & { withToggle?: boolean; withMobileHeader?: boolean } = $props();
</script>

{#snippet toggleSnippet(rail: SidebarToggleContext)}
  <button {...rail.triggerProps} type="button" onclick={rail.toggle}>
    {rail.open ? 'Collapse' : 'Expand'}
  </button>
{/snippet}

{#snippet mobileHeaderSnippet(ctx: MobileHeaderContext)}
  <button type="button" data-testid="context-toggle" onclick={ctx.toggle}>Menu</button>
{/snippet}

{#snippet sidebarSnippet()}
  <nav aria-label="Test nav"><a href="/">Home</a></nav>
{/snippet}

<SidebarLayout
  bind:open
  {...layoutProps}
  sidebar={sidebarSnippet}
  toggle={withToggle ? toggleSnippet : undefined}
  mobileHeader={withMobileHeader ? mobileHeaderSnippet : undefined}
/>
