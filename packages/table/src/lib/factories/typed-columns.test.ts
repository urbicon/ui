/**
 * Type-only assertion file. Compiles iff the table package's public API
 * preserves the `T` generic end-to-end:
 *
 * - `Column<Apartment>[]` is assignable wherever `Column<Apartment>[]` is expected.
 * - `TypedColumnBuilder.for<Apartment>().build()` returns `Column<Apartment>[]`
 *   without an `as` cast.
 * - `TableProps<Apartment>['onRowClick']` correctly receives `Apartment`.
 *
 * Not a runtime test — `.test-d.ts` files are picked up by the type checker.
 * vitest's default include also runs `.test.ts`, so we wrap in a runtime
 * `describe` to keep both pipelines happy.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { Column, TableProps } from '../types/index';
import { TableColumns } from './TableColumns';
import { TypedColumnBuilder } from './TypedColumnBuilder';

interface Apartment {
  id: number;
  name: string;
  size: number;
}

describe('Table generic preservation', () => {
  it('TypedColumnBuilder.build() returns Column<Item>[] without widening', () => {
    const cols = TypedColumnBuilder.for<Apartment>()
      .text('name', 'Name')
      .number('size', 'Size')
      .actions()
      .build();

    expectTypeOf(cols).toEqualTypeOf<Column<Apartment>[]>();
  });

  it('TableColumns factories return typed Column<Item>', () => {
    const col = TableColumns.text<Apartment>('name', 'Name');
    expectTypeOf(col).toEqualTypeOf<Column<Apartment>>();
  });

  it('TableProps<Apartment> threads the generic through callbacks/items/columns', () => {
    expectTypeOf<TableProps<Apartment>['items']>().toEqualTypeOf<Apartment[] | undefined>();
    expectTypeOf<TableProps<Apartment>['columns']>().toEqualTypeOf<
      Column<Apartment>[] | undefined
    >();
    expectTypeOf<TableProps<Apartment>['onRowClick']>().toEqualTypeOf<
      ((item: Apartment) => void) | undefined
    >();
    // The ids ride along untyped by the generic on purpose: they are whatever
    // `item.id` is, plus the array-index fallback for rows without one.
    expectTypeOf<TableProps<Apartment>['onSelectionChange']>().toEqualTypeOf<
      ((selectedItems: Apartment[], selectedIds: Array<string | number>) => void) | undefined
    >();
  });

  it('Column<Apartment>[] from the builder is directly assignable to TableProps<Apartment>.columns', () => {
    const cols = TypedColumnBuilder.for<Apartment>().text('name', 'Name').build();
    const props: TableProps<Apartment> = { columns: cols, items: [] };
    expectTypeOf(props.columns).toEqualTypeOf<Column<Apartment>[] | undefined>();
  });
});
