<script lang="ts">
  import { getIcon } from './icon-registry';
  import type { IconName, IconProps } from './icon-types';

  let { name, ...restProps }: IconProps & { name: IconName } = $props();

  const ResolvedIcon = $derived(getIcon(name));
</script>

<ResolvedIcon {...restProps} />
