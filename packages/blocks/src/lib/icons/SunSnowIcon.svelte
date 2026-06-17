<script lang="ts">
  import type { IconProps } from './icon.context';
  import IconWrapper from './IconWrapper.svelte';
  import content from './svg/sun-snow.svg?raw';

  let props: IconProps = $props();
</script>

<IconWrapper {...props} {content} />
