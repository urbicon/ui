<script lang="ts">
  import type { Snippet } from 'svelte';
  import { setIcons, type IconSet } from './icon.context';

  let { icons, children }: { icons: Partial<IconSet>; children: Snippet } = $props();

  setIcons(icons);
</script>

{@render children()}
