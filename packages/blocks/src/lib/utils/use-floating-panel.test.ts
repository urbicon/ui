import { describe, expect, it } from 'vitest';
import { type FloatingPanelState, floatingPanelHidden } from './use-floating-panel.svelte';

/**
 * `floatingPanelHidden` decides whether a floating panel needs an explicit
 * `display: none` while closed. It exists because top-layer (`popover`) panels
 * and in-place panels hide differently: the former via the UA
 * `[popover]:not(:popover-open){display:none}` rule, the latter (no popover
 * attribute) only if the caller drives `display`. Callers apply the result with
 * a per-property `style:display` directive — never a `style={…}` string — so
 * Floating UI's imperative `left`/`top` writes are never clobbered (Codeberg #23).
 */
describe('floatingPanelHidden', () => {
  const state = (topLayer: boolean): FloatingPanelState => ({
    topLayer,
    strategy: 'fixed',
    zIndex: topLayer ? null : 'var(--z-dropdown)'
  });

  it('never hides a top-layer panel — the UA :popover-open rule owns its visibility', () => {
    expect(floatingPanelHidden(state(true), false)).toBe(false);
    expect(floatingPanelHidden(state(true), true)).toBe(false);
  });

  it('hides an in-place panel only while closed — no UA rule without the popover attribute', () => {
    expect(floatingPanelHidden(state(false), false)).toBe(true);
    expect(floatingPanelHidden(state(false), true)).toBe(false);
  });
});
