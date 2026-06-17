import { describe, expect, it, vi } from 'vitest';
import { arrow, flip, type MiddlewareState, offset, type Placement, shift, size } from './floating';

function mockRect(x: number, y: number, w: number, h: number) {
  return {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({})
  } as DOMRect;
}

function mockElement(props: Record<string, unknown> = {}): HTMLElement {
  return { offsetWidth: 0, offsetHeight: 0, ...props } as unknown as HTMLElement;
}

const VIEWPORT_W = 1024;
const VIEWPORT_H = 768;
vi.stubGlobal('window', {
  innerWidth: VIEWPORT_W,
  innerHeight: VIEWPORT_H,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
});

function makeState(overrides: Partial<MiddlewareState> = {}): MiddlewareState {
  return {
    x: 100,
    y: 200,
    placement: 'bottom' as Placement,
    initialPlacement: 'bottom' as Placement,
    rects: {
      reference: mockRect(100, 50, 120, 40),
      floating: { width: 200, height: 100 }
    },
    elements: {
      reference: mockElement(),
      floating: mockElement()
    },
    middlewareData: {},
    strategy: 'absolute',
    ...overrides
  };
}

// ─── offset ──────────────────────────────────────────────────────────────────

describe('offset middleware', () => {
  it('adds main axis distance for bottom placement', () => {
    const mw = offset(8);
    const result = mw.fn(makeState({ placement: 'bottom' }));
    expect(result.y).toBe(208);
    expect(result.x).toBe(100);
  });

  it('subtracts main axis distance for top placement', () => {
    const mw = offset(8);
    const result = mw.fn(makeState({ placement: 'top' }));
    expect(result.y).toBe(192);
    expect(result.x).toBe(100);
  });

  it('adds main axis for right placement', () => {
    const mw = offset(10);
    const result = mw.fn(makeState({ placement: 'right' }));
    expect(result.x).toBe(110);
    expect(result.y).toBe(200);
  });

  it('subtracts main axis for left placement', () => {
    const mw = offset(10);
    const result = mw.fn(makeState({ placement: 'left' }));
    expect(result.x).toBe(90);
    expect(result.y).toBe(200);
  });

  it('supports object form with cross axis', () => {
    const mw = offset({ mainAxis: 8, crossAxis: 4 });
    const result = mw.fn(makeState({ placement: 'bottom' }));
    expect(result.y).toBe(208);
    expect(result.x).toBe(104);
  });

  it('handles zero offset', () => {
    const mw = offset(0);
    const result = mw.fn(makeState());
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });
});

// ─── flip ────────────────────────────────────────────────────────────────────

describe('flip middleware', () => {
  it('does nothing when no overflow', () => {
    const mw = flip();
    const result = mw.fn(makeState({ y: 300, placement: 'bottom' }));
    expect(result.reset).toBeUndefined();
  });

  it('flips from bottom to top when overflowing bottom', () => {
    const mw = flip();
    // flip() is space-aware (since 110c154): it flips only when the *opposite* side
    // has more room. So the reference must sit near the viewport bottom — then the
    // floating element overflows below it and there is more space above.
    const state = makeState({
      placement: 'bottom',
      y: VIEWPORT_H - 50,
      rects: {
        reference: mockRect(100, VIEWPORT_H - 90, 120, 40),
        floating: { width: 200, height: 100 }
      }
    });
    const result = mw.fn(state);
    expect(result.reset).toEqual({ placement: 'top' });
  });

  it('flips from top to bottom when overflowing top', () => {
    const mw = flip();
    const state = makeState({ placement: 'top', y: -20 });
    const result = mw.fn(state);
    expect(result.reset).toEqual({ placement: 'bottom' });
  });

  it('preserves alignment when flipping', () => {
    const mw = flip();
    // Reference near the viewport bottom (consistent with the space-aware flip).
    const state = makeState({
      placement: 'bottom-start',
      y: VIEWPORT_H - 50,
      rects: {
        reference: mockRect(100, VIEWPORT_H - 90, 120, 40),
        floating: { width: 200, height: 100 }
      }
    });
    const result = mw.fn(state);
    expect(result.reset).toEqual({ placement: 'top-start' });
  });

  it('does not flip twice', () => {
    const mw = flip();
    const state = makeState({
      placement: 'top',
      y: -20,
      middlewareData: { flip: { flipped: true } }
    });
    const result = mw.fn(state);
    expect(result.reset).toBeUndefined();
  });

  it('respects padding', () => {
    const mw = flip({ padding: 20 });
    // Reference near the bottom: without padding the floating element fits (10px to
    // spare), but the 20px padding tips it into overflow — padding is the deciding
    // factor, and the opposite (top) side has the room, so it flips.
    const state = makeState({
      placement: 'bottom',
      y: VIEWPORT_H - 110,
      rects: {
        reference: mockRect(100, VIEWPORT_H - 150, 120, 40),
        floating: { width: 200, height: 100 }
      }
    });
    const result = mw.fn(state);
    expect(result.reset).toEqual({ placement: 'top' });
  });
});

