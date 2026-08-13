<script lang="ts" generics="Item">
  import type { Component } from 'svelte';
  import {
    Button,
    resolveIcon,
    EditIcon as EditIconDefault,
    TrashIcon as TrashIconDefault,
    EyeIcon as EyeIconDefault
  } from '@urbicon-ui/blocks';

  const EditIcon = resolveIcon('edit', EditIconDefault);
  const TrashIcon = resolveIcon('trash', TrashIconDefault);
  const EyeIcon = resolveIcon('eye', EyeIconDefault);
  import { useTableI18n } from '../i18n';
  import { actionCellVariants, type ActionCellVariantProps } from '$lib/variants';

  const tt = useTableI18n();

  /**
   * Extra action descriptor for `ActionButtons`. Renders an additional ghost
   * Button next to the built-in view/edit/delete trio so callers don't have to
   * fall back to a custom cell snippet for one extra action.
   */
  export type ExtraAction<Item> = {
    /** Icon component (e.g. the imported `ActivityIcon`). */
    icon: Component<{ class?: string; [key: string]: unknown }>;
    /** Accessible label and tooltip — used for `aria-label`. */
    label: string;
    /** Click handler. Receives the row item. */
    onClick: (item: Item) => void;
    /** Button intent. @default 'secondary' */
    intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';
    /** Predicate that disables this action for a given item. @default () => false */
    disabled?: (item: Item) => boolean;
    /** Predicate that hides this action for a given item entirely. @default () => true */
    show?: (item: Item) => boolean;
    /** Optional `data-testid` suffix; defaults to a slugified label. */
    testIdSuffix?: string;
  };

  export type ActionButtonsProps<Item> = {
    onEdit?: (item: Item) => void;
    onDelete?: (item: Item) => void;
    onView?: (item: Item) => void;
    canEdit?: (item: Item) => boolean;
    canDelete?: (item: Item) => boolean;
    /**
     * Whether to render the button. Unset, each one follows its handler: pass
     * `onEdit` and the edit button appears, leave it out and it does not. Set
     * it explicitly only to render a button you handle elsewhere, or to hide
     * one you do handle.
     */
    showEdit?: boolean;
    /** See {@link ActionButtonsProps.showEdit} — follows `onDelete` when unset. */
    showDelete?: boolean;
    /** See {@link ActionButtonsProps.showEdit} — follows `onView` when unset. */
    showView?: boolean;
    /**
     * Extra actions rendered before the built-in view/edit/delete buttons.
     * Use this for app-specific actions (e.g. "Show readings", "Duplicate")
     * instead of writing a custom cell snippet.
     */
    extraActions?: ExtraAction<Item>[];
    item: Item;
    idProperty?: keyof Item;
    size?: ActionCellVariantProps['size'];
    variant?: ActionCellVariantProps['variant'];
    className?: string;
    testId?: string;
    align?: 'left' | 'center' | 'right';
    maxWidth?: string;
  };

  let {
    item,
    showEdit = undefined,
    showDelete = undefined,
    showView = undefined,
    extraActions = [],
    onEdit = undefined,
    onDelete = undefined,
    onView = undefined,
    canEdit = () => true,
    canDelete = () => true,
    idProperty = 'id' as keyof Item,
    size = 'sm',
    variant = 'ghost',
    className = '',
    testId = undefined,
    align = 'right',
    maxWidth = '7rem'
  }: ActionButtonsProps<Item> = $props();

  function slugify(label: string): string {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function makeExtraHandler(action: ExtraAction<Item>) {
    return (event: MouseEvent) => {
      event.stopPropagation();
      if (action.disabled?.(item)) return;
      action.onClick(item);
    };
  }

  const id = $derived((item[idProperty] ?? '').toString());

  const computedTestId = $derived(() => {
    if (testId) return testId;
    return `action-buttons-${id}`;
  });

  // Container styling for consistent layout
  const containerStyles = $derived(
    actionCellVariants({
      size,
      variant
    })
  );

  // A button nobody handles is not a button. `showDelete` used to default to
  // `true` and `onDelete` to a no-op, so `TableColumns.actions('Actions', {
  // onEdit })` rendered a delete button that silently did nothing — the docs'
  // own examples all carried a `showDelete: false` to undo it. The flags still
  // win when set explicitly; unset, they follow the handler, which makes the
  // silent state unrepresentable rather than merely discouraged.
  const viewVisible = $derived(showView ?? onView !== undefined);
  const editVisible = $derived(showEdit ?? onEdit !== undefined);
  const deleteVisible = $derived(showDelete ?? onDelete !== undefined);

  // Count visible buttons
  const visibleButtonsCount = $derived(() => {
    let count = 0;
    if (viewVisible) count++;
    if (editVisible) count++;
    if (deleteVisible) count++;
    return count;
  });

  function handleEdit(event: MouseEvent) {
    event.stopPropagation();
    if (canEdit(item)) {
      onEdit?.(item);
    }
  }

  function handleDelete(event: MouseEvent) {
    event.stopPropagation();
    if (canDelete(item)) {
      onDelete?.(item);
    }
  }

  function handleView(event: MouseEvent) {
    event.stopPropagation();
    onView?.(item);
  }
</script>

<!-- Container with fixed width and alignment -->
<div
  class="flex min-h-10 items-center px-2 py-1 {align === 'center'
    ? 'justify-center'
    : align === 'right'
      ? 'justify-end'
      : 'justify-start'} {className}"
  style="max-width: {maxWidth}; width: {maxWidth};"
  data-testid={computedTestId()}
>
  <!-- Button container -->
  <div class="{containerStyles.container()} w-full">
    {#if viewVisible}
      <Button
        variant="ghost"
        size="xs"
        intent="secondary"
        onclick={handleView}
        aria-label={tt('actions.showDetails')}
        data-testid={`view-${id}`}
        class="{containerStyles.button()} flex-shrink-0"
      >
        <EyeIcon class={containerStyles.icon()} />
      </Button>
    {/if}

    {#each extraActions as action (action.testIdSuffix ?? action.label)}
      {#if action.show?.(item) ?? true}
        {@const ExtraIcon = action.icon}
        {@const isDisabled = action.disabled?.(item) ?? false}
        <Button
          variant="ghost"
          size="xs"
          intent={action.intent ?? 'secondary'}
          onclick={makeExtraHandler(action)}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          aria-label={action.label}
          title={action.label}
          data-testid={`${action.testIdSuffix ?? slugify(action.label)}-${id}`}
          class="{containerStyles.button()} flex-shrink-0"
        >
          <ExtraIcon class={containerStyles.icon()} />
        </Button>
      {/if}
    {/each}

    {#if editVisible}
      <Button
        variant="ghost"
        size="xs"
        intent="primary"
        onclick={handleEdit}
        disabled={!canEdit(item)}
        aria-disabled={!canEdit(item)}
        aria-label={tt('actions.edit')}
        data-testid={`edit-${id}`}
        class="{containerStyles.button()} flex-shrink-0"
      >
        <EditIcon class={containerStyles.icon()} />
      </Button>
    {/if}

    {#if deleteVisible}
      <Button
        variant="ghost"
        size="xs"
        intent="danger"
        onclick={handleDelete}
        disabled={!canDelete(item)}
        aria-disabled={!canDelete(item)}
        aria-label={tt('actions.delete')}
        data-testid={`delete-${id}`}
        class="{containerStyles.button()} flex-shrink-0"
      >
        <TrashIcon class={containerStyles.icon()} />
      </Button>
    {/if}
  </div>
</div>
