<script lang="ts">
  // Test-only composition harness for GuideRef — it reads both the GuideProvider
  // controller and the GuidePanel article registry through context, and upgrades
  // from plain text to a button only once the target article registers. The
  // interaction test therefore mounts a real GuideProvider › GuidePanel ›
  // GuideArticle composition. Under __fixtures__/ so it is excluded from the
  // published package and never collected as a test file. Not exported from the barrel.
  import type { GuideController } from '$lib/utils';
  import GuideArticle from '../GuideArticle.svelte';
  import GuidePanel from '../GuidePanel.svelte';
  import GuideProvider from '../GuideProvider.svelte';
  import GuideRef from '../GuideRef.svelte';

  let {
    controller = undefined,
    withProvider = true,
    withPanel = true,
    refArticle = 'target',
    articleId = 'target'
  }: {
    controller?: GuideController;
    withProvider?: boolean;
    withPanel?: boolean;
    refArticle?: string;
    articleId?: string;
  } = $props();

  // Drives the target GuideArticle's mount/unmount so a test can assert GuideRef's
  // reactive degrade→upgrade (span↔button) as the panel's hasArticle(id) flips.
  let present = $state(true);
</script>

<button data-testid="toggle-article" type="button" onclick={() => (present = !present)}>
  toggle
</button>

{#snippet ref()}
  <GuideRef article={refArticle}>go to target</GuideRef>
{/snippet}

{#snippet panelBody()}
  {#if present}
    <GuideArticle id={articleId} title="Target Article">
      <p>Target body</p>
    </GuideArticle>
  {/if}
  {@render ref()}
{/snippet}

{#if withProvider}
  <GuideProvider {controller}>
    {#if withPanel}
      <GuidePanel title="Help">
        {@render panelBody()}
      </GuidePanel>
    {:else}
      {@render ref()}
    {/if}
  </GuideProvider>
{:else}
  {@render ref()}
{/if}
