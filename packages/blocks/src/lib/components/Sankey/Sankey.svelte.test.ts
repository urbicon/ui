// @vitest-environment jsdom
import { fireEvent } from '@testing-library/dom';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Sankey from './Sankey.svelte';

// Interaction contract of the Sankey wrapper — the two things the variant tests
// can't see: (1) the chart root is a named group (role="img" would flatten the
// interactive role="button" paths/nodes out of the accessibility tree) and
// (2) a consumer-provided onmousemove is forwarded alongside the internal
// tooltip tracker instead of clobbering it via the restProps spread. Repo
// stack: svelte's own mount/unmount, @testing-library/dom, native matchers.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const nodes = [
  { id: 'gas', label: 'Gas' },
  { id: 'heat', label: 'Heating' }
];
const links = [{ source: 'gas', target: 'heat', value: 100 }];

function renderSankey(props: Partial<ComponentProps<typeof Sankey>> = {}) {
  const instance = mount(Sankey, {
    target: document.body,
    props: { nodes, links, ...props }
  });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Sankey (component interaction)', () => {
  it('exposes the chart as a named group, keeping interactive children in the AX tree', () => {
    renderSankey();
    const svg = document.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('group');
    expect(svg?.getAttribute('aria-label')).toBeTruthy();
    // The children role="img" would have flattened away.
    expect(svg?.querySelectorAll('[role="button"]').length).toBeGreaterThan(0);
  });

  it('runs both the internal tooltip tracker and a consumer onmousemove', () => {
    const onmousemove = vi.fn();
    renderSankey({ onmousemove });

    // Make the tooltip visible first — moveTooltip is a no-op while hidden.
    const path = document.querySelector('path[role="button"]');
    expect(path).not.toBeNull();
    fireEvent.mouseEnter(path!, { clientX: 10, clientY: 10 });
    flushSync();

    const tooltip = document.querySelector<HTMLElement>('[data-visible]');
    expect(tooltip?.dataset.visible).toBe('true');

    const wrapper = document.querySelector('svg')!.parentElement!;
    fireEvent.mouseMove(wrapper, { clientX: 100, clientY: 50 });
    flushSync();

    // Internal handler ran: the tooltip followed the pointer (wrapper rect is
    // 0/0 in jsdom, so position = client + 8px offset).
    expect(tooltip?.style.left).toBe('108px');
    expect(tooltip?.style.top).toBe('58px');
    // Consumer handler was forwarded, not clobbered by the internal one.
    expect(onmousemove).toHaveBeenCalledTimes(1);
  });
});
