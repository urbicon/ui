<script lang="ts">
  import BlocksProvider from '$lib/provider/BlocksProvider.svelte';
  import type { ComponentDefaults, ComponentPreset } from '$lib/provider/blocks-context';
  import Link from '../Link.svelte';
  import type { LinkProps } from '../index';

  // One mount point for the three provider-side inputs a Link resolves against.
  // Declarative primitive, so the link's own props are handed through as one
  // object rather than spelled out here.
  let {
    defaults,
    presets,
    props
  }: {
    defaults?: Record<string, ComponentDefaults>;
    presets?: Record<string, Record<string, ComponentPreset>>;
    props: LinkProps;
  } = $props();
</script>

<BlocksProvider defaults={defaults ?? {}} presets={presets ?? {}}>
  <Link {...props} />
</BlocksProvider>
