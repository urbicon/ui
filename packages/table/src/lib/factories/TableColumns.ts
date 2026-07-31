import type { Column, DataAccessor } from '$lib/types/tableTypes';
import ActionButtons, { type ActionButtonsProps } from '../cells/ActionButtons.svelte';
import CopyButton, { type CopyButtonProps } from '../cells/CopyButton.svelte';
import CustomCell, { type CustomCellProps } from '../cells/CustomCell.svelte';
import DateCell, { type DateCellProps } from '../cells/DateCell.svelte';
import LinkCell, { type LinkCellProps } from '../cells/LinkCell.svelte';
import NumberCell, { type NumberCellProps } from '../cells/NumberCell.svelte';
import StatusBadge, { type StatusBadgeProps } from '../cells/StatusBadge.svelte';
import UserAvatar, { type UserAvatarProps } from '../cells/UserAvatar.svelte';

// ===================================================================
// Helper types for flat API structure
// ===================================================================

/** Common column configuration properties shared across all factory methods. */
type BaseColumnProps = {
  sortable?: boolean;
  searchable?: boolean;
  groupable?: boolean;
  summable?: boolean;
  dataType?: 'text' | 'number' | 'date' | 'boolean' | 'email' | 'url';
  /**
   * Mobile-card responsive priority: `1`/unset = primary (first becomes the card
   * title), `2` = secondary detail field, `3` = omitted from the card (desktop
   * table still shows it). The desktop table always shows every column.
   */
  priority?: 1 | 2 | 3;
  align?: 'left' | 'center' | 'right';
  width?: string;
  minWidth?: string;
  flex?: boolean;
  /**
   * Whether the user may hide this column (visibility menu + header hide
   * action). Defaults to `true`; set `false` to pin it as always-visible — e.g.
   * a primary identifier or an actions column. See the table-level
   * `enableColumnVisibility` prop to turn the whole feature off.
   */
  hideable?: boolean;
};

type UserAvatarFactoryOptions<Item> = BaseColumnProps &
  Partial<Omit<UserAvatarProps<Item>, 'item'>>;
type ActionButtonsFactoryOptions<Item> = BaseColumnProps & Omit<ActionButtonsProps<Item>, 'item'>;
type StatusBadgeFactoryOptions<Item> = BaseColumnProps &
  Partial<Omit<StatusBadgeProps<Item>, 'item'>>;
type CopyButtonFactoryOptions<Item> = BaseColumnProps &
  Partial<Omit<CopyButtonProps<Item>, 'item'>>;
type CustomCellFactoryOptions<Item> = BaseColumnProps &
  Partial<Omit<CustomCellProps<Item>, 'item'>>;
type DateCellFactoryOptions<Item> = BaseColumnProps & Partial<Omit<DateCellProps<Item>, 'item'>>;
type LinkCellFactoryOptions<Item> = BaseColumnProps & Partial<Omit<LinkCellProps<Item>, 'item'>>;
type NumberCellFactoryOptions<Item> = BaseColumnProps &
  Partial<Omit<NumberCellProps<Item>, 'item'>>;

// ===================================================================
// Factory implementation
// ===================================================================

/**
 * Column factory functions for common cell types.
 *
 * Data-column factories (everything except {@link TableColumns.actions}) bind
 * the cell to a primitive-valued property via a string accessor. The
 * property name doubles as the column id — search, sort, group and summary
 * all read through the accessor, so values stay consistent across views.
 *
 * The synthetic {@link TableColumns.actions} factory produces a column
 * without an accessor — by definition it is not searchable, sortable, or
 * groupable, and the type system reflects that.
 *
 * @example
 * ```ts
 * const columns = [
 *   TableColumns.userAvatar<User>('name', 'Employee'),
 *   TableColumns.status<User>('status'),
 *   TableColumns.number<User>('salary', 'Salary', { summable: true }),
 *   TableColumns.date<User>('hireDate', 'Hired'),
 *   TableColumns.actions<User>('', { onView: (item) => goto(`/users/${item.id}`) }),
 * ];
 * ```
 */
