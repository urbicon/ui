// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mounter } from '../__fixtures__/fetcher.js';
import type { NotificationBadgeProps } from './index.js';
import NotificationBadge from './NotificationBadge.svelte';

const mountInBody = mounter();
const render = (props: Partial<NotificationBadgeProps> = {}) =>
  mountInBody(NotificationBadge, { count: 0, ...props } as NotificationBadgeProps);

describe('NotificationBadge', () => {
  it('renders nothing at zero', () => {
    render({ count: 0 });

    expect(document.body.textContent?.trim()).toBe('');
  });

  it('shows the count and caps it at 99+', () => {
    render({ count: 7 });
    expect(screen.getByText('7')).toBeTruthy();

    render({ count: 150 });
    expect(screen.getByText('99+')).toBeTruthy();
    expect(screen.queryByText('150')).toBeNull();
  });

  it('reports a click and carries the `root` slot on the badge itself', async () => {
    const onclick = vi.fn();
    render({ count: 3, onclick, slotClasses: { root: 'qa-root' } });

    const badge = screen.getByText('3');
    expect(badge.closest('.qa-root')).toBeTruthy();
    await userEvent.click(badge);

    expect(onclick).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationBadge — how it is announced', () => {
  it('is a button and a tab stop with a handler', () => {
    render({ count: 3, onclick: () => {} });

    const badge = screen.getByRole('button');
    expect(badge.getAttribute('tabindex')).toBe('0');
  });

  it('is a polite live region without one, and no focus stop', () => {
    render({ count: 3 });

    // `Badge` derives the role from the handler. The region exists from the
    // first unread on — it is not there at zero, where the badge renders
    // nothing at all — so a change between two non-zero counts happens inside a
    // region that was already there.
    const badge = screen.getByRole('status');
    expect(badge.hasAttribute('tabindex')).toBe(false);
  });

  it('names itself instead of announcing a bare number', () => {
    render({ count: 3 });
    expect(screen.getByRole('status', { name: 'Unread notifications: 3' })).toBeTruthy();

    // Past the cap the name says what the badge shows: a voice-control user
    // can only say the label they can read.
    render({ count: 150 });
    expect(screen.getByRole('status', { name: 'Unread notifications: 99+' })).toBeTruthy();
  });

  it("takes the consumer's own name and locale over the default", () => {
    render({ count: 3, 'aria-label': 'Three new things' });
    expect(screen.getByRole('status', { name: 'Three new things' })).toBeTruthy();

    render({ count: 3, t: { notifications: { badge: { unread: '{n} ungelesen' } } } });
    expect(screen.getByRole('status', { name: '3 ungelesen' })).toBeTruthy();
  });

  it('passes the rest of its attributes to the badge root, next to `class`', () => {
    render({ count: 3, id: 'bell-count', 'data-testid': 'badge', class: 'qa-class' });

    const badge = screen.getByRole('status');
    expect(badge.id).toBe('bell-count');
    expect(badge.getAttribute('data-testid')).toBe('badge');
    // `class` is the component's own prop and keeps landing on the root — the
    // rest spread must not take it over or drop it.
    expect(badge.className).toContain('qa-class');
  });
});

describe('NotificationBadge — the interactive look follows the handler', () => {
  // #201: the affordance and the semantics are one decision. Without a handler
  // the badge is not a button and not a tab stop, so it must not look pressable
  // either.
  const AFFORDANCE = [
    'cursor-pointer',
    'hover:scale-105',
    'active:scale-95',
    'hover:bg-danger-hover',
    'active:bg-danger-active'
  ];

  it('carries the pressable classes with an `onclick`', () => {
    render({ count: 3, onclick: () => {} });

    const badge = screen.getByRole('button');
    for (const cls of AFFORDANCE) expect(badge.className).toContain(cls);
  });

  it('carries none of them without one', () => {
    render({ count: 3 });

    const badge = screen.getByRole('status');
    for (const cls of AFFORDANCE) expect(badge.className).not.toContain(cls);
  });
});
