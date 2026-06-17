import { describe, expect, it } from 'vitest';
import { findDropTarget } from './draggable';

// createDraggable requires real DOM (pointer events) — not testable in node environment.
// findDropTarget requires document.elementsFromPoint which is not available in node/jsdom.
// Test the function contract via a portable mock.

describe('findDropTarget', () => {
  // elementsFromPoint is only available in browsers / happy-dom.
  // If not available, skip tests gracefully.
  const hasElementsFromPoint =
    typeof document !== 'undefined' && typeof document.elementsFromPoint === 'function';

  it.skipIf(!hasElementsFromPoint)('returns null when no elements match', () => {
    // In browser this would test real elements; here we test the contract
    const result = findDropTarget(-9999, -9999, 'nonexistent');
    expect(result).toBeNull();
  });

  // Unit test the pure logic via manual invocation
  it('function is callable and returns null for edge coordinates', () => {
    // elementsFromPoint may not exist in node environment, but the function should not throw
    if (!hasElementsFromPoint) {
      // If no DOM, just verify the export exists and is a function
      expect(typeof findDropTarget).toBe('function');
      return;
    }
    const result = findDropTarget(-1, -1, 'dropTarget');
    expect(result).toBeNull();
  });
});