// ─── shift ───────────────────────────────────────────────────────────────────

describe('shift middleware', () => {
  it('does nothing when no overflow', () => {
    const mw = shift();
    const state = makeState({ x: 100, placement: 'bottom' });
    const result = mw.fn(state);
    expect(result.x).toBe(100);
  });

  it('shifts right when overflowing left for vertical placement', () => {
    const mw = shift();
    const state = makeState({ x: -30, placement: 'bottom' });
    const result = mw.fn(state);
    expect(result.x).toBe(0);
  });

  it('shifts left when overflowing right for vertical placement', () => {
    const mw = shift();
    const state = makeState({
      x: VIEWPORT_W - 100,
      placement: 'bottom',
      rects: {
        reference: mockRect(100, 50, 120, 40),
        floating: { width: 200, height: 100 }
      }
    });
    const result = mw.fn(state);
    expect(result.x).toBe(VIEWPORT_W - 200);
  });

  it('shifts down when overflowing top for horizontal placement', () => {
    const mw = shift();
    const state = makeState({ y: -20, placement: 'right' });
    const result = mw.fn(state);
    expect(result.y).toBe(0);
  });

  it('respects padding', () => {
    const mw = shift({ padding: 10 });
    const state = makeState({ x: -5, placement: 'bottom' });
    const result = mw.fn(state);
    expect(result.x).toBe(10);
  });
});

// ─── arrow ───────────────────────────────────────────────────────────────────

describe('arrow middleware', () => {
  function makeArrowEl(width: number, height: number) {
    return { offsetWidth: width, offsetHeight: height } as HTMLElement;
  }

  it('centers arrow on reference for bottom placement', () => {
    const arrowEl = makeArrowEl(12, 6);
    const mw = arrow({ element: arrowEl });
    const state = makeState({
      x: 60,
      placement: 'bottom',
      rects: {
        reference: mockRect(100, 50, 120, 40),
        floating: { width: 200, height: 100 }
      }
    });

    const result = mw.fn(state);
    expect(result.data?.x).toBeDefined();
    expect(result.data?.y).toBeUndefined();
    expect(result.data!.x).toBeGreaterThanOrEqual(0);
    expect(result.data!.x).toBeLessThanOrEqual(200);
  });

  it('centers arrow on reference for right placement', () => {
    const arrowEl = makeArrowEl(6, 12);
    const mw = arrow({ element: arrowEl });
    const state = makeState({
      y: 20,
      placement: 'right',
      rects: {
        reference: mockRect(50, 100, 40, 80),
        floating: { width: 200, height: 150 }
      }
    });

    const result = mw.fn(state);
    expect(result.data?.y).toBeDefined();
    expect(result.data?.x).toBeUndefined();
  });

  it('clamps arrow within floating bounds with padding', () => {
    const arrowEl = makeArrowEl(12, 6);
    const mw = arrow({ element: arrowEl, padding: 8 });
    const state = makeState({
      x: 300,
      placement: 'bottom',
      rects: {
        reference: mockRect(100, 50, 20, 40),
        floating: { width: 200, height: 100 }
      }
    });

    const result = mw.fn(state);
    expect(result.data!.x).toBeGreaterThanOrEqual(8);
    expect(result.data!.x).toBeLessThanOrEqual(200 - 12 - 8);
  });
});

// ─── size ────────────────────────────────────────────────────────────────────

describe('size middleware', () => {
  it('calls apply with available dimensions', () => {
    const applySpy = vi.fn();
    const mw = size({ apply: applySpy });
    const state = makeState({ x: 50, y: 50 });

    mw.fn(state);

    expect(applySpy).toHaveBeenCalledOnce();
    const args = applySpy.mock.calls[0][0];
    expect(args.availableWidth).toBeDefined();
    expect(args.availableHeight).toBeDefined();
  });

  it('passes rects through to apply', () => {
    const applySpy = vi.fn();
    const mw = size({ apply: applySpy });
    const state = makeState();

    mw.fn(state);

    const args = applySpy.mock.calls[0][0];
    expect(args.rects).toBe(state.rects);
  });
});

// ─── all placements ──────────────────────────────────────────────────────────

describe('placement combinations', () => {
  const placements: Placement[] = [
    'top',
    'top-start',
    'top-end',
    'bottom',
    'bottom-start',
    'bottom-end',
    'left',
    'left-start',
    'left-end',
    'right',
    'right-start',
    'right-end'
  ];

  it.each(placements)('offset works with %s placement', (placement) => {
    const mw = offset(8);
    const state = makeState({ placement });
    const result = mw.fn(state);
    expect(typeof result.x).toBe('number');
    expect(typeof result.y).toBe('number');
  });

  it.each(placements)('shift works with %s placement', (placement) => {
    const mw = shift({ padding: 8 });
    const state = makeState({ placement, x: -10 });
    const result = mw.fn(state);
    expect(typeof result.x).toBe('number');
    expect(typeof result.y).toBe('number');
  });
});
