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
