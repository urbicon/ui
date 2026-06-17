<script lang="ts">
  import type { IconProps } from './icon.context';
  import IconWrapper from './IconWrapper.svelte';
  import content from './svg/sunset.svg?raw';

  let props: IconProps = $props();
</script>

<IconWrapper {...props} {content} />
