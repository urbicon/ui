<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { chatVariants } from './chat.variants';
  import type { ChatProps } from './index';

  let {
    children,
    header,
    composer,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ChatProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const styles = chatVariants();
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Chat', preset, {}, slotClassesProp)
  );

  function cls(name: keyof typeof slotClasses, extra?: string | (string | undefined)[]) {
    if (unstyled) {
      const own = slotClasses?.[name];
      return [own, ...(Array.isArray(extra) ? extra : [extra])].filter(Boolean).join(' ');
    }
    const slotFns = styles as Record<string, (args: { class?: unknown }) => string>;
    return slotFns[name]({
      class: [slotClasses?.[name], ...(Array.isArray(extra) ? extra : [extra])]
    });
  }
</script>

<div class={cls('root', className)} {...restProps}>
  {#if header}
    <div class={cls('header')}>
      {@render header()}
    </div>
  {/if}

  <div class={cls('body')}>
    {@render children?.()}
  </div>

  {#if composer}
    <div class={cls('composer')}>
      {@render composer()}
    </div>
  {/if}
</div>
