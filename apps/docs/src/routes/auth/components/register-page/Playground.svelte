<!-- Knobless auth playground — see docs/DocsPageGuide.md → "Auth playgrounds
     carry no knobs". Stage: BasicDemo (mocked API), snippet: Basic.svelte. -->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { PlaygroundConfigurator } from '@urbicon-ui/docs';
  import BasicDemo from './examples/BasicDemo.svelte';
  import basicCode from './examples/Basic.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();
</script>

<PlaygroundConfigurator
  componentName="RegisterPage"
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  codeGenerator={() => basicCode}
>
  {#snippet children()}
    <div class="mx-auto w-full max-w-md">
      <BasicDemo />
    </div>
  {/snippet}
</PlaygroundConfigurator>
