<script lang="ts">
  // E2E fixture for a Popover whose dismiss mode changes while it is open (Playwright). Every
  // variant moves the panel between `popover="auto"` and `"manual"`, and appends each callback
  // the Popover fires to the `popover-mode-calls` log. `?s=` picks the variant:
  //  - none: a checkbox inside the panel drives `closeOnEscape`. `?closeOnEscape=false` starts
  //    in manual mode; `?duration=` sets the motion's duration.
  //  - `tags`: a pick in the multi-select Combobox inside the panel locks it
  //    (`closeOnClickOutside` off) while the listbox stays open.
  //  - `anchor`: starts locked (manual) on an external anchor. Buttons outside the panel open
  //    it, remove the anchor and unlock it (manual → auto).
  // Not part of the docs nav.
  import { page } from '$app/state';
  import { Button, Checkbox, Combobox, Popover } from '@urbicon-ui/blocks';

  const variant = page.url.searchParams.get('s');
  const duration = Number(page.url.searchParams.get('duration')) || undefined;
  const fruit = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'].map((label) => ({
    label,
    value: label.toLowerCase()
  }));

  let open = $state(false);
  let closeOnEscape = $state(page.url.searchParams.get('closeOnEscape') !== 'false');
  let locked = $state(variant === 'anchor');
  let tags = $state<string[]>([]);
  let anchorShown = $state(true);
  let anchor = $state<HTMLElement | null>(null);
  let calls = $state<string[]>([]);

  const callbacks = {
    onOpenChange: (value: boolean) => calls.push(`openChange:${value}`),
    onEscape: () => calls.push('escape'),
    onClickOutside: () => calls.push('clickOutside')
  };
</script>

<div class="bg-surface-base min-h-screen p-8" data-testid="popover-mode-fixtures">
  {#if variant === 'tags'}
    <Popover
      bind:open
      closeOnClickOutside={tags.length === 0}
      data-testid="popover-mode-panel"
      {...callbacks}
    >
      {#snippet trigger()}
        <Button>Open</Button>
      {/snippet}
      <div class="h-80 w-72">
        <Combobox label="Fruit" multiple options={fruit} bind:value={tags} />
      </div>
    </Popover>
  {:else if variant === 'anchor'}
    <div class="flex gap-4">
      <Button onclick={() => (open = true)}>Show</Button>
      <Button onclick={() => (anchorShown = false)}>Remove anchor</Button>
      <Button onclick={() => (locked = false)}>Unlock</Button>
    </div>
    {#if anchorShown}
      <span bind:this={anchor} class="text-text-primary mt-8 inline-block">Anchor</span>
    {/if}
    <Popover
      bind:open
      triggerElement={anchor ?? undefined}
      closeOnClickOutside={!locked}
      data-testid="popover-mode-panel"
      {...callbacks}
    >
      <p class="text-text-primary">Anchored panel</p>
    </Popover>
  {:else}
    <Popover
      bind:open
      {closeOnEscape}
      transitionDuration={duration}
      data-testid="popover-mode-panel"
      {...callbacks}
    >
      {#snippet trigger()}
        <Button>Open</Button>
      {/snippet}
      <Checkbox label="Close on Escape" bind:checked={closeOnEscape} />
    </Popover>
  {/if}

  <output data-testid="popover-mode-open">{open}</output>
  <output data-testid="popover-mode-calls">{calls.join(' ')}</output>
</div>
