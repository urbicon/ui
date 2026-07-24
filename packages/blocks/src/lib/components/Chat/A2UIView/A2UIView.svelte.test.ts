// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import A2UIView from './A2UIView.svelte';
import { A2UI_ISSUE_CODES, type A2uiActionEvent, type A2uiValidationIssue } from './a2ui.types';
import type { A2UIViewProps } from './index';

// DOM/interaction tests for the A2UI renderer. The processor + validator +
// pointer engines have their own node suites (a2ui-*.test.ts); here we assert
// what reaches the DOM: catalog → real primitives, spec-exact actions, live
// two-way binding, the incremental-vs-rebuild path, fault chips + validation
// reporting, streaming placeholders, and the URL policy on images. House stack:
// Svelte's own mount/unmount (not @testing-library/svelte), @testing-library/dom
// queries, no jest-dom. Reactive-prop tests mutate a `$state` object inside
// flushSync — never spread it (spreading severs the proxy).

const V = 'v0.9.1';
type Envelope = Record<string, unknown>;

function surface(id = 's'): Envelope {
  return { version: V, createSurface: { surfaceId: id, catalogId: 'x' } };
}
function comps(components: unknown[], id = 's'): Envelope {
  return { version: V, updateComponents: { surfaceId: id, components } };
}
function data(value: unknown, id = 's'): Envelope {
  return { version: V, updateDataModel: { surfaceId: id, value } };
}

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(initial: A2UIViewProps) {
  const props = $state(initial);
  const instance = mount(A2UIView, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  return props;
}

describe('A2UIView — catalog rendering + actions', () => {
  it('renders a real Button and dispatches a spec-exact action with a resolved binding', async () => {
    const user = userEvent.setup();
    const actions: A2uiActionEvent[] = [];
    render({
      payload: [
        surface(),
        data({ name: 'Ada' }),
        comps([
          { id: 'root', component: 'Column', children: ['title', 'who', 'go'] },
          { id: 'title', component: 'Text', text: 'Hello', variant: 'h2' },
          { id: 'who', component: 'Text', text: { path: '/name' } },
          {
            id: 'go',
            component: 'Button',
            variant: 'primary',
            child: 'go_label',
            action: { event: { name: 'submit', context: { who: { path: '/name' } } } }
          },
          { id: 'go_label', component: 'Text', text: 'Go' }
        ])
      ],
      onAction: (actionEvent) => actions.push(actionEvent)
    });

    // Heading + the data-bound Text both render.
    expect(document.body.textContent).toContain('Hello');
    expect(document.body.textContent).toContain('Ada');

    const button = screen.getByRole('button', { name: /Go/ });
    await user.click(button);
    flushSync();

    expect(actions).toHaveLength(1);
    const event = actions[0];
    expect(event.name).toBe('submit');
    expect(event.surfaceId).toBe('s');
    expect(event.sourceComponentId).toBe('go');
    // context binding resolved against the model in scope.
    expect(event.context).toEqual({ who: 'Ada' });
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  it('renders Text body markdown through StreamingMarkdown', () => {
    render({
      payload: [surface(), comps([{ id: 'root', component: 'Text', text: 'A **bold** claim' }])]
    });
    const strong = document.querySelector('strong');
    expect(strong?.textContent).toBe('bold');
    expect(document.body.textContent).toContain('A bold claim');
  });
});

describe('A2UIView — two-way binding', () => {
  it('writes typing into the model so a bound label updates live', async () => {
    const user = userEvent.setup();
    render({
      payload: [
        surface(),
        data({ name: '' }),
        comps([
          { id: 'root', component: 'Column', children: ['field', 'echo'] },
          { id: 'field', component: 'TextField', label: 'Name', value: { path: '/name' } },
          { id: 'echo', component: 'Text', text: { path: '/name' } }
        ])
      ]
    });

    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    await user.type(input, 'Ada');
    flushSync();

    expect(input.value).toBe('Ada');
    // The echo Text (markdown, not an <input>) reflects the same path live —
    // 'Ada' in textContent can only come from the echo.
    expect(document.body.textContent).toContain('Ada');
  });

  it('preserves an edit across an incremental envelope append (referential prefix)', async () => {
    const user = userEvent.setup();
    const props = render({
      payload: [
        surface(),
        data({ name: '' }),
        comps([
          { id: 'root', component: 'Column', children: ['field'] },
          { id: 'field', component: 'TextField', label: 'Name', value: { path: '/name' } }
        ])
      ]
    });

    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await user.type(input, 'Ada');
    flushSync();
    expect(input.value).toBe('Ada');

    // Append keeps the first three envelopes by reference → incremental apply,
    // the data-model edit survives, and the new node renders.
    flushSync(() => {
      props.payload = [
        ...(props.payload as unknown[]),
        comps([
          { id: 'root', component: 'Column', children: ['field', 'extra'] },
          { id: 'extra', component: 'Text', text: 'Appended' }
        ])
      ];
    });
    flushSync();

    expect((document.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Ada');
    expect(document.body.textContent).toContain('Appended');
  });

  it('rebuilds (discarding edits) when the payload prefix is not referentially identical', async () => {
    const user = userEvent.setup();
    const props = render({
      payload: [
        surface(),
        data({ name: '' }),
        comps([
          { id: 'root', component: 'Column', children: ['field'] },
          { id: 'field', component: 'TextField', label: 'Name', value: { path: '/name' } }
        ])
      ]
    });

    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await user.type(input, 'Ada');
    flushSync();
    expect(input.value).toBe('Ada');

    // Brand-new array of fresh envelope objects → full rebuild, model reset.
    flushSync(() => {
      props.payload = [
        surface(),
        data({ name: '' }),
        comps([
          { id: 'root', component: 'Column', children: ['field'] },
          { id: 'field', component: 'TextField', label: 'Name', value: { path: '/name' } }
        ])
      ];
    });
    flushSync();

    expect((document.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('');
  });
});

describe('A2UIView — ChoicePicker', () => {
  it('renders mutuallyExclusive as radios and writes a single-element array on select', async () => {
    const user = userEvent.setup();
    render({
      payload: [
        surface(),
        data({ choice: ['a'] }),
        comps([
          {
            id: 'root',
            component: 'ChoicePicker',
            variant: 'mutuallyExclusive',
            value: { path: '/choice' },
            options: [
              { label: 'Apple', value: 'a' },
              { label: 'Banana', value: 'b' }
            ]
          }
        ])
      ]
    });

    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(2);
    const apple = screen.getByLabelText('Apple') as HTMLInputElement;
    const banana = screen.getByLabelText('Banana') as HTMLInputElement;
    expect(apple.checked).toBe(true);

    await user.click(banana);
    flushSync();
    expect(banana.checked).toBe(true);
    expect(apple.checked).toBe(false);
  });

  it('renders multipleSelection as checkboxes and toggles the model array', async () => {
    const user = userEvent.setup();
    render({
      payload: [
        surface(),
        data({ choice: ['a'] }),
        comps([
          {
            id: 'root',
            component: 'ChoicePicker',
            variant: 'multipleSelection',
            value: { path: '/choice' },
            options: [
              { label: 'Apple', value: 'a' },
              { label: 'Banana', value: 'b' }
            ]
          }
        ])
      ]
    });

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    const apple = screen.getByLabelText('Apple') as HTMLInputElement;
    const banana = screen.getByLabelText('Banana') as HTMLInputElement;
    expect(apple.checked).toBe(true);
    expect(banana.checked).toBe(false);

    await user.click(banana);
    flushSync();
    expect(banana.checked).toBe(true);
    expect(apple.checked).toBe(true);
  });
});

describe('A2UIView — images (URL policy)', () => {
  it('blocks an external image by default and shows the description chip', () => {
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Image',
            url: 'https://evil.example/x.png',
            description: 'A cat'
          }
        ])
      ]
    });
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).toContain('Image blocked');
    expect(document.body.textContent).toContain('A cat');
  });

  it('renders an allowlisted image as an <img>', () => {
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Image',
            url: 'https://good.example/x.png',
            description: 'A cat'
          }
        ])
      ],
      urlPolicy: { allowedImagePrefixes: ['https://good.example/'] }
    });
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://good.example/x.png');
    expect(img?.getAttribute('alt')).toBe('A cat');
  });
});

