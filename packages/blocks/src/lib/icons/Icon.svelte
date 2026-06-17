<script lang="ts">
  import type { IconProps, IconName } from './icon-types';
  import { getIcon } from './icon-registry';

  let { name, ...restProps }: IconProps & { name: IconName } = $props();

  const ResolvedIcon = $derived(getIcon(name));
</script>

<ResolvedIcon {...restProps} />
