// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QRCodeProps } from './index';
import QRCode from './QRCode.svelte';

// Render layer for QRCode: SVG structure, sizing, colours, and the too-long
// fallback. Matrix correctness is covered by qr-encode.test.ts.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<QRCodeProps> = {}) {
  const instance = mount(QRCode, {
    target: document.body,
    props: { value: 'https://ui.urbicon.de', ...props } as QRCodeProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const svg = () => document.querySelector('svg') as SVGSVGElement;

describe('QRCode', () => {
  it('renders an accessible SVG image with a single module path', () => {
    render();
    const img = screen.getByRole('img');
    expect(img.tagName.toLowerCase()).toBe('svg');
    expect(img.getAttribute('aria-label')).toBe('QR code');
    const path = svg().querySelector('path') as SVGPathElement;
    expect(path).not.toBeNull();
    expect((path.getAttribute('d') ?? '').length).toBeGreaterThan(0);
  });

  it('sizes the SVG and includes the quiet zone in the viewBox', () => {
    render({ value: '01234567', errorCorrection: 'M', size: 200, quietZone: 4 });
    const el = svg();
    expect(el.getAttribute('width')).toBe('200');
    expect(el.getAttribute('height')).toBe('200');
    // 21 modules + 2×4 quiet zone = 29.
    expect(el.getAttribute('viewBox')).toBe('0 0 29 29');
  });

  it('applies foreground and background colours', () => {
    render({ foreground: '#123456', background: '#ffffff' });
    const el = svg();
    expect((el.querySelector('path') as SVGPathElement).getAttribute('fill')).toBe('#123456');
    expect((el.querySelector('rect') as SVGRectElement).getAttribute('fill')).toBe('#ffffff');
  });

  it('omits the background rect when transparent', () => {
    render({ background: 'transparent' });
    expect(svg().querySelector('rect')).toBeNull();
  });

  it('honours a custom aria-label', () => {
    render({ 'aria-label': 'Scan to pair your authenticator' });
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Scan to pair your authenticator'
    );
  });

  it('shows a fallback and calls onError when the data cannot be encoded', () => {
    const onError = vi.fn();
    render({ value: 'x'.repeat(60), errorCorrection: 'H', maxVersion: 1, onError });
    expect(svg()).toBeNull();
    expect(onError).toHaveBeenCalledOnce();
    expect(screen.getByRole('img').textContent).toMatch(/too long/i);
  });
});

// COMPONENT-API-CONVENTIONS § Common props: attributes QRCode does not model
// land on the root `<span>`, the element `class` targets.
describe('QRCode (restProps)', () => {
  const root = () => document.querySelector('[data-testid="pairing-code"]') as HTMLElement;

  it('passes an unmodelled attribute through to the root', () => {
    render({ 'data-testid': 'pairing-code', title: 'Scan me' });
    expect(root().tagName).toBe('SPAN');
    expect(root().contains(svg())).toBe(true);
    expect(root().getAttribute('title')).toBe('Scan me');
    expect(svg().hasAttribute('data-testid')).toBe(false);
  });

  it('keeps `class` in its own pipeline beside the spread', () => {
    render({ class: 'my-code', 'data-testid': 'pairing-code' });
    expect(root().classList.contains('my-code')).toBe(true);
    // The tv() root classes survive next to the consumer's.
    expect(root().classList.contains('inline-flex')).toBe(true);
  });

  it('puts aria-describedby on the image, not on the root', () => {
    render({ 'aria-describedby': 'pairing-help', 'data-testid': 'pairing-code' });
    expect(screen.getByRole('img').getAttribute('aria-describedby')).toBe('pairing-help');
    expect(root().hasAttribute('aria-describedby')).toBe(false);
  });

  it('puts aria-describedby on the fallback image too', () => {
    render({
      value: 'x'.repeat(60),
      errorCorrection: 'H',
      maxVersion: 1,
      'aria-describedby': 'pairing-help'
    });
    expect(svg()).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-describedby')).toBe('pairing-help');
  });
});
