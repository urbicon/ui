// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import {
  computeDisclosureAria,
  type UseDisclosureInputs,
  type UseDisclosureReturn,
  useDisclosure
} from './use-disclosure.svelte';

/**
 * Two layers, split the way `useFormField` splits: the ARIA half is a pure
 * function and is asserted directly, the stateful half needs a reactive scope.
 *
 * jsdom + `$effect.root`, not node: the harness below reads `$derived` values
 * across writes, and the whole file would otherwise run against Svelte's server
 * build, where the reactive graph is not the one components see.
 */

const ids = { triggerId: 'row-trigger', contentId: 'row-panel' };

describe('computeDisclosureAria', () => {
  it('links trigger and region in both directions', () => {
    const { triggerProps, contentProps } = computeDisclosureAria({ open: false, ...ids });
    expect(triggerProps.id).toBe('row-trigger');
    expect(triggerProps['aria-controls']).toBe('row-panel');
    expect(contentProps.id).toBe('row-panel');
    expect(contentProps['aria-labelledby']).toBe('row-trigger');
  });

  it('reports the open state on the trigger', () => {
    expect(computeDisclosureAria({ open: false, ...ids }).triggerProps['aria-expanded']).toBe(
      false
    );
    expect(computeDisclosureAria({ open: true, ...ids }).triggerProps['aria-expanded']).toBe(true);
  });

  it('marks the region inert only while collapsed', () => {
    expect(computeDisclosureAria({ open: false, ...ids }).contentProps.inert).toBe(true);
    expect(computeDisclosureAria({ open: true, ...ids }).contentProps.inert).toBe(false);
  });

  it('omits aria-disabled unless disabled — never renders it as "false"', () => {
    expect(computeDisclosureAria({ open: false, ...ids }).triggerProps['aria-disabled']).toBe(
      undefined
    );
    expect(
      computeDisclosureAria({ open: false, disabled: true, ...ids }).triggerProps['aria-disabled']
    ).toBe(true);
  });

  it('never emits the native disabled attribute — the trigger stays reachable', () => {
    // A disabled native button leaves the tab order, so a keyboard user cannot
    // reach the control that would explain why the region will not open.
    const { triggerProps } = computeDisclosureAria({ open: false, disabled: true, ...ids });
    expect('disabled' in triggerProps).toBe(false);
  });
});

/** Run `fn` inside a reactive scope and dispose it afterwards. */
function withRoot(fn: () => void) {
  const cleanup = $effect.root(fn);
  flushSync();
  cleanup();
}

describe('useDisclosure (uncontrolled)', () => {
  it('starts closed and toggles its own state', () => {
    withRoot(() => {
      const d = useDisclosure(() => ids);
      expect(d.open).toBe(false);
      d.toggle();
      expect(d.open).toBe(true);
      expect(d.triggerProps['aria-expanded']).toBe(true);
      expect(d.contentProps.inert).toBe(false);
      d.toggle();
      expect(d.open).toBe(false);
    });
  });

  it('seeds from defaultOpen and ignores later changes to it', () => {
    withRoot(() => {
      let defaultOpen = $state(true);
      const d = useDisclosure(() => ({ ...ids, defaultOpen }));
      expect(d.open).toBe(true);
      // A seed that kept tracking would silently undo the user's interaction.
      d.toggle();
      defaultOpen = true;
      flushSync();
      expect(d.open).toBe(false);
    });
  });

  it('reports every transition through onOpenChange', () => {
    withRoot(() => {
      const onOpenChange = vi.fn();
      const d = useDisclosure(() => ({ ...ids, onOpenChange }));
      d.toggle();
      d.toggle();
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });
  });
});

describe('useDisclosure (controlled)', () => {
  it('follows the caller and changes nothing by itself', () => {
    withRoot(() => {
      const onOpenChange = vi.fn();
      let open = $state(false);
      const d = useDisclosure(() => ({ ...ids, open, onOpenChange }));

      d.toggle();
      // The hook does not own `open`, so nothing moved until the caller applies
      // the callback — the divergence the family contract puts on the consumer.
      expect(d.open).toBe(false);
      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);

      open = true;
      flushSync();
      expect(d.open).toBe(true);
      expect(d.triggerProps['aria-expanded']).toBe(true);
    });
  });

  it('leaves no ghost behind when the caller stops controlling it', () => {
    withRoot(() => {
      let open = $state<boolean | undefined>(false);
      const d = useDisclosure(() => ({ ...ids, open }));

      d.toggle(); // refused: the caller owns the state and ignored the report
      open = undefined; // …and now hands it back
      flushSync();

      // The refused transition must not surface late. Without the guard on the
      // write, the hook's own state carries the value it never applied.
      expect(d.open).toBe(false);
    });
  });

  it('re-reads every input on each change — a value cannot freeze the hook', () => {
    withRoot(() => {
      let contentId = $state('panel-a');
      const d = useDisclosure(() => ({ triggerId: 't', contentId }));
      expect(d.triggerProps['aria-controls']).toBe('panel-a');
      contentId = 'panel-b';
      flushSync();
      expect(d.triggerProps['aria-controls']).toBe('panel-b');
      expect(d.contentProps.id).toBe('panel-b');
    });
  });
});

describe('useDisclosure (disabled)', () => {
  it('refuses to toggle and reports nothing', () => {
    withRoot(() => {
      const onOpenChange = vi.fn();
      const d: UseDisclosureReturn = useDisclosure(
        () => ({ ...ids, disabled: true, onOpenChange }) satisfies UseDisclosureInputs
      );
      d.toggle();
      expect(d.open).toBe(false);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(d.triggerProps['aria-disabled']).toBe(true);
    });
  });

  it('acts again once the flag clears', () => {
    withRoot(() => {
      let disabled = $state(true);
      const d = useDisclosure(() => ({ ...ids, disabled }));
      d.toggle();
      expect(d.open).toBe(false);

      disabled = false;
      flushSync();
      d.toggle();
      expect(d.open).toBe(true);
    });
  });
});
