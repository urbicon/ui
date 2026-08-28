// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { mounter } from '../__fixtures__/fetcher.js';
import FormErrorAlert from './FormErrorAlert.svelte';

const render = mounter();

describe('FormErrorAlert', () => {
  it('lets the error win when both are set', () => {
    // No component sets both today, so only a direct test can hold this.
    render(FormErrorAlert, { error: 'ERR', success: 'OK' });

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toContain('ERR');
    expect(alerts[0].textContent).not.toContain('OK');
  });

  it('keeps the live region in the DOM while there is nothing to announce', () => {
    render(FormErrorAlert, { error: '' });

    expect(document.body.querySelector('[aria-live="polite"]')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
