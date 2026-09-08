// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaginationItemTierHost from './__fixtures__/PaginationItemTierHost.svelte';
import type { PaginationItemContext, PaginationProps } from './index';
import Pagination from './Pagination.svelte';
import PaginationItem from './PaginationItem.svelte';

// Interaction layer for the `renderItem` snippet (PAG-3). Pagination is
// declarative — no context children — so the snippet is supplied with
// `createRawSnippet`; its `setup` hook wires a real click handler onto the
// custom node so the `select` callback can be exercised end-to-end. Same stack
// as the Dialog/Combobox tests: Svelte's own mount/unmount, @testing-library/dom
// + user-event, native vitest matchers.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

// A custom page button that surfaces the forwarded context on data-* attributes
// and calls `select` on click, so both the render contract and the callback are
// observable from the DOM.
const renderItem = createRawSnippet<[PaginationItemContext]>((ctx) => ({
  render: () =>
    `<button data-testid="custom-page" data-page="${ctx().page}" data-active="${ctx().active}" data-intent="${ctx().intent}">${ctx().page}</button>`,
  setup: (node) => {
    const onClick = () => ctx().select();
    node.addEventListener('click', onClick);
    return () => node.removeEventListener('click', onClick);
  }
}));

function renderPagination(props: Partial<PaginationProps> = {}) {
  const instance = mount(Pagination, {
    target: document.body,
    props: { currentPage: 2, totalPages: 5, ...props } as PaginationProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Pagination — renderItem snippet', () => {
  it('replaces the default numbered buttons and forwards page/active/intent context', () => {
    renderPagination({ currentPage: 2, totalPages: 5, intent: 'success', renderItem });

    const custom = screen.getAllByTestId('custom-page');
    // 5 pages, all visible under the default visiblePages window.
    expect(custom.map((el) => el.getAttribute('data-page'))).toEqual(['1', '2', '3', '4', '5']);
    // The active page reflects currentPage; intent is forwarded verbatim.
    expect(
      custom.find((el) => el.getAttribute('data-active') === 'true')?.getAttribute('data-page')
    ).toBe('2');
    expect(custom[0].getAttribute('data-intent')).toBe('success');
  });

  it('drives page changes through the select callback', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 2, totalPages: 5, renderItem, onPageChange });

    const page4 = screen
      .getAllByTestId('custom-page')
      .find((el) => el.getAttribute('data-page') === '4');
    await userEvent.click(page4!);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('select is a no-op for the already-active page', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 2, totalPages: 5, renderItem, onPageChange });

    const page2 = screen
      .getAllByTestId('custom-page')
      .find((el) => el.getAttribute('data-page') === '2');
    await userEvent.click(page2!);
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

// Default-button interaction contract: onPageChange wiring for page numbers /
// Previous / Next / First / Last, unified edge behaviour (every layout keeps
// Previous/Next mounted and disables the dead-end arrow rather than unmounting it),
// aria-current on the active page, the windowed-ellipsis rendering, and the global
// `disabled` gate.
describe('Pagination — page-change contract', () => {
  const pageButton = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

  it('marks only the active page with aria-current="page"', () => {
    renderPagination({ currentPage: 2, totalPages: 5 });

    expect(pageButton('2').getAttribute('aria-current')).toBe('page');
    expect(pageButton('3').getAttribute('aria-current')).toBeNull();
    // The nav landmark carries the localized label.
    expect(screen.getByRole('navigation', { name: 'Page navigation' })).toBeTruthy();
  });

  it('clicking a page number fires onPageChange; the active page is a no-op', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 2, totalPages: 5, onPageChange });

    await userEvent.click(pageButton('4'));
    expect(onPageChange).toHaveBeenCalledWith(4);

    await userEvent.click(pageButton('2'));
    expect(onPageChange).toHaveBeenCalledOnce();
  });

  it('Previous/Next navigate relative to the current page', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 3, totalPages: 5, onPageChange });

    await userEvent.click(pageButton('Previous'));
    expect(onPageChange).toHaveBeenLastCalledWith(2);

    await userEvent.click(pageButton('Next'));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it('default layout keeps Previous/Next mounted at the edges and disables the dead end', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 1, totalPages: 5, onPageChange });

    // Page 1: Previous is IN the DOM but disabled (unified edge policy — no unmount,
    // hence no layout shift and no focus loss); Next stays live.
    const prevOnFirst = pageButton('Previous');
    expect(prevOnFirst.disabled).toBe(true);
    expect(pageButton('Next').disabled).toBe(false);
    // Clicking the dead-end arrow is inert — the native disabled attribute and the
    // handlePageChange range guard both suppress it.
    await userEvent.click(prevOnFirst);
    expect(onPageChange).not.toHaveBeenCalled();

    dispose?.();
    document.body.replaceChildren();

    // Last page: symmetric — Next is present-but-disabled, Previous is live.
    renderPagination({ currentPage: 5, totalPages: 5, onPageChange });
    const nextOnLast = pageButton('Next');
    expect(nextOnLast.disabled).toBe(true);
    expect(pageButton('Previous').disabled).toBe(false);
    await userEvent.click(nextOnLast);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('navigation layout keeps both arrows mounted and disables the dead end', async () => {
    const onPageChange = vi.fn();
    renderPagination({ layout: 'navigation', currentPage: 1, totalPages: 5, onPageChange });

    // The navigation row is laid out `justify-between`; unmounting a lone arm would
    // teleport the survivor across the bar, so it is disabled-but-visible here too.
    const prev = pageButton('Previous');
    expect(prev.disabled).toBe(true);
    expect(pageButton('Next').disabled).toBe(false);
    await userEvent.click(prev);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('windows long trails with ellipses and First/Last jump buttons', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 10, totalPages: 20, visiblePages: 5, onPageChange });

    // Window centers on the current page: 8–12, an ellipsis on each side.
    expect(screen.getAllByText('...')).toHaveLength(2);
    expect(pageButton('8')).toBeTruthy();
    expect(pageButton('12')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '7' })).toBeNull();
    expect(screen.queryByRole('button', { name: '13' })).toBeNull();

    await userEvent.click(pageButton('First'));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    await userEvent.click(pageButton('Last'));
    expect(onPageChange).toHaveBeenLastCalledWith(20);
  });

  it('table layout disables Previous on the first page instead of hiding it', async () => {
    const onPageChange = vi.fn();
    renderPagination({ layout: 'table', currentPage: 1, totalPages: 5, onPageChange });

    const prev = pageButton('Previous');
    expect(prev.disabled).toBe(true);
    await userEvent.click(prev);
    expect(onPageChange).not.toHaveBeenCalled();

    await userEvent.click(pageButton('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('a disabled pagination renders inert buttons and never fires onPageChange', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 2, totalPages: 5, disabled: true, onPageChange });

    expect(pageButton('4').disabled).toBe(true);
    await userEvent.click(pageButton('4'));
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

// showFirstLast × showNumbers coupling. First/Last are redundancy-gated to the
// number window (they only render beside a start/end ellipsis), so with
// `showNumbers={false}` an explicitly-set `showFirstLast` renders nothing — a
// settled decision (2026-07-14), but its silence was the bug: the component now
// says so in dev, once per instance (fail-loud over silent no-op).
describe('Pagination — showFirstLast without showNumbers (DEV warn)', () => {
  it('warns once when showFirstLast is explicitly set while showNumbers is false, and renders no First/Last', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPagination({ currentPage: 5, totalPages: 20, showFirstLast: true, showNumbers: false });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('showFirstLast');
    // The documented coupling holds: no number window → no ellipsis → no First/Last.
    expect(screen.queryByRole('button', { name: 'First' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Last' })).toBeNull();
    warn.mockRestore();
  });

  it('does not re-warn on later prop changes (once per instance)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // `$state` proxy handed to `mount` unspread so prop mutations reach the
    // component (the Collapsible controlled-contract pattern).
    const props = $state<PaginationProps>({
      currentPage: 5,
      totalPages: 20,
      showFirstLast: true,
      showNumbers: false
    });
    const instance = mount(Pagination, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
    expect(warn).toHaveBeenCalledTimes(1);

    // Toggling showNumbers on and back off re-runs the effect — the instance
    // flag keeps it at the single initial warn.
    props.showNumbers = true;
    flushSync();
    props.showNumbers = false;
    flushSync();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('stays silent when showFirstLast is left at its default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPagination({ currentPage: 5, totalPages: 20, showNumbers: false });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays silent in the default configuration, where First/Last render beside the ellipsis', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPagination({ currentPage: 10, totalPages: 20, visiblePages: 5, showFirstLast: true });

    expect(warn).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'First' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Last' })).toBeTruthy();
    warn.mockRestore();
  });
});

// One item, mounted on its own target so a test can read the element the branch
// actually rendered.
const mountItem = (props: Record<string, unknown>) => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(PaginationItem, { target, props });
  flushSync();
  dispose = () => unmount(app);
  return target;
};

describe('PaginationItem forwards its rest props in both branches', () => {
  // The two branches take different elements — the `<a>` with `href`, the
  // `<button>` without — and until this test the link branch spread the rest
  // bag onto neither. Everything a caller adds (`data-*`, `aria-describedby`,
  // and the `preset` PaginationItem does not declare itself) fell out with no
  // error: measured, `<PaginationItem href data-probe>` put the attribute on no
  // element at all, while the same call without `href` put it on the button.

  it('puts them on the button when there is no href', () => {
    const target = mountItem({ page: 1, 'data-probe': 'x' });
    expect(target.querySelector('[data-probe]')?.tagName).toBe('BUTTON');
  });

  it('puts them on the anchor when there is one', () => {
    // The anchor is the whole element this branch renders — the one that also
    // takes `class`, `tabindex` and `aria-current`.
    const target = mountItem({ page: 1, href: '/page/2', 'data-probe': 'x' });
    expect(target.querySelector('[data-probe]')?.tagName).toBe('A');
  });
});

describe('PaginationItem link form', () => {
  it('is the anchor, with no control inside it', () => {
    // Interactive content inside an `<a>` is invalid HTML, and the assistive
    // reading it produced ("button, inside link") is the defect: the anchor used
    // to wrap a full `<Button tabindex={-1}>`.
    const target = mountItem({ page: 2, href: '/page/2' });
    const anchor = target.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/page/2');
    expect(anchor?.querySelector('button')).toBe(null);
    expect(target.querySelectorAll('button').length).toBe(0);
    expect(anchor?.textContent?.trim()).toBe('2');
  });

  // Both elements of both states, because each pins a different divergence: the
  // root is `base` and the label span is `content`, whose `min-w-0` and
  // `[&>svg]:shrink-0` keep a 16px icon in a narrow item from being drawn at
  // 6px; and `loading` at `lg`, because that is where the placement shows —
  // Button's `overlay` keeps the size's `gap-2.5` while `start` drops it to
  // `gap-2` for a spinner this form never draws.
  const LOOK_STATES: Record<string, Record<string, unknown>> = {
    resting: { active: true },
    'loading at lg': { loading: true, size: 'lg' }
  };

  for (const [state, props] of Object.entries(LOOK_STATES)) {
    it(`wears the button look — root and label — while ${state}`, () => {
      // The look is the reason the branch exists at all: dropping the inner
      // Button must not leave a bare link behind. Compared against the button
      // form of the same item rather than against a class list written out
      // here, which would pin today's utilities instead of the agreement
      // between the two forms.
      const linkRoot = mountItem({ page: 2, href: '/page/2', ...props }).querySelector('a');
      const linkLabel = linkRoot?.querySelector(':scope > span');
      dispose?.();
      const buttonRoot = mountItem({ page: 2, ...props }).querySelector('button');
      // `:scope >`, because the spinner span has spans of its own: Button's own
      // children are the spinner (`aria-hidden`) and then the content span.
      const buttonLabel = buttonRoot?.querySelector(':scope > span:not([aria-hidden])');

      const rootShared = [...(buttonRoot?.classList ?? [])].filter(
        (c) => c !== 'blocks-button' && !c.startsWith('blocks-intent-')
      );
      expect(rootShared.length).toBeGreaterThan(0);
      for (const cls of rootShared) expect(linkRoot?.classList.contains(cls), cls).toBe(true);

      // `opacity-0` excepted: it is the label fading out behind the overlay
      // spinner, and the link form has no spinner to fade it out for.
      const labelShared = [...(buttonLabel?.classList ?? [])].filter((c) => c !== 'opacity-0');
      expect(labelShared.length).toBeGreaterThan(0);
      for (const cls of labelShared) expect(linkLabel?.classList.contains(cls), cls).toBe(true);
    });
  }

  it('reads the tier off a wrapping TierContext, as the button form does', () => {
    const link = mount(PaginationItemTierHost, {
      target: document.body.appendChild(document.createElement('div')),
      props: { page: 2, href: '/page/2' }
    });
    flushSync();
    expect(document.querySelector('a')?.classList.contains('rounded-modify')).toBe(true);
    unmount(link);

    const button = mount(PaginationItemTierHost, {
      target: document.body.appendChild(document.createElement('div')),
      props: { page: 2 }
    });
    flushSync();
    expect(document.querySelector('button')?.classList.contains('rounded-modify')).toBe(true);
    unmount(button);
  });

  it('reports a busy link without hiding its label', () => {
    // The button form fades its label out behind the overlay spinner. This form
    // draws no spinner, so the same variant call would leave an empty box: the
    // anchor's own `content` class puts the label back.
    const anchor = mountItem({ page: 2, href: '/page/2', loading: true }).querySelector('a');
    expect(anchor?.getAttribute('aria-busy')).toBe('true');
    expect(anchor?.classList.contains('cursor-wait')).toBe(true);

    const label = anchor?.querySelector(':scope > span');
    expect(label?.classList.contains('opacity-100')).toBe(true);
    expect(label?.classList.contains('opacity-0')).toBe(false);
    expect(anchor?.textContent?.trim()).toBe('2');
  });

  it('keeps `preset` off the anchor — it addresses the Button the other form renders', () => {
    const target = mountItem({ page: 2, href: '/page/2', preset: 'quiet' });
    expect(target.querySelector('a')?.hasAttribute('preset')).toBe(false);
  });

  it('marks the current page with aria-current', () => {
    const anchor = mountItem({ page: 2, href: '/page/2', active: true }).querySelector('a');
    expect(anchor?.getAttribute('aria-current')).toBe('page');
  });

  it('takes a disabled item out of the tab order and cancels its activation', () => {
    const target = mountItem({ page: 2, href: '/page/2', disabled: true });
    const anchor = target.querySelector('a');
    expect(anchor?.getAttribute('aria-disabled')).toBe('true');
    expect(anchor?.getAttribute('tabindex')).toBe('-1');

    // `pointer-events: none` is a style, and jsdom computes none — so the guard
    // that has to hold is the handler's: the anchor must not navigate.
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves an enabled item's activation alone", () => {
    // A fragment href: jsdom implements no navigation, and letting a click on a
    // document-changing one through prints a not-implemented error per test.
    const anchor = mountItem({ page: 2, href: '#page-2' }).querySelector('a');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('puts `class` on the anchor, and keeps the variant classes beside it', () => {
    const anchor = mountItem({ page: 2, href: '/page/2', class: 'ring-4' }).querySelector('a');
    expect(anchor?.classList.contains('ring-4')).toBe(true);
    expect(anchor?.classList.contains('inline-flex')).toBe(true);
  });
});
