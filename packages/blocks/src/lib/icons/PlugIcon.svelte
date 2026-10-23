<script lang="ts">
  import IconWrapper from './IconWrapper.svelte';
  import type { IconProps } from './icon.context';
  import content from './svg/plug.svg?raw';

  let props: IconProps = $props();
</script>

<IconWrapper {...props} {content} />
