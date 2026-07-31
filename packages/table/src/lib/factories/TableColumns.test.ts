import { describe, expect, it } from 'vitest';
import { resolveColumnId } from '$lib/utils';
import { TableColumns } from './TableColumns';

type TestItem = {
  id: number;
  name: string;
  status: string;
  email: string;
  amount: number;
  created: string;
  url: string;
};

/**
 * A second shape for the "capability follows configuration" cases, kept apart so
 * the fixtures above stay as they were. `price` is a **string** on purpose — it
 * is the reported failure (a column named `price` whose accessor yields `'$95'`)
 * — while `throughput` and `umsatz` are numbers whose names the old regex did
 * not know, in English and in German.
 */
type PricedItem = { price: string; throughput: number; umsatz: number };

/**
 * `Column<Item>` is a union and only its data-carrying arm has `dataType` /
 * `summable` / `align`. `TableColumns.text` always produces that arm, so these
 * tests narrow once here rather than casting at every assertion.
 */
const asData = <Item>(col: ReturnType<typeof TableColumns.text<Item>>) =>
  col as Exclude<ReturnType<typeof TableColumns.text<Item>>, { accessor?: never }>;

describe('TableColumns factory', () => {
  describe('common column shape', () => {
    it('userAvatar produces a column with component and componentProps', () => {
      const col = TableColumns.userAvatar<TestItem>('name', 'User');
      expect(resolveColumnId(col)).toBe('name');
      expect(col.title).toBe('User');
      expect(col.component).toBeDefined();
      expect(col.componentProps).toBeInstanceOf(Function);
    });

    it('actions produces a synthetic, right-aligned column without accessor', () => {
      const col = TableColumns.actions<TestItem>('Actions');
      expect(resolveColumnId(col)).toBe('actions');
      expect(col.accessor).toBeUndefined();
      expect(col.align).toBe('right');
    });

    it('status produces a centered column', () => {
      const col = TableColumns.status<TestItem>('status', 'Status');
      expect(resolveColumnId(col)).toBe('status');
      expect(col.align).toBe('center');
      // status is a data column → the derivable flags exist on it.
      expect('sortable' in col && col.sortable).toBe(true);
      expect('groupable' in col && col.groupable).toBe(true);
    });

    it('copy produces a column with correct accessor', () => {
      const col = TableColumns.copy<TestItem>('email', 'Email');
      expect(resolveColumnId(col)).toBe('email');
      expect(col.component).toBeDefined();
    });

    it('number produces a right-aligned numeric column', () => {
      const col = TableColumns.number<TestItem>('amount', 'Amount');
      expect(resolveColumnId(col)).toBe('amount');
      expect(col.align).toBe('right');
      expect('summable' in col && col.summable).toBe(true);
      expect('dataType' in col && col.dataType).toBe('number');
    });

    it('date produces a date-typed column', () => {
      const col = TableColumns.date<TestItem>('created', 'Created');
      expect(resolveColumnId(col)).toBe('created');
      expect('sortable' in col && col.sortable).toBe(true);
      expect('dataType' in col && col.dataType).toBe('date');
    });

    it('link produces a column with link component', () => {
      const col = TableColumns.link<TestItem>('url', 'Link');
      expect(resolveColumnId(col)).toBe('url');
      expect(col.component).toBeDefined();
    });
  });

  describe('text: capability follows configuration, not the accessor name', () => {
    /**
     * Until 2026-07-31 this factory read the accessor against
     * `/^(age|salary|price|amount|count|number|projectsCompleted|rating|score)$/i`
     * and, on a match, silently set `dataType: 'number'`, `align: 'right'` and
     * `summable: true`. Three consequences worth pinning, because "the regex is
     * gone" is not visible in the current code:
     */

    it('leaves a numerically-named column plain text', () => {
      const col = asData(TableColumns.text<PricedItem>('price', 'Price'));
      expect(col.dataType).toBe('text');
      expect(col.align).toBe('left');
      expect(col.summable).toBe(false);
    });

    it('derives alignment and summability from a declared number type', () => {
      // Not a guess about a name — a derivation from what the consumer declared.
      const col = asData(
        TableColumns.text<PricedItem>('throughput', 'Throughput', { dataType: 'number' })
      );
      expect(col.align).toBe('right');
      expect(col.summable).toBe(true);
    });

    it('still lets explicit options win over the derivation', () => {
      const col = asData(
        TableColumns.text<TestItem>('amount', 'Amount', {
          dataType: 'number',
          align: 'left',
          summable: false
        })
      );
      expect(col.align).toBe('left');
      expect(col.summable).toBe(false);
    });

    it('treats a non-English numeric name the same as an English one', () => {
      // The old list held nine English nouns, so the behaviour depended on the
      // language the consumer names their columns in. Both are plain text now.
      for (const name of ['umsatz', 'price'] as const) {
        expect(asData(TableColumns.text<PricedItem>(name, name)).dataType, name).toBe('text');
      }
    });
  });

  describe('options override defaults', () => {
    it('allows overriding sortable, align, width', () => {
      const col = TableColumns.status<TestItem>('status', 'Status', {
        sortable: false,
        align: 'left',
        width: '200px',
        priority: 2
      });
      expect('sortable' in col && col.sortable).toBe(false);
      expect(col.align).toBe('left');
      expect(col.width).toBe('200px');
      expect(col.priority).toBe(2);
    });
  });

  describe('hideable flag', () => {
    const sampleItem: TestItem = {
      id: 1,
      name: 'Alice',
      status: 'active',
      email: 'a@b.com',
      amount: 100,
      created: '2024-01-01',
      url: 'https://example.com'
    };

    it('is undefined by default (column stays hideable)', () => {
      const col = TableColumns.status<TestItem>('status', 'Status');
      expect(col.hideable).toBeUndefined();
    });

    it('threads hideable: false onto the column, not into componentProps', () => {
      const col = TableColumns.status<TestItem>('status', 'Status', { hideable: false });
      expect(col.hideable).toBe(false);
      // Must not leak into the cell component's props (the whitelist-destructure guard).
      const props = col.componentProps!(sampleItem);
      expect('hideable' in props).toBe(false);
    });

    it('is supported on synthetic actions columns', () => {
      const col = TableColumns.actions<TestItem>('Actions', { hideable: false });
      expect(col.hideable).toBe(false);
    });

    it('is threaded by the text factory (columnProps path)', () => {
      const col = TableColumns.text<TestItem>('name', 'Name', { hideable: false });
      expect(col.hideable).toBe(false);
    });
  });

  describe('componentProps factory', () => {
    it('returns item in componentProps output', () => {
      const col = TableColumns.userAvatar<TestItem>('name', 'User');
      const testItem: TestItem = {
        id: 1,
        name: 'Alice',
        status: 'active',
        email: 'a@b.com',
        amount: 100,
        created: '2024-01-01',
        url: 'https://example.com'
      };
      const props = col.componentProps!(testItem);
      expect(props.item).toBe(testItem);
    });

    it('passes extra options through componentProps', () => {
      const col = TableColumns.status<TestItem>('status', 'Status', {
        statusMap: { active: { label: 'Active', intent: 'success' } }
      } as unknown as Parameters<typeof TableColumns.status<TestItem>>[2]);
      const testItem: TestItem = {
        id: 1,
        name: 'Alice',
        status: 'active',
        email: 'a@b.com',
        amount: 100,
        created: '2024-01-01',
        url: 'https://example.com'
      };
      const props = col.componentProps!(testItem);
      expect(props.statusMap).toBeDefined();
    });
  });

  describe('column.cell is not set by factories', () => {
    it('factory columns do not have a cell snippet (handled via component)', () => {
      const cols = [
        TableColumns.userAvatar<TestItem>('name'),
        TableColumns.actions<TestItem>(),
        TableColumns.status<TestItem>('status'),
        TableColumns.number<TestItem>('amount'),
        TableColumns.date<TestItem>('created'),
        TableColumns.link<TestItem>('url'),
        TableColumns.copy<TestItem>('email')
      ];
      for (const col of cols) {
        expect(col.cell).toBeUndefined();
      }
    });
  });
});
