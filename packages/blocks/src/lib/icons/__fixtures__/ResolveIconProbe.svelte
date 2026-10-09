<script lang="ts">
  // What a library component does with an icon it renders itself: a direct
  // default import, resolved through `resolveIcon` so an `IconProvider`
  // override still wins.
  import type { IconProps } from '../icon-types';
  import { resolveIcon } from '../icon.context';
  import LogOutIconDefault from '../LogOutIcon.svelte';

  let props: IconProps = $props();

  const LogOutIcon = resolveIcon('logOut', LogOutIconDefault);
</script>

<LogOutIcon {...props} />
