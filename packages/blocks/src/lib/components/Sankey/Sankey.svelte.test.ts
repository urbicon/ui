// @vitest-environment jsdom
import { fireEvent } from '@testing-library/dom';
import type { Locale } from '@urbicon-ui/i18n';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChartLocaleHost from '#lib/internal/charts/__fixtures__/ChartLocaleHost.svelte';
import Sankey from './Sankey.svelte';

// Interaction contract of the Sankey wrapper — the things the variant tests
// can't see: (1) the chart root is a named group (role="img" would flatten the
// interactive role="button" paths/nodes out of the accessibility tree),
// (2) a consumer-provided onmousemove is forwarded alongside the internal
// tooltip tracker instead of clobbering it via the restProps spread, (3) a
// link's accessible name uses the node labels, not the ids, and (4) the
// tooltip's default percent follows the active locale. Repo stack: svelte's
// own mount/unmount, @testing-library/dom, native matchers.

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

function renderSankey(props: Partial<ComponentProps<typeof Sankey>> = {}, locale?: Locale) {
  const merged = { nodes, links, ...props };
  const instance = locale
    ? mount(ChartLocaleHost, {
        target: document.body,
        props: { locale, chart: Sankey, props: merged }
      })
    : mount(Sankey, { target: document.body, props: merged });
  dispose = () => unmount(instance);
  flushSync();
}

/** Hovers the first link and returns the tooltip's text. */
function linkTooltipText() {
  fireEvent.mouseEnter(document.querySelector('path[role="button"]')!);
  flushSync();
  return document.querySelector<HTMLElement>('[data-visible="true"]')?.textContent ?? '';
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

  it('names each link by its node labels, like the nodes and the summary', () => {
    renderSankey({ formatValue: (v) => String(v) });
    const link = document.querySelector('path[role="button"]');
    expect(link?.getAttribute('aria-label')).toBe('Gas → Heating: 100');
  });
});

describe('Sankey (default percent format)', () => {
  it('writes the tooltip percent the way the active locale does', () => {
    renderSankey();
    expect(linkTooltipText()).toContain('· 100.0%');
  });

  it('follows a non-base locale', () => {
    renderSankey({}, 'de');
    expect(linkTooltipText()).toContain('· 100,0\u00a0%');
  });
});
