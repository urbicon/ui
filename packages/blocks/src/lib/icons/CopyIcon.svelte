<script lang="ts">
  import type { IconProps } from './icon.context';
  import IconWrapper from './IconWrapper.svelte';
  import content from './svg/copy.svg?raw';

  let props: IconProps = $props();
</script>

<IconWrapper {...props} {content} />
