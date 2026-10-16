// @vitest-environment jsdom
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import InlineCode from './InlineCode.svelte';

let cleanup: (() => void) | null = null;

function render(text: string) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(InlineCode, { target, props: { text } });
  cleanup = () => {
    unmount(component);
    target.remove();
  };
  return target;
}

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('InlineCode', () => {
  it('renders strong, emphasis and code instead of their markers', () => {
    const target = render('Amount in **minor units**, *not* `major`; use **`CurrencyInput`**.');
    expect(target.textContent).toBe('Amount in minor units, not major; use CurrencyInput.');
    expect(target.querySelector('strong')?.textContent).toBe('minor units');
    expect(target.querySelector('em')?.textContent).toBe('not');
    expect(target.querySelector('strong code')?.textContent).toBe('CurrencyInput');
  });

  it('escapes markup in the input', () => {
    const target = render('**<img src=x onerror=alert(1)>**');
    expect(target.querySelector('img')).toBeNull();
    expect(target.querySelector('strong')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
