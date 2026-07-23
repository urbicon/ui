// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ChatMessageData } from '../chat.types';
import ChatMessageList from './ChatMessageList.svelte';
import type { ChatMessageListItemContext } from './index';

// jsdom implements neither Element.scrollTo nor real layout metrics — stub the
// scroll write and drive the metrics per test via defineMetrics().
beforeAll(() => {
  Element.prototype.scrollTo = function (this: Element, options?: ScrollToOptions | number) {
    if (typeof options === 'object' && options?.top !== undefined) {
      this.scrollTop = options.top;
    }
  } as Element['scrollTo'];
});

function defineMetrics(el: Element, { scrollHeight = 1000, clientHeight = 400 } = {}) {
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
}

function msg(id: string, overrides: Partial<ChatMessageData> = {}): ChatMessageData {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: `Message ${id}` }],
    ...overrides
  };
}

// Renders each message as a plain marker div — keeps these tests focused on
// the list engine instead of ChatMessage's markup.
const marker = createRawSnippet((ctx: () => ChatMessageListItemContext) => ({
  render: () => `<div data-testid="msg" data-id="${ctx().message.id}">${ctx().message.id}</div>`
}));

let cleanup: (() => void) | undefined;

function mountList(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  // Never spread a $state props object here — spreading reads the proxy once
  // and severs reactivity. The marker snippet is written INTO the object so
  // reactive callers keep their proxy identity.
  if (!('message' in props)) props.message = marker;
  const instance = mount(ChatMessageList, { target, props: props as never });
  flushSync();
  cleanup = () => {
    unmount(instance);
    target.remove();
  };
  return { target, instance };
}

function viewportOf(target: HTMLElement): HTMLElement {
  const viewport = target.querySelector<HTMLElement>('[role="region"]');
  if (!viewport) throw new Error('viewport not rendered');
  return viewport;
}

function userScroll(viewport: HTMLElement, to: number) {
  viewport.scrollTop = to;
  viewport.dispatchEvent(new Event('scroll'));
}

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
});

describe('ChatMessageList — structure & a11y', () => {
  it('renders a focusable named scroll region containing an aria-live-off log', () => {
    const { target } = mountList({ messages: [msg('a')] });
    const viewport = viewportOf(target);
    expect(viewport.getAttribute('aria-label')).toBe('Conversation');
    expect(viewport.getAttribute('tabindex')).toBe('0');
    const log = target.querySelector('[role="log"]');
    expect(log).not.toBeNull();
    expect(log?.getAttribute('aria-live')).toBe('off');
  });

  it('renders the default empty state and swaps it for the empty snippet', () => {
    const { target } = mountList({ messages: [], emptyTitle: 'Nothing here' });
    expect(target.textContent).toContain('Nothing here');
    cleanup?.();
    cleanup = undefined;

    const custom = createRawSnippet(() => ({ render: () => '<p>custom empty</p>' }));
    const { target: t2 } = mountList({ messages: [], empty: custom });
    expect(t2.textContent).toContain('custom empty');
  });

  it('renders messages through the message snippet with stable keyed identity', () => {
    const props = $state({ messages: [msg('a'), msg('b')] });
    const { target } = mountList(props);
    const before = target.querySelector('[data-id="a"]');
    expect(before).not.toBeNull();

    flushSync(() => {
      props.messages = [...props.messages, msg('c')];
    });
    expect(target.querySelectorAll('[data-testid="msg"]')).toHaveLength(3);
    expect(target.querySelector('[data-id="a"]')).toBe(before);
  });
});