describe('A2UIView — validation surfacing', () => {
  it('renders a fault chip and reports an issue for an unsupported component', () => {
    const reported: A2uiValidationIssue[][] = [];
    render({
      payload: [
        surface(),
        comps([
          { id: 'root', component: 'Column', children: ['m'] },
          { id: 'm', component: 'Modal', trigger: 'x', content: 'y' }
        ])
      ],
      onValidationError: (issues) => reported.push(issues)
    });

    expect(document.body.textContent).toContain('Unsupported component');
    expect(document.body.textContent).toContain('Modal');
    expect(reported.flat().some((i) => i.code === A2UI_ISSUE_CODES.UNSUPPORTED_COMPONENT)).toBe(
      true
    );
  });

  it('shows a placeholder for a dangling ref while streaming and a fault once settled', () => {
    const reported: A2uiValidationIssue[][] = [];
    const props = render({
      payload: [surface(), comps([{ id: 'root', component: 'Column', children: ['missing'] }])],
      streaming: true,
      onValidationError: (issues) => reported.push(issues)
    });

    // Streaming: the not-yet-defined reference renders a placeholder, not a fault.
    expect(screen.getByText('Loading UI')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Unsupported component');

    flushSync(() => {
      props.streaming = false;
    });
    flushSync();

    // Settled: the dangling reference becomes a visible fault + a reported error
    // (the first, streaming, report carried it as a warning).
    expect(document.body.textContent).toContain('Unsupported component');
    expect(
      reported
        .flat()
        .some((i) => i.code === A2UI_ISSUE_CODES.DANGLING_REF && i.severity === 'error')
    ).toBe(true);
  });

  it('shows a skeleton while streaming before the surface has a root, then the fault chip', () => {
    // The model emits createSurface fast but the (large) updateComponents last —
    // the wait must be visible, not blank.
    const props = render({ payload: [surface()], streaming: true });

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Loading UI')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Invalid UI payload');

    flushSync(() => {
      props.streaming = false;
    });
    flushSync();

    // Settled without a root: the skeleton yields to the fault chip.
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.body.textContent).toContain('Invalid UI payload');
  });

  it('shows a skeleton while streaming an empty payload and nothing once settled', () => {
    // The fence just opened — no envelope has completed yet.
    const props = render({ payload: [], streaming: true });
    expect(screen.getByRole('status')).toBeTruthy();

    flushSync(() => {
      props.streaming = false;
    });
    flushSync();

    // An empty settled payload renders nothing (no skeleton, no fault).
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.body.textContent).not.toContain('Invalid UI payload');
  });
});

