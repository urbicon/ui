// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fetcherReturning, jsonResponse, mounter, settle } from '../__fixtures__/fetcher.js';
import type { SessionManagerProps } from './index.js';
import SessionManager from './SessionManager.svelte';

// Drives the real component through its injected `fetcher`; the list is loaded
// in `onMount`, so this needs both jsdom knobs (see the InvitationManager suite).

const session = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  ip: '10.0.0.1',
  lastActive: '2026-01-01T00:00:00.000Z',
  current: false,
  ...over
});

const mountInBody = mounter();
const render = (props: Partial<SessionManagerProps> = {}) =>
  mountInBody(SessionManager, props as SessionManagerProps);

const liveRegion = () => document.body.querySelector('[aria-live="polite"]') as HTMLElement;

describe('SessionManager (component)', () => {
  it('renders one row per session, naming the device and marking this one', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, {
          sessions: [session({ id: 'me', current: true }), session({ id: 'other', ip: null })]
        })
      )
    });
    await settle();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    // The UA heuristic is the only device description the user gets; a wrong
    // read here is a device the user cannot recognise and will not sign out.
    expect(rows[0].textContent).toContain('Chrome · macOS');
    expect(within(rows[0]).getByText('This device')).toBeTruthy();
    expect(within(rows[0]).queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(within(rows[1]).getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out other devices' })).toBeTruthy();
  });

  it('renders the error in the live region, not the empty state, when the load fails', async () => {
    render({
      fetcher: fetcherReturning(jsonResponse(401, { code: 'not_authenticated' })),
      slotClasses: { error: 'qa-error' }
    });
    await settle();

    // "No active sessions." next to a 401 would read as a clean slate.
    expect(screen.queryByText('No active sessions.')).toBeNull();
    const alert = screen.getByRole('alert');
    expect(liveRegion().contains(alert)).toBe(true);
    expect(alert.textContent).toContain('Please sign in to continue.');
    expect(alert.className).toContain('qa-error');
  });

  it('explains an unavailable session history instead of showing an empty list', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(200, { sessions: [], available: false })) });
    await settle();

    expect(screen.getByText('Session history requires refresh-token rotation.')).toBeTruthy();
    expect(screen.queryByText('No active sessions.')).toBeNull();
  });

  it('drops the row once the server confirms the sign-out', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { sessions: [session({ current: true, id: 'me' }), session()] }),
        jsonResponse(200, {})
      )
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await settle();

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    // The last other device is gone, so there is nobody left to sign out.
    expect(screen.queryByRole('button', { name: 'Sign out other devices' })).toBeNull();
  });

  it('keeps the row and shows the error when the sign-out fails', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { sessions: [session()] }),
        jsonResponse(500, { code: 'server_error' })
      )
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await settle();

    // An optimistic remove would show a device as signed out while its session
    // is still valid on the server.
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('reloads the list after signing out the other devices', async () => {
    const fetcher = fetcherReturning(
      jsonResponse(200, { sessions: [session({ id: 'me', current: true }), session()] }),
      jsonResponse(200, {}),
      jsonResponse(200, { sessions: [session({ id: 'me', current: true })] })
    );
    render({ fetcher });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out other devices' }));
    await settle();

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it.each([
    ['null', null],
    ['an array', []]
  ])(
    'reports a refusal whose JSON body is %s as the generic error, not as a network failure',
    async (_, body) => {
      render({
        fetcher: fetcherReturning(
          jsonResponse(200, { sessions: [session()] }),
          jsonResponse(500, body)
        )
      });
      await settle();

      await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      await settle();

      // The server answered; a body that is valid JSON but not an object must
      // not be reported as "check your connection".
      expect(screen.getByRole('alert').textContent).toContain('An error occurred');
    }
  );
});
