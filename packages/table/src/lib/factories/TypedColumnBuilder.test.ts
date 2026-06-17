import { describe, expect, it } from 'vitest';
import { resolveColumnId } from '$lib/utils';
import { TypedColumnBuilder } from './TypedColumnBuilder';

type TestItem = {
  id: number;
  name: string;
  status: string;
  email: string;
  amount: number;
  created: string;
  url: string;
  special: string;
};

describe('TypedColumnBuilder', () => {
  describe('default titles are English', () => {
    it('userAvatar defaults to "User"', () => {
      const cols = TypedColumnBuilder.for<TestItem>().userAvatar('name').build();
      expect(cols[0].title).toBe('User');
    });

    it('actions defaults to "Actions"', () => {
      const cols = TypedColumnBuilder.for<TestItem>().actions().build();
      expect(cols[0].title).toBe('Actions');
    });

    it('status defaults to "Status"', () => {
      const cols = TypedColumnBuilder.for<TestItem>().status('status').build();
      expect(cols[0].title).toBe('Status');
    });

    it('copy defaults to "Copy"', () => {
      const cols = TypedColumnBuilder.for<TestItem>().copy('email').build();
      expect(cols[0].title).toBe('Copy');
    });

    it('date defaults to "Date"', () => {
      const cols = TypedColumnBuilder.for<TestItem>().date('created').build();
      expect(cols[0].title).toBe('Date');
    });

    it('link defaults to "Link"', () => {
      const cols = TypedColumnBuilder.for<TestItem>().link('url').build();
      expect(cols[0].title).toBe('Link');
    });

    it('number defaults to "Number"', () => {
      const cols = TypedColumnBuilder.for<TestItem>().number('amount').build();
      expect(cols[0].title).toBe('Number');
    });
  });

  describe('custom titles override defaults', () => {
    it('userAvatar accepts custom title', () => {
      const cols = TypedColumnBuilder.for<TestItem>().userAvatar('name', 'Employee').build();
      expect(cols[0].title).toBe('Employee');
    });

    it('actions accepts custom title', () => {
      const cols = TypedColumnBuilder.for<TestItem>().actions('Ops').build();
      expect(cols[0].title).toBe('Ops');
    });
  });

  describe('fluent API', () => {
    it('chains multiple columns and builds in order', () => {
      const cols = TypedColumnBuilder.for<TestItem>()
        .userAvatar('name')
        .status('status')
        .number('amount')
        .actions()
        .build();

      expect(cols).toHaveLength(4);
      expect(resolveColumnId(cols[0])).toBe('name');
      expect(resolveColumnId(cols[1])).toBe('status');
      expect(resolveColumnId(cols[2])).toBe('amount');
      expect(resolveColumnId(cols[3])).toBe('actions');
    });

    it('custom() adds an arbitrary column definition', () => {
      const cols = TypedColumnBuilder.for<TestItem>()
        .custom({ accessor: 'special', title: 'Special' })
        .build();

      expect(cols).toHaveLength(1);
      expect(resolveColumnId(cols[0])).toBe('special');
    });

    it('build() returns a new array (immutable)', () => {
      const builder = TypedColumnBuilder.for<TestItem>().userAvatar('name');
      const a = builder.build();
      const b = builder.build();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });
});
