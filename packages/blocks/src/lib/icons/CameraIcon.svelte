<script lang="ts">
  import IconWrapper from './IconWrapper.svelte';
  import type { IconProps } from './icon.context';
  import content from './svg/camera.svg?raw';

  let props: IconProps = $props();
</script>

<IconWrapper {...props} {content} />
