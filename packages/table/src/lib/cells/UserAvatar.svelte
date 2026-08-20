<script lang="ts" generics="Item">
  // Use our own Avatar component instead of Flowbite
  import { Avatar } from '@urbicon-ui/blocks';
  import SearchHighlight from '../features/SearchHighlight.svelte';
  import { userCellVariants, type UserCellVariantProps } from '$lib/variants';
  import { getNestedValue } from '$lib/utils';

  export type UserAvatarProps<Item> = {
    item: Item;
    nameKey?: keyof Item;
    emailKey?: keyof Item;
    avatarKey?: keyof Item;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    layout?: 'horizontal' | 'vertical' | 'compact';
    showEmail?: boolean;
    clickable?: boolean;
    onClick?: (item: Item) => void;
    mobile?: boolean;
  } & UserCellVariantProps;

  let {
    item,
    nameKey = 'name' as keyof Item,
    emailKey = 'email' as keyof Item,
    avatarKey = 'avatar' as keyof Item,
    size = 'md',
    layout = 'horizontal',
    showEmail = true,
    clickable = false,
    onClick = undefined,
    mobile = false
  }: UserAvatarProps<Item> = $props();

  // Performance-optimized values via $derived
  const textAt = (key: PropertyKey) => {
    const value = getNestedValue(item, String(key));
    return value != null ? String(value) : '';
  };
  const name = $derived.by(() => textAt(nameKey));
  const email = $derived.by(() => textAt(emailKey));
  const avatarUrl = $derived.by(() => textAt(avatarKey));

  const avatarSize = $derived(mobile ? (size === 'lg' ? 'md' : 'sm') : size);

  const styles = $derived(userCellVariants({ layout, size, clickable }));

  function handleClick() {
    if (clickable && onClick) {
      onClick(item);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class={styles.container()}
  onclick={handleClick}
  role={clickable ? 'button' : undefined}
  tabindex={clickable ? 0 : undefined}
>
  <div class={styles.avatar()}>
    <Avatar size={avatarSize} src={avatarUrl} alt={name} {name} variant="circle" />
  </div>

  <div class={styles.content()}>
    <div class={styles.name()} title={name}>
      <SearchHighlight text={name} />
    </div>

    {#if showEmail && email}
      <div class={styles.email()} title={email}>
        <SearchHighlight text={email} />
      </div>
    {/if}
  </div>
</div>
