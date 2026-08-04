<script lang="ts">
  import type { IconProps } from './icon.context';
  import IconWrapper from './IconWrapper.svelte';
  import content from './svg/align-justify.svg?raw';

  let props: IconProps = $props();
</script>

<IconWrapper {...props} {content} />
