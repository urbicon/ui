// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  installMemoryStorage,
  installStorage,
  restoreStorage
} from '../../../../../../scripts/vitest-storage';
import ThemeSwitcher from './ThemeSwitcher.svelte';

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  restoreStorage();
  document.body.replaceChildren();
  document.documentElement.classList.remove('light', 'dark');
});

function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(ThemeSwitcher, { target, props });
  flushSync();
  dispose = () => unmount(component);
  return target;
}

function click(target: HTMLElement) {
  target.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  flushSync();
}

describe('ThemeSwitcher persistence', () => {
  it('remembers the choice in localStorage, and only there', () => {
    const local = installMemoryStorage('localStorage');
    const session = installMemoryStorage('sessionStorage');
    const target = render();

    // The documented cycle: system → light → dark → system, where system is
    // stored as the ABSENCE of the key.
    click(target);
    expect(local.getItem('urbicon-theme')).toBe('light');
    expect(session.getItem('urbicon-theme')).toBeNull();

    click(target);
    expect(local.getItem('urbicon-theme')).toBe('dark');

    click(target);
    expect(local.getItem('urbicon-theme')).toBeNull();
    expect(session.length).toBe(0);
  });

  it('reads the stored theme back on the next mount', () => {
    installMemoryStorage('localStorage', { 'urbicon-theme': 'dark' });

    render();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('writes nothing when storageKey is false', () => {
    const local = installMemoryStorage();

    const target = render({ storageKey: false });
    click(target);

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(local.length).toBe(0);
  });
});

/**
 * Storage the consumer's environment refuses to provide. Each case must cost
 * the persistence and nothing else — the button still switches the theme.
 */
const HOSTILE: Array<[string, PropertyDescriptor]> = [
  ['a storage object with no methods', { value: {} }],
  ['no storage object at all', { value: undefined }],
  [
    'a property that throws on access',
    {
      get() {
        throw new DOMException('denied', 'SecurityError');
      }
    }
  ],
  [
    'a setItem that throws',
    {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('quota', 'QuotaExceededError');
        },
        removeItem: () => {}
      }
    }
  ]
];

describe.each(HOSTILE)('ThemeSwitcher with %s', (_name, descriptor) => {
  it('mounts, applies the theme, and keeps switching', () => {
    installStorage(descriptor);
    // A stale class from the previous page. `onMount` reads storage and then
    // calls `applyTheme()`, which in system mode removes both classes — so the
    // class surviving is what a mount aborted by the storage read looks like.
    document.documentElement.classList.add('dark');

    const changes: string[] = [];
    const target = render({ onThemeChange: (theme: string) => changes.push(theme) });

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    click(target);

    // The class is written before the storage call, so only `onThemeChange`
    // firing proves the click handler ran past it.
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(changes).toEqual(['light']);
  });
});
