<script lang="ts">
  // Test-only harness for Escape layering in GuidePanel: a manual-mode Popover
  // (`closeOnClickOutside={false}`, which dismisses through a `document` listener) inside an
  // article of an open panel, next to a button that claims Escape at element level, the way
  // an open Select does. Under __fixtures__/ so it is excluded from the published
  // package and never collected as a test file. Not exported from the barrel.
  import { Popover } from '#lib/primitives/Popover/index.js';
  import type { GuideController } from '#lib/utils/index.js';
  import GuideArticle from '../GuideArticle.svelte';
  import GuidePanel from '../GuidePanel.svelte';
  import GuideProvider from '../GuideProvider.svelte';
  import type { GuidePanelProps } from '../index';

  let {
    controller,
    panelProps = {},
    popoverOpen = $bindable(true)
  }: {
    controller: GuideController;
    panelProps?: Partial<GuidePanelProps>;
    popoverOpen?: boolean;
  } = $props();
</script>

<GuideProvider {controller}>
  <GuidePanel {...panelProps}>
    <GuideArticle id="a" title="Article A">
      <Popover bind:open={popoverOpen} closeOnClickOutside={false}>
        {#snippet trigger()}
          <button type="button" data-testid="pop-trigger">Open</button>
        {/snippet}
        <button type="button" data-testid="pop-inner">Inner</button>
      </Popover>
      <button
        type="button"
        data-testid="claimer"
        onkeydown={(e) => {
          if (e.key === 'Escape') e.preventDefault();
        }}>Claims Escape</button
      >
    </GuideArticle>
  </GuidePanel>
</GuideProvider>
