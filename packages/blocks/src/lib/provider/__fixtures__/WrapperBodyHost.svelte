<script lang="ts">
  import NumberInput from '$lib/components/NumberInput/NumberInput.svelte';
  import ConfirmDialog from '$lib/primitives/ConfirmDialog/ConfirmDialog.svelte';
  import Input from '$lib/primitives/Input/Input.svelte';
  import Select from '$lib/primitives/Select/Select.svelte';
  import type { ComponentDefaults } from '../blocks-context';
  import BlocksProvider from '../BlocksProvider.svelte';

  // A field in the *body* of a wrapper's dialog, not in the wrapper's own
  // markup. At runtime it is a child of the Dialog that ConfirmDialog wraps, so
  // it inherits whatever context that Dialog was left holding — which is the
  // whole question. `createRawSnippet` cannot stand in: the body has to be a
  // real component instance for a context to reach it.
  let {
    body,
    defaults = {}
  }: {
    body: 'input' | 'select' | 'number';
    defaults?: Record<string, ComponentDefaults>;
  } = $props();
</script>

{#snippet field()}
  {#if body === 'input'}
    <Input label="in the body" />
  {:else if body === 'select'}
    <Select options={[{ label: 'A', value: 'a' }]} />
  {:else}
    <NumberInput />
  {/if}
{/snippet}

<BlocksProvider {defaults}>
  <ConfirmDialog open title="Delete?" children={field} />
</BlocksProvider>