export const TableColumns = {
  /**
   * Creates a UserAvatar column displaying an avatar alongside user name/email.
   */
  userAvatar: <Item>(
    accessor: DataAccessor<Item>,
    title = 'User',
    options: UserAvatarFactoryOptions<Item> = {}
  ): Column<Item> => {
    const {
      sortable,
      searchable,
      groupable,
      summable,
      dataType,
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable,
      ...componentProps
    } = options;

    return {
      accessor,
      title,
      component: UserAvatar,
      componentProps: (item: Item) => ({
        item,
        ...componentProps
      }),

      sortable: sortable ?? true,
      searchable: searchable ?? true,
      groupable: groupable ?? true,
      summable: summable ?? false,
      dataType: dataType ?? 'text',
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable
    };
  },

  /**
   * Creates an ActionButtons column (view/edit/delete). Synthetic — no data
   * accessor, structurally excluded from search/sort/group.
   */
  actions: <Item>(
    title = 'Actions',
    options: ActionButtonsFactoryOptions<Item> = {} as ActionButtonsFactoryOptions<Item>
  ): Column<Item> => {
    const { priority, align, width, minWidth, flex, hideable, ...componentProps } = options;

    return {
      id: 'actions',
      title,
      component: ActionButtons,
      componentProps: (item: Item) => ({
        item,
        ...componentProps
      }),
      priority,
      align: align ?? 'right',
      width: width ?? '120px',
      minWidth,
      flex,
      hideable
    };
  },

  /**
   * Creates a StatusBadge column displaying a colored badge. Centered, groupable.
   */
  status: <Item>(
    accessor: DataAccessor<Item>,
    title = 'Status',
    options: StatusBadgeFactoryOptions<Item> = {}
  ): Column<Item> => {
    const {
      sortable,
      searchable,
      groupable,
      summable,
      dataType,
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable,
      ...componentProps
    } = options;

    return {
      accessor,
      title,
      component: StatusBadge,
      componentProps: (item: Item) => ({
        item,
        statusKey: accessor,
        ...componentProps
      }),
      sortable: sortable ?? true,
      searchable: searchable ?? true,
      groupable: groupable ?? true,
      summable: summable ?? false,
      dataType: dataType ?? 'text',
      priority,
      align: align ?? 'center',
      width: width ?? '100px',
      minWidth,
      flex,
      hideable
    };
  },

  /**
   * Creates a CopyButton column with a click-to-copy button. Centered, non-sortable.
   */
  copy: <Item>(
    accessor: DataAccessor<Item>,
    title = 'Copy',
    options: CopyButtonFactoryOptions<Item> = {}
  ): Column<Item> => {
    const {
      sortable,
      searchable,
      groupable,
      summable,
      dataType,
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable,
      ...componentProps
    } = options;

    return {
      accessor,
      title,
      component: CopyButton,
      componentProps: (item: Item) => ({
        item,
        valueKey: accessor,
        ...componentProps
      }),
      sortable: sortable ?? false,
      searchable: searchable ?? false,
      groupable: groupable ?? false,
      summable: summable ?? false,
      dataType: dataType ?? 'text',
      priority,
      align: align ?? 'center',
      width: width ?? '100px',
      minWidth,
      flex,
      hideable
    };
  },

  /**
   * Creates a CustomCell column for generic text content with optional styling.
   */
  custom: <Item>(
    accessor: DataAccessor<Item>,
    title: string,
    options: CustomCellFactoryOptions<Item> = {}
  ): Column<Item> => {
    const {
      sortable,
      searchable,
      groupable,
      summable,
      dataType,
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable,
      ...componentProps
    } = options;

    return {
      accessor,
      title,
      component: CustomCell,
      componentProps: (item: Item) => ({
        item,
        ...componentProps
      }),
      sortable: sortable ?? true,
      searchable: searchable ?? true,
      groupable: groupable ?? false,
      summable: summable ?? false,
      dataType: dataType ?? 'text',
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable
    };
  },

  /**
   * Creates a DateCell column with locale-aware date formatting.
   */
  date: <Item>(
    accessor: DataAccessor<Item>,
    title = 'Date',
    options: DateCellFactoryOptions<Item> = {}
  ): Column<Item> => {
    const {
      sortable,
      searchable,
      groupable,
      summable,
      dataType,
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable,
      ...componentProps
    } = options;

    return {
      accessor,
      title,
      component: DateCell,
      componentProps: (item: Item) => ({
        item,
        dateKey: accessor,
        ...componentProps
      }),
      sortable: sortable ?? true,
      searchable: searchable ?? true,
      groupable: groupable ?? true,
      summable: summable ?? false,
      dataType: dataType ?? 'date',
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable
    };
  },

  /**
   * Creates a LinkCell column rendering an anchor tag.
   */
  link: <Item>(
    accessor: DataAccessor<Item>,
    title = 'Link',
    options: LinkCellFactoryOptions<Item> = {}
  ): Column<Item> => {
    const {
      sortable,
      searchable,
      groupable,
      summable,
      dataType,
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable,
      ...componentProps
    } = options;

    return {
      accessor,
      title,
      component: LinkCell,
      componentProps: (item: Item) => ({
        item,
        urlKey: accessor,
        ...componentProps
      }),
      sortable: sortable ?? true,
      searchable: searchable ?? true,
      groupable: groupable ?? false,
      summable: summable ?? false,
      dataType: dataType ?? 'url',
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable
    };
  },

  /**
   * Creates a NumberCell column with locale-aware number formatting.
   */
  number: <Item>(
    accessor: DataAccessor<Item>,
    title = 'Number',
    options: NumberCellFactoryOptions<Item> = {}
  ): Column<Item> => {
    const {
      sortable,
      searchable,
      groupable,
      summable,
      dataType,
      priority,
      align,
      width,
      minWidth,
      flex,
      hideable,
      ...componentProps
    } = options;

    return {
      accessor,
      title,
      component: NumberCell,
      componentProps: (item: Item) => ({
        item,
        valueKey: accessor,
        ...componentProps
      }),
      sortable: sortable ?? true,
      searchable: searchable ?? true,
      groupable: groupable ?? true,
      summable: summable ?? true,
      dataType: dataType ?? 'number',
      priority,
      align: align ?? 'right',
      width,
      minWidth,
      flex,
      hideable
    };
  },

  /**
   * Creates a plain text column with optional formatter.
   *
   * Everything the column can do follows from what you configure, never from
   * what it is called. Until 2026-07-31 an accessor named `price`, `age`,
   * `amount`, `score` (and five more) was silently treated as numeric — right
   * aligned, offered Sum/Avg/Min/Max — while a genuinely numeric `throughput`
   * got none of it. A `price` column yielding `'$95'` was offered a sum that
   * cannot work, and the result was a dash indistinguishable from "no rows".
   *
   * For a numeric column say so: {@link TableColumns.number}, or
   * `dataType: 'number'` here. Alignment and summability then follow from the
   * declared type, which is a derivation from configuration rather than a guess
   * about a name.
   */
  text: <Item>(
    accessor: DataAccessor<Item>,
    title: string,
    options: BaseColumnProps & {
      formatter?: (value: unknown, item: Item) => string;
    } = {}
  ): Column<Item> => {
    const { formatter, ...columnProps } = options;
    const dataType = columnProps.dataType ?? 'text';
    const isNumeric = dataType === 'number';

    return {
      accessor,
      title,
      formatter,
      sortable: columnProps.sortable ?? true,
      searchable: columnProps.searchable ?? true,
      summable: columnProps.summable ?? isNumeric,
      dataType,
      groupable: columnProps.groupable ?? true,
      priority: columnProps.priority,
      align: columnProps.align ?? (isNumeric ? 'right' : 'left'),
      width: columnProps.width,
      minWidth: columnProps.minWidth,
      flex: columnProps.flex,
      hideable: columnProps.hideable
    };
  }
};

// Re-export for TypeScript support
export type {
  ActionButtonsFactoryOptions,
  BaseColumnProps,
  CopyButtonFactoryOptions,
  CustomCellFactoryOptions,
  DateCellFactoryOptions,
  LinkCellFactoryOptions,
  NumberCellFactoryOptions,
  StatusBadgeFactoryOptions,
  UserAvatarFactoryOptions
};
