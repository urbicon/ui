// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { mounter } from '../__fixtures__/fetcher.js';
import { errorRegion, liveRegionsAround, statusRegion } from '../__fixtures__/live-regions.js';
import FormErrorAlert from './FormErrorAlert.svelte';

const render = mounter();

describe('FormErrorAlert', () => {
  it('lets the error win when both are set, and leaves the polite region empty', () => {
    // No component sets both today, so only a direct test can hold this.
    render(FormErrorAlert, { error: 'ERR', success: 'OK' });

    expect(errorRegion().textContent).toContain('ERR');
    expect(statusRegion().textContent?.trim()).toBe('');
  });

  it('keeps both regions in the DOM while there is nothing to announce', () => {
    render(FormErrorAlert, { error: '' });

    expect(errorRegion()).toBeTruthy();
    expect(errorRegion().textContent?.trim()).toBe('');
    expect(statusRegion()).toBeTruthy();
    expect(statusRegion().textContent?.trim()).toBe('');
  });

  it('announces a success politely, not as an alert', () => {
    render(FormErrorAlert, { error: '', success: 'Saved.' });

    expect(statusRegion().textContent).toContain('Saved.');
    expect(errorRegion().textContent?.trim()).toBe('');
  });

  it('puts each outcome in exactly one live region', () => {
    render(FormErrorAlert, { error: 'ERR' });
    // The `Alert` inside hard-codes `role="alert"`; the pass-through has to
    // take it off, or the message sits in a region inside a region.
    expect(liveRegionsAround(screen.getByText('ERR'))).toHaveLength(1);

    render(FormErrorAlert, { error: '', success: 'OK' });
    expect(liveRegionsAround(screen.getByText('OK'))).toHaveLength(1);
  });
});

describe('FormErrorAlert — the region precedes the message', () => {
  // Not through `mounter`: this is the one assertion that needs the SAME
  // element before and after, so the props have to change under a live mount
  // instead of a second render.
  let dispose: (() => void) | undefined;
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.replaceChildren();
  });

  it('fills the region that was already there instead of inserting a new one', () => {
    const props = $state({ error: '' });
    const instance = mount(FormErrorAlert, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();

    const before = errorRegion();
    expect(before.textContent?.trim()).toBe('');

    props.error = 'Something went wrong.';
    flushSync();

    // A screen reader announces an insertion into a region it already knew;
    // a region that arrives together with its text is announced by nobody.
    expect(errorRegion()).toBe(before);
    expect(before.textContent).toContain('Something went wrong.');
  });
});
