// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UserAvatar from './UserAvatar.svelte';

type Row = { id: number; name: string };

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderCell(clickable: boolean) {
  const onClick = vi.fn();
  const item = { id: 1, name: 'Ada Lovelace' };
  const instance = mount(UserAvatar<Row>, {
    target: document.body,
    props: { item, clickable, onClick }
  });
  dispose = () => unmount(instance);
  flushSync();
  return { onClick, item, cell: document.body.firstElementChild as HTMLElement };
}

describe('UserAvatar keyboard activation', () => {
  it.each(['Enter', ' '])('a clickable cell reports %j like a click', (key) => {
    const { onClick, item, cell } = renderCell(true);
    expect(cell.getAttribute('role')).toBe('button');

    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    cell.dispatchEvent(event);

    expect(onClick).toHaveBeenCalledExactlyOnceWith(item);
    expect(event.defaultPrevented).toBe(true);
  });

  it('a cell that is not clickable ignores the keys', () => {
    const { onClick, cell } = renderCell(false);
    expect(cell.hasAttribute('role')).toBe(false);

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    cell.dispatchEvent(event);

    expect(onClick).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
