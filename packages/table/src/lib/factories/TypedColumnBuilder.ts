import type {
  ActionButtonsFactoryOptions,
  BaseColumnProps,
  CopyButtonFactoryOptions,
  CustomCellFactoryOptions,
  DateCellFactoryOptions,
  LinkCellFactoryOptions,
  NumberCellFactoryOptions,
  StatusBadgeFactoryOptions,
  UserAvatarFactoryOptions
} from '$lib';
import { TableColumns } from '$lib';
import type { Column, DataAccessor } from '$lib/types/tableTypes';

/**
 * Typed column builder providing a fluent API for defining table columns.
 * The generic parameter `Item` constrains accessor arguments to primitive
 * properties of the data type, mirroring the runtime constraint that
 * search/sort/group only meaningfully operate on stringifiable values.
 *
 * @example
 * ```ts
 * interface User { id: number; name: string; status: string; salary: number; }
 *
 * const columns = TypedColumnBuilder.for<User>()
 *   .userAvatar('name', 'Employee')
 *   .status('status')
 *   .number('salary', 'Salary')
 *   .actions()
 *   .build();
 * ```
 */
export class TypedColumnBuilder<Item> {
  private columns: Column<Item>[] = [];

  userAvatar(
    accessor: DataAccessor<Item>,
    title = 'User',
    options: UserAvatarFactoryOptions<Item> = {}
  ): this {
    this.columns.push(TableColumns.userAvatar<Item>(accessor, title, options));
    return this;
  }

  actions(
    title = 'Actions',
    options: ActionButtonsFactoryOptions<Item> = {} as ActionButtonsFactoryOptions<Item>
  ): this {
    this.columns.push(TableColumns.actions<Item>(title, options));
    return this;
  }

  status(
    accessor: DataAccessor<Item>,
    title = 'Status',
    options: StatusBadgeFactoryOptions<Item> = {}
  ): this {
    this.columns.push(TableColumns.status<Item>(accessor, title, options));
    return this;
  }

  copy(
    accessor: DataAccessor<Item>,
    title = 'Copy',
    options: CopyButtonFactoryOptions<Item> = {}
  ): this {
    this.columns.push(TableColumns.copy<Item>(accessor, title, options));
    return this;
  }

  customCell(
    accessor: DataAccessor<Item>,
    title: string,
    options: CustomCellFactoryOptions<Item> = {}
  ): this {
    this.columns.push(TableColumns.custom<Item>(accessor, title, options));
    return this;
  }

  date(
    accessor: DataAccessor<Item>,
    title = 'Date',
    options: DateCellFactoryOptions<Item> = {}
  ): this {
    this.columns.push(TableColumns.date<Item>(accessor, title, options));
    return this;
  }

  link(
    accessor: DataAccessor<Item>,
    title = 'Link',
    options: LinkCellFactoryOptions<Item> = {}
  ): this {
    this.columns.push(TableColumns.link<Item>(accessor, title, options));
    return this;
  }

  number(
    accessor: DataAccessor<Item>,
    title = 'Number',
    options: NumberCellFactoryOptions<Item> = {}
  ): this {
    this.columns.push(TableColumns.number<Item>(accessor, title, options));
    return this;
  }

  text(
    accessor: DataAccessor<Item>,
    title: string,
    options: BaseColumnProps & {
      formatter?: (value: unknown, item: Item) => string;
    } = {}
  ): this {
    this.columns.push(TableColumns.text<Item>(accessor, title, options));
    return this;
  }

  custom(column: Column<Item>): this {
    this.columns.push(column);
    return this;
  }

  /**
   * Returns the accumulated `Column<Item>[]` directly. Pair with the generic
   * `Table<Item>` component to keep type-safety end-to-end without `as` casts.
   */
  build(): Column<Item>[] {
    return [...this.columns];
  }

  static for<T>(): TypedColumnBuilder<T> {
    return new TypedColumnBuilder<T>();
  }
}
