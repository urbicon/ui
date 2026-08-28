// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import type { NotificationRecord } from '../../../server/adapters/types.js';
import { mounter } from '../__fixtures__/fetcher.js';
import type { NotificationCenterProps } from './index.js';
import NotificationCenter from './NotificationCenter.svelte';

// Presentational: the list is a prop and every action is a callback, so there
// is no fetcher to drive — the store behind it has its own suite.

const record = (over: Partial<NotificationRecord> = {}): NotificationRecord => ({
  id: 'n1',
  userId: 'u1',
  typeKey: 'system',
  title: 'Deploy finished',
  body: 'Build 42 is live.',
  url: null,
  icon: null,
  readAt: null,
  createdAt: new Date(Date.now() - 5 * 60_000),
  ...over
});

const mountInBody = mounter();
const render = (props: Partial<NotificationCenterProps> = {}) =>
  mountInBody(NotificationCenter, { notifications: [], ...props } as NotificationCenterProps);

describe('NotificationCenter', () => {
  it('renders the empty state through the `empty` slot and no mark-all action', () => {
    render({ slotClasses: { empty: 'qa-empty' } });

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByText('No notifications').className).toContain('qa-empty');
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
  });

  it('renders one row per record, marks unread ones structurally and offers mark-all', () => {
    render({
      notifications: [
        record({ id: 'unread' }),
        record({ id: 'read', title: 'Older', readAt: new Date() })
      ]
    });

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0].hasAttribute('data-unread')).toBe(true);
    expect(rows[1].hasAttribute('data-unread')).toBe(false);
    expect(rows[0].textContent).toContain('Build 42 is live.');
    expect(rows[0].textContent).toContain('5 min ago');
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeTruthy();
  });

  it('marks an unread row read on click, and only reports the click for a read one', async () => {
    const onMarkAsRead = vi.fn();
    const onNotificationClick = vi.fn();
    const unread = record({ id: 'unread' });
    const read = record({ id: 'read', title: 'Older', readAt: new Date() });
    render({ notifications: [unread, read], onMarkAsRead, onNotificationClick });

    const rows = screen.getAllByRole('listitem');
    await userEvent.click(within(rows[0]).getByRole('button', { name: /Deploy finished/ }));
    await userEvent.click(within(rows[1]).getByRole('button', { name: /Older/ }));

    expect(onMarkAsRead).toHaveBeenCalledTimes(1);
    expect(onMarkAsRead).toHaveBeenCalledWith('unread');
    expect(onNotificationClick).toHaveBeenCalledTimes(2);
    expect(onNotificationClick).toHaveBeenLastCalledWith(read);
  });

  it('reports delete and mark-all through their callbacks, with an accessible delete name', async () => {
    const onDelete = vi.fn();
    const onMarkAllAsRead = vi.fn();
    render({ notifications: [record()], onDelete, onMarkAllAsRead });

    // The visible label is a bare "×"; the name has to come from elsewhere.
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(onDelete).toHaveBeenCalledWith('n1');
    expect(onMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('hands each record to the `item` snippet instead of the default row', () => {
    render({
      notifications: [record()],
      item: createRawSnippet<[NotificationRecord]>((notification) => ({
        render: () => `<span>custom:${notification().title}</span>`
      }))
    });

    expect(screen.getByText('custom:Deploy finished')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});