describe('ChatMessageList — stick engine', () => {
  it('starts stuck and shows no jump button', () => {
    const { target } = mountList({ messages: [msg('a')] });
    expect(target.querySelector('button')).toBeNull();
    expect((target.firstElementChild as HTMLElement).dataset.stuck).toBe('true');
  });

  it('unsticks on upward scroll, counts appended messages, and re-sticks via the button', () => {
    const onStickChange = vi.fn();
    const reactive = $state({ messages: [msg('a'), msg('b')], onStickChange });
    const { target } = mountList(reactive);
    const viewport = viewportOf(target);
    defineMetrics(viewport, { scrollHeight: 1000, clientHeight: 400 });

    // establish a downward baseline, then scroll up beyond the bottom zone
    userScroll(viewport, 600);
    userScroll(viewport, 200);
    expect(onStickChange).toHaveBeenLastCalledWith(false);

    flushSync(() => {
      reactive.messages = [...reactive.messages, msg('c'), msg('d')];
    });
    const button = target.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('2 New messages');

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    expect(onStickChange).toHaveBeenLastCalledWith(true);
    expect(target.querySelector('button')).toBeNull();
    // focus moves to the viewport instead of dropping to <body> (WCAG 2.4.3)
    expect(document.activeElement).toBe(viewport);
  });

  it('does not unstick on downward scroll (programmatic follow)', () => {
    const onStickChange = vi.fn();
    const { target } = mountList({ messages: [msg('a')], onStickChange });
    const viewport = viewportOf(target);
    defineMetrics(viewport, { scrollHeight: 1000, clientHeight: 400 });

    userScroll(viewport, 100);
    userScroll(viewport, 300);
    expect(onStickChange).not.toHaveBeenCalledWith(false);
  });

  it('re-sticks when the user scrolls back into the bottom zone', () => {
    const onStickChange = vi.fn();
    const { target } = mountList({ messages: [msg('a')], onStickChange });
    const viewport = viewportOf(target);
    defineMetrics(viewport, { scrollHeight: 1000, clientHeight: 400 });

    userScroll(viewport, 500);
    userScroll(viewport, 100);
    expect(onStickChange).toHaveBeenLastCalledWith(false);

    userScroll(viewport, 590);
    expect(onStickChange).toHaveBeenLastCalledWith(true);
  });

  it('counts in-place pushes (idiomatic stream appends) while unstuck', () => {
    const reactive = $state({ messages: [msg('a'), msg('b')] });
    const { target } = mountList(reactive);
    const viewport = viewportOf(target);
    defineMetrics(viewport, { scrollHeight: 1000, clientHeight: 400 });

    userScroll(viewport, 500);
    userScroll(viewport, 100);

    flushSync(() => {
      reactive.messages.push(msg('c'));
    });
    const button = target.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('1 New messages');
  });

  it('does not count trailing deletion (truncate) as new messages', () => {
    const reactive = $state({ messages: [msg('a'), msg('b'), msg('c')] });
    const { target } = mountList(reactive);
    const viewport = viewportOf(target);
    defineMetrics(viewport, { scrollHeight: 1000, clientHeight: 400 });

    userScroll(viewport, 500);
    userScroll(viewport, 100);

    flushSync(() => {
      reactive.messages = reactive.messages.slice(0, 2);
    });
    const button = target.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Scroll to bottom');
  });

  it('does not count prepended history as new messages', () => {
    const reactive = $state({ messages: [msg('c'), msg('d')] });
    const { target } = mountList(reactive);
    const viewport = viewportOf(target);
    defineMetrics(viewport, { scrollHeight: 1000, clientHeight: 400 });

    userScroll(viewport, 500);
    userScroll(viewport, 100);

    flushSync(() => {
      reactive.messages = [msg('a'), msg('b'), ...reactive.messages];
    });
    const button = target.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Scroll to bottom');
  });
});

describe('ChatMessageList — screen-reader announcements', () => {
  it('announces generation start and the completed text once', () => {
    const reactive = $state({
      messages: [msg('u', { role: 'user' }), msg('a1', { status: 'streaming', parts: [] })]
    });
    const { target } = mountList(reactive);
    const status = target.querySelector('[role="status"]');
    expect(status?.textContent).toBe('Generating response…');

    flushSync(() => {
      reactive.messages = [
        reactive.messages[0],
        {
          ...reactive.messages[1],
          status: 'complete',
          parts: [{ type: 'text', text: 'Final answer.' }]
        }
      ];
    });
    expect(status?.textContent).toBe('Final answer.');
  });

  it('never announces user messages', () => {
    const reactive = $state({ messages: [msg('u', { role: 'user', status: 'streaming' })] });
    const { target } = mountList(reactive);
    expect(target.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('replaces the generating label when a textless stream errors or aborts', () => {
    const reactive = $state({
      messages: [msg('a1', { status: 'streaming', parts: [] })] as ChatMessageData[]
    });
    const { target } = mountList(reactive);
    const status = target.querySelector('[role="status"]');
    expect(status?.textContent).toBe('Generating response…');

    flushSync(() => {
      reactive.messages = [{ ...reactive.messages[0], status: 'error' }];
    });
    expect(status?.textContent).toBe('Something went wrong');
  });

  it('announces a reply that arrives already settled (no streaming phase)', () => {
    const reactive = $state({ messages: [msg('u', { role: 'user' })] });
    const { target } = mountList(reactive);
    const status = target.querySelector('[role="status"]');
    expect(status?.textContent).toBe('');

    flushSync(() => {
      reactive.messages = [
        ...reactive.messages,
        msg('a1', { status: 'complete', parts: [{ type: 'text', text: 'Instant answer.' }] })
      ];
    });
    expect(status?.textContent).toBe('Instant answer.');
  });

  it('does not read mounted history aloud on conversation open', () => {
    const { target } = mountList({
      messages: [msg('a1', { status: 'complete' }), msg('a2', { status: 'complete' })]
    });
    expect(target.querySelector('[role="status"]')?.textContent).toBe('');
  });
});

describe('ChatMessageList — instance API', () => {
  it('exposes scrollToBottom that re-sticks and scrolls', () => {
    const onStickChange = vi.fn();
    const { target, instance } = mountList({ messages: [msg('a')], onStickChange });
    const viewport = viewportOf(target);
    defineMetrics(viewport, { scrollHeight: 1000, clientHeight: 400 });

    userScroll(viewport, 500);
    userScroll(viewport, 100);
    expect(onStickChange).toHaveBeenLastCalledWith(false);

    (instance as { scrollToBottom: (b?: ScrollBehavior) => void }).scrollToBottom();
    flushSync();
    expect(onStickChange).toHaveBeenLastCalledWith(true);
    expect(viewport.scrollTop).toBe(1000);
  });
});
