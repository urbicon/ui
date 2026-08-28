// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PASSWORD_POLICY } from '../../../password-policy.js';
import type { AuthUser } from '../../../types.js';
import {
  fetcherAnswering,
  fetcherReturning,
  jsonResponse,
  mounter,
  settle
} from '../__fixtures__/fetcher.js';
import AccountSettings from './AccountSettings.svelte';
import type { AccountSettingsProps } from './index.js';

// Covers the danger zone: deleting an account is the one action in this package
// that cannot be undone, so what guards it has to be described by a test rather
// than read off the markup. What is asserted here is what this component owns —
// the disabled trigger, the two-step confirmation, the failure path. The
// single-flight of the confirm click belongs to ConfirmDialog and is pinned in
// its own suite, not duplicated here (see the comment at `confirmDelete`).

const user: AuthUser = {
  id: 'u1',
  email: 'a@example.com',
  name: 'Ada',
  role: 'USER',
  emailVerified: true
} as AuthUser;

const mountInBody = mounter();
const render = (props: Partial<AccountSettingsProps> = {}) =>
  mountInBody(AccountSettings, { user, ...props } as AccountSettingsProps);

// Three sections ask for the current password; the danger zone is the one that
// is a named landmark, which is how its field and trigger are told apart here.
const dangerZone = () => within(screen.getByRole('region', { name: 'Delete account' }));

/** The form a labelled field belongs to, and the live region inside it. */
const formOf = (label: string) => screen.getByLabelText(label).closest('form') as HTMLFormElement;
const liveRegionOf = (form: HTMLElement) =>
  form.querySelector('[aria-live="polite"]') as HTMLElement;

/** Fill the password and walk the danger zone up to the open confirm dialog. */
async function openDeleteConfirm() {
  await userEvent.type(dangerZone().getByLabelText('Current password'), 'hunter2');
  await tick();
  await userEvent.click(dangerZone().getByRole('button', { name: 'Delete account' }));
  await tick();
  await tick();
}

/** The confirm button lives in the dialog, which jsdom keeps out of the tree. */
const confirmButton = () =>
  within(screen.getByRole('dialog', { hidden: true })).getByRole('button', {
    name: 'Delete account',
    hidden: true
  });

describe('AccountSettings — forms', () => {
  it('ties the new-password field to the requirements checklist', () => {
    render({ fetcher: fetcherReturning(), passwordPolicy: DEFAULT_PASSWORD_POLICY });

    const describedBy =
      screen.getByLabelText('New password').getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.getAttribute('aria-label')).toBe(
      'Password requirements'
    );
  });

  it("announces a saved profile in that form's own live region and reports the user", async () => {
    const onProfileUpdated = vi.fn();
    const updated = { ...user, name: 'Ada L.' };
    render({
      onProfileUpdated,
      passwordPolicy: DEFAULT_PASSWORD_POLICY,
      fetcher: fetcherReturning(jsonResponse(200, { user: updated }))
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Profile updated.');
    // Four forms, four regions: the message belongs next to the form it
    // answers, not in a shared banner that could be scrolled out of view.
    expect(liveRegionOf(formOf('Name')).contains(alert)).toBe(true);
    expect(onProfileUpdated).toHaveBeenCalledWith(updated);
  });

  it("announces a rejected email change in that form's own live region", async () => {
    render({
      passwordPolicy: DEFAULT_PASSWORD_POLICY,
      fetcher: fetcherReturning(jsonResponse(401, { code: 'current_password_incorrect' }))
    });

    const form = formOf('New email');
    await userEvent.type(within(form).getByLabelText('New email'), 'new@example.com');
    await userEvent.type(within(form).getByLabelText('Current password'), 'wrong');
    await userEvent.click(within(form).getByRole('button', { name: 'Change email' }));
    await settle();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Current password is incorrect.');
    expect(liveRegionOf(form).contains(alert)).toBe(true);
    expect(liveRegionOf(formOf('Name')).querySelector('[role="alert"]')).toBeNull();
  });
});

describe('AccountSettings — danger zone', () => {
  it('keeps the trigger inert until a password is entered', async () => {
    render({ fetcher: fetcherReturning() });

    const trigger = () => dangerZone().getByRole('button', { name: 'Delete account' });
    expect(trigger().hasAttribute('disabled')).toBe(true);

    await userEvent.type(dangerZone().getByLabelText('Current password'), 'hunter2');
    await tick();
    expect(trigger().hasAttribute('disabled')).toBe(false);
  });

  it('sends nothing until the confirmation is answered', async () => {
    const fetcher = fetcherAnswering(200, {});
    render({ fetcher });

    await openDeleteConfirm();
    // The policy lookup on mount is the password form's own traffic, not the
    // danger zone's — count only what leaves for the account endpoint.
    const accountRequests = () =>
      vi.mocked(fetcher).mock.calls.filter(([url]) => url !== '/api/auth/password-policy');
    // The one irreversible action in this package is two steps on purpose: the
    // trigger opens the dialog and nothing else. Wiring it straight to
    // `confirmDelete` would delete the account on the first click.
    expect(accountRequests()).toHaveLength(0);
    expect(screen.getByRole('dialog', { hidden: true })).toBeTruthy();

    await userEvent.click(confirmButton());
    await settle();
    expect(accountRequests()).toHaveLength(1);
  });

  it('reports a rejected delete instead of calling onDeleted', async () => {
    const onDeleted = vi.fn();
    render({ onDeleted, fetcher: fetcherAnswering(401, { code: 'invalid_credentials' }) });

    await openDeleteConfirm();
    await userEvent.click(confirmButton());
    await settle();

    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
