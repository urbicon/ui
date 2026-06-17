<script lang="ts">
  import type { IconProps, IconName } from './icon.context';
  import { getIcon } from './icon.context';

  let { name, ...restProps }: IconProps & { name: IconName } = $props();

  const ResolvedIcon = $derived(getIcon(name));
</script>

<ResolvedIcon {...restProps} />