describe('A2UIView — hardening (review regressions)', () => {
  it('does not crash on duplicate ChoicePicker option values (dedupes + warns)', () => {
    const reported: A2uiValidationIssue[][] = [];
    // A duplicate option.value used to throw Svelte's `each_key_duplicate` at
    // mount, breaking the "untrusted payload never throws" contract.
    expect(() =>
      render({
        payload: [
          surface(),
          data({ c: [] }),
          comps([
            {
              id: 'root',
              component: 'ChoicePicker',
              value: { path: '/c' },
              options: [
                { label: 'A', value: 'x' },
                { label: 'B', value: 'x' }
              ]
            }
          ])
        ],
        onValidationError: (issues) => reported.push(issues)
      })
    ).not.toThrow();
    expect(document.querySelectorAll('input[type="radio"]').length).toBe(1);
    expect(reported.flat().some((i) => i.code === A2UI_ISSUE_CODES.DUPLICATE_OPTION)).toBe(true);
  });

  it('gives a labelled Column role="group" so aria-label is valid', () => {
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Column',
            accessibility: { label: 'Booking form' },
            children: ['t']
          },
          { id: 't', component: 'Text', text: 'Hi' }
        ])
      ]
    });
    const group = screen.getByRole('group', { name: 'Booking form' });
    expect(group.tagName).toBe('DIV');
  });

  it('discards a typed literal input value on a full rebuild (generation remount)', async () => {
    const user = userEvent.setup();
    const props = render({
      payload: [
        surface(),
        comps([{ id: 'root', component: 'TextField', label: 'Name', value: 'A' }])
      ]
    });
    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('A');
    await user.clear(input);
    await user.type(input, 'hello');
    flushSync();
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('hello');

    // Fresh (non-referential) payload with a new literal → full rebuild remounts
    // the node, the local fallback resets, and the new literal wins.
    flushSync(() => {
      props.payload = [
        surface(),
        comps([{ id: 'root', component: 'TextField', label: 'Name', value: 'B' }])
      ];
    });
    flushSync();
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('B');
  });

  it('opens a policy-allowed openUrl action and no-ops a blocked one', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render({
      payload: [
        surface(),
        comps([
          { id: 'root', component: 'Column', children: ['ok', 'bad'] },
          {
            id: 'ok',
            component: 'Button',
            child: 'okl',
            action: { functionCall: { call: 'openUrl', args: { url: 'https://ok.example/' } } }
          },
          { id: 'okl', component: 'Text', text: 'Open' },
          {
            id: 'bad',
            component: 'Button',
            child: 'badl',
            action: { functionCall: { call: 'openUrl', args: { url: 'javascript:alert(1)' } } }
          },
          { id: 'badl', component: 'Text', text: 'Evil' }
        ])
      ],
      urlPolicy: { allowedLinkProtocols: ['https:'] }
    });
    await user.click(screen.getByRole('button', { name: /Open/ }));
    await user.click(screen.getByRole('button', { name: /Evil/ }));
    flushSync();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('https://ok.example/', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('disables a button for an unsupported functionCall and adds an sr-only note', () => {
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Button',
            child: 'l',
            action: { functionCall: { call: 'doThing' } }
          },
          { id: 'l', component: 'Text', text: 'Do' }
        ])
      ]
    });
    const button = screen.getByRole('button', { name: /Do/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(document.body.textContent).toContain('This action is not supported');
  });
});
