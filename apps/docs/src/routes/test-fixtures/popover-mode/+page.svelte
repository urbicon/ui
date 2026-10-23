<script lang="ts">
  // E2E fixture for a Popover whose dismiss mode changes while it is open (Playwright). The
  // checkbox inside the panel drives `closeOnEscape`, and with it `popover="auto"` ↔
  // `"manual"`; `?closeOnEscape=false` starts the page in manual mode. Every callback the
  // Popover fires is appended to the `popover-mode-calls` log. Not part of the docs nav.
  import { page } from '$app/state';
  import { Button, Checkbox, Popover } from '@urbicon-ui/blocks';

  let open = $state(false);
  let closeOnEscape = $state(page.url.searchParams.get('closeOnEscape') !== 'false');
  let calls = $state<string[]>([]);
</script>

<div class="bg-surface-base min-h-screen p-8" data-testid="popover-mode-fixtures">
  <Popover
    bind:open
    {closeOnEscape}
    data-testid="popover-mode-panel"
    onOpenChange={(value) => calls.push(`openChange:${value}`)}
    onEscape={() => calls.push('escape')}
    onClickOutside={() => calls.push('clickOutside')}
  >
    {#snippet trigger()}
      <Button>Open</Button>
    {/snippet}
    <Checkbox label="Close on Escape" bind:checked={closeOnEscape} />
  </Popover>

  <output data-testid="popover-mode-open">{open}</output>
  <output data-testid="popover-mode-calls">{calls.join(' ')}</output>
</div>
