// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FileUpload from './FileUpload.svelte';

// The root's restProps contract (COMPONENT-API-CONVENTIONS § restProps ordering): rest spreads
// first, so the region landmark survives a consumer `role`; a consumer `aria-label` names the
// region over the localized default on purpose, because that default is the same for every
// instance on a page.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: ComponentProps<typeof FileUpload> = {}) {
  const instance = mount(FileUpload, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

describe('FileUpload (restProps)', () => {
  it('keeps the region landmark against a consumer role', () => {
    render({ role: 'presentation', 'data-testid': 'upload' });
    const root = screen.getByTestId('upload');
    expect(root.getAttribute('role')).toBe('region');
  });

  it('is named by the localized default without a consumer aria-label', () => {
    render();
    expect(screen.getByRole('region', { name: 'File upload' })).toBeTruthy();
  });

  it('is named by a consumer aria-label over the localized default', () => {
    render({ 'aria-label': 'Invoice attachments' });
    expect(screen.getByRole('region', { name: 'Invoice attachments' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'File upload' })).toBeNull();
  });
});
