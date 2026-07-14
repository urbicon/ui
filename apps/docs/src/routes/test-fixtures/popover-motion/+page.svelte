<script lang="ts">
  // E2E fixture for the Popover enter/exit motion (ACC-3 rest, Playwright).
  // Three surfaces:
  //  - `pop-default` — token-driven motion (--blocks-popover-duration/easing);
  //  - `pop-prop` — per-instance transitionDuration/transitionEasing overrides,
  //    long enough (600ms) for the spec to sample mid-transition opacity;
  //  - a Menu — verifies the motion fragment rides the unstyled inner Popover.
  // `data-testid` rides `{...restProps}` onto the panel element, so computed
  // styles are readable while closed (the panel element always exists). Not
  // part of the docs nav.
  import { Button, Menu, Popover } from '@urbicon-ui/blocks';

  // Ghost-click probe: counts activations of a button INSIDE the fading
  // panel — the exit spec asserts a click mid-fade does not land.
  let ghostClicks = $state(0);
</script>

<div class="bg-surface-base min-h-screen p-8" data-testid="popover-motion-fixtures">
  <h1 class="text-text-primary mb-6 text-xl font-bold">Popover motion fixtures</h1>

  <div class="flex items-start gap-8">
    <Popover data-testid="pop-default">
      {#snippet trigger()}
        <Button>Default</Button>
      {/snippet}
      <div data-testid="pop-default-content">Default content</div>
    </Popover>

    <Popover data-testid="pop-prop" transitionDuration={600} transitionEasing="linear">
      {#snippet trigger()}
        <Button>Overridden</Button>
      {/snippet}
      <div data-testid="pop-prop-content">
        Overridden content
        <button type="button" data-testid="ghost-probe" onclick={() => (ghostClicks += 1)}>
          Probe
        </button>
      </div>
    </Popover>

    <output data-testid="ghost-clicks">{ghostClicks}</output>

    <Menu
      placeholder="Menu"
      items={[
        { label: 'First', onSelect: () => {} },
        { label: 'Second', onSelect: () => {} }
      ]}
    />
  </div>
</div>
