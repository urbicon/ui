// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PASSWORD_POLICY } from '../../../password-policy.js';
import { fetcherReturning, jsonResponse, mounter, settle } from '../__fixtures__/fetcher.js';
import type { RegisterPageProps } from './index.js';
import RegisterPage from './RegisterPage.svelte';

// The policy is passed as a prop throughout: it is what an SSR load hands in,
// and it keeps the policy request off the fetcher queue so each test's server
// answers exactly the registration call.

const mountInBody = mounter();
const render = (props: Partial<RegisterPageProps> = {}) =>
  mountInBody(RegisterPage, {
    passwordPolicy: DEFAULT_PASSWORD_POLICY,
    token: 'inv-1',
    ...props
  } as RegisterPageProps);

const liveRegion = () => document.body.querySelector('[aria-live="polite"]') as HTMLElement;

async function fill(password = 'hunter2hunter2', confirm = password) {
  await userEvent.type(screen.getByLabelText('Full name'), 'Ada');
  await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com');
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.type(screen.getByLabelText('Confirm password'), confirm);
}

async function submit() {
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  await settle();
}

describe('RegisterPage', () => {
  it('renders the labelled fields and ties the password to its requirements', () => {
    render({ fetcher: fetcherReturning() });

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeTruthy();
    expect(screen.getByLabelText('Full name')).toBeTruthy();
    expect(screen.getByLabelText('Email address').getAttribute('type')).toBe('email');
    const password = screen.getByLabelText('Password');
    expect(password.getAttribute('type')).toBe('password');
    // The checklist is the field's description, or a screen reader never hears
    // which rules the password has to meet.
    const describedBy = password.getAttribute('aria-describedby') ?? '';
    const requirements = document.getElementById(describedBy);
    expect(requirements?.getAttribute('aria-label')).toBe('Password requirements');
    expect(requirements?.textContent).toContain('At least 8 characters');
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/auth/login');
  });

  it('seeds the email from the invite link and leaves it editable', () => {
    render({ defaultEmail: 'invitee@example.com', fetcher: fetcherReturning() });

    const email = screen.getByLabelText('Email address') as HTMLInputElement;
    expect(email.value).toBe('invitee@example.com');
    expect(email.hasAttribute('readonly')).toBe(false);
  });

  it('sends name, email, password and the invitation token in the body, then calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const fetcher = fetcherReturning(jsonResponse(201, { user: { id: 'u1' } }));
    render({ onSuccess, fetcher });

    await fill();
    await submit();

    const [url, init] = vi.mocked(fetcher).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/register');
    // The token is a credential: body, never query string (it would land in
    // server logs and the Referer header).
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'hunter2hunter2',
      token: 'inv-1'
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('refuses mismatching passwords before any request', async () => {
    const fetcher = fetcherReturning();
    render({ fetcher });

    await fill('hunter2hunter2', 'hunter2hunter3');
    await submit();

    expect(fetcher).not.toHaveBeenCalled();
    // Twice, on purpose: the field flags itself while typing (its own alert,
    // `aria-invalid`), and the submit is refused through the page's region.
    expect(screen.getByLabelText('Confirm password').getAttribute('aria-invalid')).toBe('true');
    expect(within(liveRegion()).getByRole('alert').textContent).toContain('Passwords do not match');
  });

  it('refuses a password below the policy before any request, naming the rule', async () => {
    const fetcher = fetcherReturning();
    render({ fetcher });

    await fill('short');
    await submit();

    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('At least 8 characters');
  });

  it('announces a refusal in the live region and keeps onSuccess unfired', async () => {
    const onSuccess = vi.fn();
    render({
      onSuccess,
      fetcher: fetcherReturning(jsonResponse(409, { code: 'email_taken' })),
      slotClasses: { error: 'qa-error' }
    });

    await fill();
    await submit();

    const alert = screen.getByRole('alert');
    expect(liveRegion().contains(alert)).toBe(true);
    expect(alert.textContent).toContain('This email is already registered.');
    expect(alert.className).toContain('qa-error');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
