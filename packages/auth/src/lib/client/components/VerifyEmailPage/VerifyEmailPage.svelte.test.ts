// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { fetcherReturning, jsonResponse, mounter, settle } from '../__fixtures__/fetcher.js';
import {
  errorMessage,
  errorRegion,
  liveRegionsAround,
  statusRegion,
  successMessage
} from '../__fixtures__/live-regions.js';
import type { VerifyEmailPageProps } from './index.js';
import VerifyEmailPage from './VerifyEmailPage.svelte';

// The page acts on mount and has no form: what it owns is the one live region
// that carries the spinner, then the outcome.

const mountInBody = mounter();
const render = (props: Partial<VerifyEmailPageProps> = {}) =>
  mountInBody(VerifyEmailPage, { token: 'verify-1', ...props } as VerifyEmailPageProps);

describe('VerifyEmailPage', () => {
  it('shows the spinner inside the live region until the server answers, then the confirmation', async () => {
    const fetcher = fetcherReturning(jsonResponse(200, {}));
    render({ fetcher, slotClasses: { success: 'qa-success' } });

    expect(screen.getByRole('heading', { name: 'Verify email' })).toBeTruthy();
    // The pending state lives in the polite region, so that its replacement by
    // the outcome is one announced content change — and in that region only:
    // the Spinner's own `role="status"` is stripped at the call site.
    expect(statusRegion().textContent).toContain('Verifying your email...');
    expect(liveRegionsAround(screen.getByText('Verifying your email...'))).toHaveLength(1);
    expect(errorRegion().textContent?.trim()).toBe('');

    await settle();

    const [url, init] = vi.mocked(fetcher).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/verify-email');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'verify-1' });
    const message = successMessage();
    expect(liveRegionsAround(message)).toHaveLength(1);
    expect(message.textContent).toContain('Your email has been verified.');
    expect(message.className).toContain('qa-success');
    expect(screen.queryByText('Verifying your email...')).toBeNull();
  });

  it('reports a missing token without asking the server', async () => {
    const fetcher = fetcherReturning();
    render({ token: undefined, fetcher });
    await settle();

    expect(fetcher).not.toHaveBeenCalled();
    expect(errorRegion().textContent).toContain('Invalid or expired verification link.');
  });

  it('announces a rejected link in the live region through the `error` slot', async () => {
    render({
      fetcher: fetcherReturning(jsonResponse(400, {})),
      slotClasses: { error: 'qa-error' }
    });
    await settle();

    const message = errorMessage();
    expect(liveRegionsAround(message)).toHaveLength(1);
    expect(message.textContent).toContain('Invalid or expired verification link.');
    expect(message.className).toContain('qa-error');
  });

  it('does not read a rate limit as a broken link', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(429, { code: 'rate_limited' })) });
    await settle();

    // "Your link is broken" steers the user into requesting a new link when
    // retrying the same one would work.
    const text = errorRegion().textContent ?? '';
    expect(text).toContain('Too many requests');
    expect(text).not.toContain('verification link');
  });
});
