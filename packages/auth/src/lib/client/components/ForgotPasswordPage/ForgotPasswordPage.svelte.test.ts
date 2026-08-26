// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fetcherReturning, jsonResponse, mounter, settle } from '../__fixtures__/fetcher.js';
import ForgotPasswordPage from './ForgotPasswordPage.svelte';
import type { ForgotPasswordPageProps } from './index.js';

const mountInBody = mounter();
const render = (props: Partial<ForgotPasswordPageProps> = {}) =>
  mountInBody(ForgotPasswordPage, props as ForgotPasswordPageProps);

const liveRegion = () => document.body.querySelector('[aria-live="polite"]') as HTMLElement;

async function request(email = 'ada@example.com') {
  await userEvent.type(screen.getByLabelText('Email address'), email);
  await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  await settle();
}

describe('ForgotPasswordPage', () => {
  it('renders the labelled email field, the explanation and the way back', () => {
    render({ fetcher: fetcherReturning() });

    expect(screen.getByRole('heading', { name: 'Forgot password' })).toBeTruthy();
    expect(screen.getByLabelText('Email address').getAttribute('type')).toBe('email');
    expect(screen.getByText(/Enter your email address/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to sign in' }).getAttribute('href')).toBe(
      '/auth/login'
    );
    // The region exists before there is anything to say — that is what makes
    // a later error an announcement rather than a silent DOM change.
    expect(liveRegion()).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('replaces the form with the enumeration-safe confirmation on success', async () => {
    const fetcher = fetcherReturning(jsonResponse(200, {}));
    render({ fetcher, slotClasses: { success: 'qa-success' } });

    await request();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('If an account with that email exists');
    expect(alert.className).toContain('qa-success');
    expect(screen.queryByRole('button', { name: 'Send reset link' })).toBeNull();
    const [, init] = vi.mocked(fetcher).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ email: 'ada@example.com' });
  });

  it('announces a refusal in the live region and keeps the form', async () => {
    render({
      fetcher: fetcherReturning(jsonResponse(429, { code: 'rate_limited' })),
      slotClasses: { error: 'qa-error' }
    });

    await request();

    const alert = screen.getByRole('alert');
    expect(liveRegion().contains(alert)).toBe(true);
    expect(alert.textContent).toContain('Too many requests');
    expect(alert.className).toContain('qa-error');
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeTruthy();
  });

  it('reports a thrown fetch as a network error', async () => {
    render({ fetcher: fetcherReturning(new TypeError('Failed to fetch')) });

    await request();

    expect(screen.getByRole('alert').textContent).toContain('Network error');
  });
});
