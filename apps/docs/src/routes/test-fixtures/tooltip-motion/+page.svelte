<script lang="ts">
  // E2E fixture for the Tooltip fade motion (ACC-3 follow-up, Playwright). Renders tooltips in
  // default (token) and prop-overridden states so a test can read the computed transition-duration
  // / -timing-function off each tooltip panel. The panel carries the `transition-opacity` class
  // regardless of open state (popover manual → display:none until shown), so the computed value is
  // readable without hovering. `data-testid` rides `{...restProps}` onto the panel element. Not
  // part of the docs nav.
  import { Tooltip } from '@urbicon-ui/blocks';
</script>

<div class="bg-surface-base min-h-screen p-8" data-testid="tooltip-motion-fixtures">
  <h1 class="text-text-primary mb-6 text-xl font-bold">Tooltip motion fixtures</h1>

  <Tooltip label="Default" data-testid="tt-default">
    <button type="button">Default trigger</button>
  </Tooltip>

  <Tooltip
    label="Overridden"
    transitionDuration={600}
    transitionEasing="linear"
    data-testid="tt-prop"
  >
    <button type="button">Overridden trigger</button>
  </Tooltip>
</div>
