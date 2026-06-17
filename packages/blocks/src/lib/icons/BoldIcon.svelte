<script lang="ts">
  import type { IconProps } from './icon.context';
  import IconWrapper from './IconWrapper.svelte';
  import content from './svg/bold.svg?raw';

  let props: IconProps = $props();
</script>

<IconWrapper {...props} {content} />
