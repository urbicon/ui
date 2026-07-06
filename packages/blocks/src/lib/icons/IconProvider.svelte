<script lang="ts">
  import type { Snippet } from 'svelte';
  import { setIcons, type IconSet } from './icon.context';

  let { icons, children }: { icons: Partial<IconSet>; children: Snippet } = $props();

  // Provider config is applied once at init — icon overrides are not meant to
  // swap reactively after mount.
  // svelte-ignore state_referenced_locally
  setIcons(icons);
</script>

{@render children()}
