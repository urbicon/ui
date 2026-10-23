// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CustomCell from './CustomCell.svelte';

type Row = { id: number; note: string };

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

describe('CustomCell content', () => {
  it('renders the returned string as text, never as markup', () => {
    const note = '<img src=x onerror="window.__customCellXss = true">';
    const instance = mount(CustomCell<Row>, {
      target: document.body,
      props: { item: { id: 1, note }, content: (row: Row) => row.note }
    });
    dispose = () => unmount(instance);
    flushSync();

    const cell = document.querySelector('[data-testid="custom-cell-1"]');
    expect(cell?.querySelector('img')).toBeNull();
    expect(cell?.textContent?.trim()).toBe(note);
  });
});
