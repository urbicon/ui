// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Avatar from './Avatar.svelte';
import type { AvatarProps } from './index';

// #200: the status dot's aria-label was a hard-coded English template
// (`Status: ${status}`), so it announced English inside an otherwise localised
// app. It now resolves through the blocks i18n bundle (`avatar.status.*`),
// like every other announced string. Assertions read the base-locale (`en`)
// strings — the en/de key parity is guarded by `translations.parity.test.ts`.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<AvatarProps> = {}) {
  const instance = mount(Avatar, {
    target: document.body,
    props: props as AvatarProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Avatar — localised status label (#200)', () => {
  // Every status variant must resolve to a defined translation key — a raw
  // key or the old English template here means a status was added without
  // its `avatar.status.*` entry.
  it.each([
    ['online', 'Online'],
    ['offline', 'Offline'],
    ['away', 'Away'],
    ['busy', 'Busy']
  ] as const)('announces status="%s" as "%s" from the i18n bundle', (status, label) => {
    render({ name: 'Ada Lovelace', status });
    const dot = screen.getByRole('img', { name: label });
    expect(dot.getAttribute('aria-label')).toBe(label);
    // Not the pre-#200 hard-coded template.
    expect(dot.getAttribute('aria-label')).not.toContain('Status:');
  });

  it('renders no status dot (and no stray img role) without a status', () => {
    render({ name: 'Ada Lovelace' });
    expect(screen.queryByRole('img')).toBeNull();
  });
});
