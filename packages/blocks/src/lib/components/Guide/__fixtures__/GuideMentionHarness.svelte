<script lang="ts">
  // Test-only composition harness for GuideMention — the Guide→UI affordance. It reads the
  // GuideProvider controller through context and highlights a `[data-guide="…"]` target on
  // hover/focus/click, so the interaction test mounts a real GuideProvider plus the target
  // elements. `mentions`/`targets` are arrays (mirrors StepperHarness's `steps`) so a single
  // harness covers the single-mention cases and the two-mention topic-guard case. Under
  // __fixtures__/ so it is excluded from the published package and never collected as a test.
  import type { GuideController, GuideDirection } from '$lib/utils';
  import GuideMention from '../GuideMention.svelte';
  import GuideProvider from '../GuideProvider.svelte';

  type MentionSpec = { for: string; text: string; direction?: GuideDirection };

  let {
    controller = undefined,
    withProvider = true,
    mentions = [{ for: 'save', text: 'Save button' }] as MentionSpec[],
    targets = ['save']
  }: {
    controller?: GuideController;
    withProvider?: boolean;
    mentions?: MentionSpec[];
    targets?: string[];
  } = $props();

  // Drives the mentions' mount/unmount so a test can assert the ownership teardown releases a
  // highlight the unmounting mention still owns.
  let present = $state(true);
</script>

<button data-testid="toggle-mention" type="button" onclick={() => (present = !present)}>
  toggle
</button>

{#each targets as t (t)}
  <div data-guide={t}>{t} target</div>
{/each}

{#snippet mentionList()}
  {#each mentions as m (m.for)}
    <GuideMention for={m.for} direction={m.direction}>{m.text}</GuideMention>
  {/each}
{/snippet}

{#if withProvider}
  <GuideProvider {controller}>
    {#if present}
      {@render mentionList()}
    {/if}
  </GuideProvider>
{:else}
  {@render mentionList()}
{/if}
