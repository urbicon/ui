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
