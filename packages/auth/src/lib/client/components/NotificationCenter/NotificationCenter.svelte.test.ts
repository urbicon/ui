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
    // The dot is decorative, so the state has to reach a reader as text — in
    // the row button's name, and nowhere else.
    expect(within(rows[0]).getByRole('button', { name: /^Unread/ })).toBeTruthy();
    expect(within(rows[1]).queryByRole('button', { name: /^Unread/ })).toBeNull();
    expect(within(rows[1]).getByText('Older')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeTruthy();
  });

  it('marks an unread row read on click, and only reports the click for a read one', async () => {
    const onMarkAsRead = vi.fn();
    const onNotificationClick = vi.fn();
    const unread = record({ id: 'unread' });
    const read = record({ id: 'read', title: 'Older', readAt: new Date() });
    render({ notifications: [unread, read], onMarkAsRead, onNotificationClick });

    const rows = screen.getAllByRole('listitem');
    await userEvent.click(within(rows[0]).getByRole('button', { name: /^Unread Deploy finished/ }));
    await userEvent.click(within(rows[1]).getByRole('button', { name: /^Older/ }));

    expect(onMarkAsRead).toHaveBeenCalledTimes(1);
    expect(onMarkAsRead).toHaveBeenCalledWith('unread');
    expect(onNotificationClick).toHaveBeenCalledTimes(2);
    expect(onNotificationClick).toHaveBeenLastCalledWith(read);
  });

  it('reports delete and mark-all through their callbacks, with an accessible delete name', async () => {
    const onDelete = vi.fn();
    const onMarkAllAsRead = vi.fn();
    render({ notifications: [record()], onDelete, onMarkAllAsRead });

    // The visible label is a bare "×"; the name has to come from elsewhere —
    // and it names the row, because "Delete" alone repeats down the list.
    await userEvent.click(screen.getByRole('button', { name: 'Delete — Deploy finished' }));
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
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });
});

describe('NotificationCenter — the row for a reader', () => {
  it('gives the timestamp a machine-readable value next to the rounded label', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z');
    render({ notifications: [record({ createdAt })] });

    const time = document.body.querySelector('time') as HTMLTimeElement;
    // "5 min ago" is the whole reading otherwise: nothing in the row says when
    // that was, and the value cannot be re-read at a later time.
    expect(time.getAttribute('datetime')).toBe('2026-01-01T10:00:00.000Z');
  });

  it('drops the attribute rather than the list when a timestamp does not parse', () => {
    render({ notifications: [record({ createdAt: 'not-a-date' as unknown as Date })] });

    const time = document.body.querySelector('time') as HTMLTimeElement;
    expect(time.hasAttribute('datetime')).toBe(false);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('keeps the unread marker out of the delete name and the timestamp', () => {
    render({ notifications: [record()] });

    const del = screen.getByRole('button', { name: /^Delete/ });
    expect(del.getAttribute('aria-label')).toBe('Delete — Deploy finished');
    expect(del.textContent).not.toContain('Unread');
    expect((document.body.querySelector('time') as HTMLTimeElement).textContent).not.toContain(
      'Unread'
    );
  });
});
