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
    // Without sendDataModel the action carries only what `context` declares.
    expect(event.dataModel).toBeUndefined();
  });

  // The protocol gives the agent no way to observe typing — only an action
  // reaches it. `sendDataModel` is what keeps that one round-trip informative.
  describe('sendDataModel', () => {
    const sendingSurface = (): Envelope => ({
      version: V,
      createSurface: { surfaceId: 's', catalogId: 'x', sendDataModel: true }
    });
    const form = (): unknown[] => [
      { id: 'root', component: 'Column', children: ['field', 'go'] },
      { id: 'field', component: 'TextField', label: 'Name', value: { path: '/name' } },
      {
        id: 'go',
        component: 'Button',
        child: 'go_label',
        action: { event: { name: 'submit', context: {} } }
      },
      { id: 'go_label', component: 'Text', text: 'Go' }
    ];

    it('attaches the whole data model to a dispatched action', async () => {
      const user = userEvent.setup();
      const actions: A2uiActionEvent[] = [];
      render({
        payload: [sendingSurface(), data({ name: 'Ada', agreed: true }), comps(form())],
        onAction: (actionEvent) => actions.push(actionEvent)
      });

      await user.click(screen.getByRole('button', { name: /Go/ }));
      flushSync();

      // `context` is empty, yet the agent still learns what the user entered.
      expect(actions[0].context).toEqual({});
      expect(actions[0].dataModel).toEqual({ name: 'Ada', agreed: true });
    });

    it('sends the state at click time, not at render time', async () => {
      const user = userEvent.setup();
      const actions: A2uiActionEvent[] = [];
      render({
        payload: [sendingSurface(), data({ name: '' }), comps(form())],
        onAction: (actionEvent) => actions.push(actionEvent)
      });

      await user.type(screen.getByLabelText('Name'), 'Grace');
      await user.click(screen.getByRole('button', { name: /Go/ }));
      flushSync();

      expect(actions[0].dataModel).toEqual({ name: 'Grace' });
    });

    it('does not warn about the spec property any more', () => {
      const reported: A2uiValidationIssue[][] = [];
      render({
        payload: [sendingSurface(), comps([{ id: 'root', component: 'Text', text: 'hi' }])],
        onValidationError: (issues) => reported.push(issues)
      });

      expect(reported.flat().some((i) => i.code === A2UI_ISSUE_CODES.SURFACE_PROP_IGNORED)).toBe(
        false
      );
    });
  });

  // An agent that fetches a list mid-conversation (free slots, search hits)
  // writes it into the data model and binds `options` to it — otherwise it would
  // have to rewrite the component for every result.
  describe('options bound to the data model', () => {
    const picker = (options: unknown) =>
      comps([
        {
          id: 'root',
          component: 'ChoicePicker',
          label: 'Time',
          value: { path: '/time' },
          options
        }
      ]);

    it('renders the options a { path } binding resolves to', () => {
      render({
        payload: [
          surface(),
          data({
            time: [],
            slots: [
              { label: '09:00', value: '9' },
              { label: '13:45', value: '13' }
            ]
          }),
          picker({ path: '/slots' })
        ]
      });

      expect(document.body.textContent).toContain('09:00');
      expect(document.body.textContent).toContain('13:45');
    });

    it('picks up options that arrive in a later envelope', () => {
      const props = render({
        payload: [surface(), data({ time: [] }), picker({ path: '/slots' })]
      });

      expect(document.body.textContent).not.toContain('16:00');

      // The patch the agent sends after fetching — same surface, new data.
      props.payload = [
        ...(props.payload as unknown[]),
        data({ time: [], slots: [{ label: '16:00', value: '16' }] })
      ];
      flushSync();

      expect(document.body.textContent).toContain('16:00');
    });

    it('reports a binding that resolves to something other than an option list', () => {
      const reported: A2uiValidationIssue[][] = [];
      render({
        payload: [surface(), data({ slots: 'not-a-list' }), picker({ path: '/slots' })],
        onValidationError: (issues) => reported.push(issues)
      });

      const issue = reported.flat().find((i) => i.code === A2UI_ISSUE_CODES.OPTIONS_NOT_A_LIST);
      expect(issue?.severity).toBe('warning');
      expect(issue?.message).toContain('/slots');
    });

    it('stays silent while the bound data has not arrived yet', () => {
      const reported: A2uiValidationIssue[][] = [];
      render({
        payload: [surface(), data({ time: [] }), picker({ path: '/slots' })],
        onValidationError: (issues) => reported.push(issues)
      });

      expect(reported.flat().some((i) => i.code === A2UI_ISSUE_CODES.OPTIONS_NOT_A_LIST)).toBe(
        false
      );
    });

    it('still rejects a literal that is not an option array', () => {
      const reported: A2uiValidationIssue[][] = [];
      render({
        payload: [surface(), picker('nope')],
        onValidationError: (issues) => reported.push(issues)
      });

      expect(
        reported
          .flat()
          .some((i) => i.code === A2UI_ISSUE_CODES.TYPE_MISMATCH && i.severity === 'error')
      ).toBe(true);
    });
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

describe('A2UIView — DateTimeInput', () => {
  const dtSurface = (props: Record<string, unknown>, model: Record<string, unknown>) => [
    surface(),
    data(model),
    comps([
      { id: 'root', component: 'Column', children: ['dt', 'echo'] },
      { id: 'dt', component: 'DateTimeInput', value: { path: '/when' }, ...props },
      { id: 'echo', component: 'Text', text: { path: '/when' } }
    ])
  ];

  it('renders a DatePicker in date mode and writes a picked day back as YYYY-MM-DD', async () => {
    const user = userEvent.setup();
    render({ payload: dtSurface({ label: 'Date', enableDate: true }, { when: '2026-08-12' }) });

    // Bound value round-trips into the echo Text node.
    expect(document.body.textContent).toContain('2026-08-12');
    expect(screen.queryAllByRole('spinbutton', { hidden: true })).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Open calendar' }));
    flushSync();
    const day = document.querySelector<HTMLElement>('[data-date="2026-08-20"]');
    expect(day).toBeTruthy();
    await user.click(day as HTMLElement);
    flushSync();
    expect(document.body.textContent).toContain('2026-08-20');
  });

  it('renders date + time in datetime mode and combines both into one ISO string', async () => {
    const user = userEvent.setup();
    render({
      payload: dtSurface(
        { label: 'Due', enableDate: true, enableTime: true },
        { when: '2026-08-12T14:30' }
      )
    });

    // Both halves are on screen: calendar trigger + time segments.
    expect(screen.getByRole('button', { name: 'Open calendar' })).toBeTruthy();
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Open calendar' }));
    flushSync();
    await user.click(document.querySelector('[data-date="2026-08-15"]') as HTMLElement);
    flushSync();
    // The picked date merges with the untouched time part.
    expect(document.body.textContent).toContain('2026-08-15T14:30');
  });

  it('renders a TimeInput in time mode and writes typed segments back as HH:MM', async () => {
    const user = userEvent.setup();
    render({ payload: dtSurface({ label: 'Time', enableTime: true }, { when: '' }) });

    const segments = screen.getAllByRole('spinbutton');
    expect(segments.length).toBeGreaterThan(0);
    (segments[0] as HTMLElement).focus();
    await user.keyboard('0930');
    flushSync();
    expect(document.body.textContent).toContain('09:30');
  });

  it('strips a timezone suffix for display instead of shifting the time', () => {
    render({
      payload: dtSurface(
        { label: 'Due', enableDate: true, enableTime: true },
        { when: '2026-08-12T17:00:00Z' }
      )
    });
    // Timezone-naive by design: 17:00Z renders as 17 hours literal.
    const values = screen
      .getAllByRole('spinbutton')
      .map((el) => el.getAttribute('aria-valuenow') ?? el.textContent);
    expect(values.join(':')).toContain('17');
  });

  it('reports DATETIME_NO_MODE but still renders a date input when both flags are missing', () => {
    const reported: A2uiValidationIssue[][] = [];
    render({
      payload: dtSurface({ label: 'When' }, { when: '' }),
      onValidationError: (issues) => reported.push(issues)
    });
    expect(screen.getByRole('button', { name: 'Open calendar' })).toBeTruthy();
    expect(reported.flat().some((i) => i.code === A2UI_ISSUE_CODES.DATETIME_NO_MODE)).toBe(true);
  });

  it('routes accessibility.label to the date field name (no aria-label on a generic div)', () => {
    // DatePicker spreads aria-label onto its role-less root div (AT-ignored),
    // so the accessibility label must become the field label instead.
    render({
      payload: [
        surface(),
        data({ when: '' }),
        comps([
          {
            id: 'root',
            component: 'DateTimeInput',
            value: { path: '/when' },
            enableDate: true,
            accessibility: { label: 'Appointment date' }
          }
        ])
      ]
    });
    expect(screen.getByRole('textbox', { name: /Appointment date/ })).toBeTruthy();
    // The name must NOT sit as aria-label on a role-less div (aria-prohibited-attr).
    expect(document.querySelector('div[aria-label="Appointment date"]:not([role])')).toBeNull();
  });

  it('never throws on hostile DateTimeInput payloads', () => {
    const hostile = [
      { value: { nested: { deep: true } }, enableDate: true },
      { value: 12345, enableTime: true },
      { value: { path: '/when' }, enableDate: true, min: 'garbage', max: '9999-99-99' },
      { value: { path: '/when' }, enableDate: true, enableTime: true, label: { path: '/missing' } }
    ];
    for (const props of hostile) {
      expect(() => {
        render({ payload: dtSurface(props, { when: 'not-a-date' }) });
        dispose?.();
        dispose = undefined;
      }).not.toThrow();
      document.body.replaceChildren();
    }
  });
});

describe('A2UIView — Tabs', () => {
  it('renders one tab per item with the first panel active', () => {
    const issues: A2uiValidationIssue[] = [];
    render({
      onValidationError: (next) => issues.push(...next),
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Tabs',
            tabs: [
              { title: 'Details', child: 'p1' },
              { title: 'History', child: 'p2' }
            ]
          },
          { id: 'p1', component: 'Text', text: 'PANEL-ONE' },
          { id: 'p2', component: 'Text', text: 'PANEL-TWO' }
        ])
      ]
    });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Details', 'History']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tabpanel').textContent).toContain('PANEL-ONE');
  });

  it('switches the visible panel on click (selection is client-local)', async () => {
    const user = userEvent.setup();
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Tabs',
            tabs: [
              { title: 'First', child: 'p1' },
              { title: 'Second', child: 'p2' }
            ]
          },
          { id: 'p1', component: 'Text', text: 'PANEL-ONE' },
          { id: 'p2', component: 'Text', text: 'PANEL-TWO' }
        ])
      ]
    });
    await user.click(screen.getByRole('tab', { name: 'Second' }));
    flushSync();
    const panel = screen.getByRole('tabpanel');
    expect(panel.textContent).toContain('PANEL-TWO');
    expect(panel.textContent).not.toContain('PANEL-ONE');
    expect(screen.getByRole('tab', { name: 'Second' }).getAttribute('aria-selected')).toBe('true');
  });

  it('resolves a { path } binding in a tab title', () => {
    render({
      payload: [
        surface(),
        data({ who: 'Ada' }),
        comps([
          {
            id: 'root',
            component: 'Tabs',
            tabs: [{ title: { path: '/who' }, child: 'p1' }]
          },
          { id: 'p1', component: 'Text', text: 'body' }
        ])
      ]
    });
    expect(screen.getByRole('tab', { name: 'Ada' })).toBeTruthy();
  });

  it('keeps titles aligned with panels when an earlier item cycles', async () => {
    const user = userEvent.setup();
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Tabs',
            tabs: [
              { title: 'Alpha', child: 'root' }, // cyclic → dropped from node.children
              { title: 'Beta', child: 'pb' },
              { title: 'Gamma', child: 'pc' }
            ]
          },
          { id: 'pb', component: 'Text', text: 'PANEL-BETA' },
          { id: 'pc', component: 'Text', text: 'PANEL-GAMMA' }
        ])
      ]
    });
    // All three titles render — only the cyclic item's panel is empty.
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    const beta = screen.getByRole('tab', { name: 'Beta' });
    await user.click(beta);
    flushSync();
    // Beta's panel must be PANEL-BETA, not shifted to PANEL-GAMMA by a positional zip.
    const panelId = beta.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    expect(panel?.textContent).toContain('PANEL-BETA');
    expect(panel?.textContent).not.toContain('PANEL-GAMMA');
  });

  it('emits unique tab/panel ids when two items name the same child', () => {
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Tabs',
            tabs: [
              { title: 'One', child: 'shared' },
              { title: 'Two', child: 'shared' }
            ]
          },
          { id: 'shared', component: 'Text', text: 'panel' }
        ])
      ]
    });
    const ids = screen.getAllByRole('tab').map((t) => t.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  // Two parents referencing ONE Tabs id is a diamond, not a cycle — the graph
  // check passes it with zero issues and the node is built twice. Render-node
  // keys are only unique among SIBLINGS (`a2ui-render.ts` builds them without
  // the parent key), so identity for DOM ids must come from the component
  // instance, never from the payload or the render key.
  it('emits unique ids when two parents share one Tabs child (diamond)', () => {
    const issues: A2uiValidationIssue[] = [];
    render({
      onValidationError: (next) => issues.push(...next),
      payload: [
        surface(),
        comps([
          { id: 'root', component: 'Row', children: ['c1', 'c2'] },
          { id: 'c1', component: 'Column', children: ['tb'] },
          { id: 'c2', component: 'Column', children: ['tb'] },
          {
            id: 'tb',
            component: 'Tabs',
            tabs: [
              { title: 'A', child: 'b1' },
              { title: 'B', child: 'b2' }
            ]
          },
          { id: 'b1', component: 'Text', text: 'BODY-A' },
          { id: 'b2', component: 'Text', text: 'BODY-B' }
        ])
      ]
    });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(new Set(tabs.map((t) => t.id)).size).toBe(4);

    const panelIds = Array.from(document.querySelectorAll('[role="tabpanel"]')).map((p) => p.id);
    expect(panelIds).toHaveLength(4);
    expect(new Set(panelIds).size).toBe(4);

    // Each tab must point at exactly ONE existing panel — with colliding ids the
    // second strip's aria-controls resolves to the first strip's panel.
    for (const tab of tabs) {
      const controls = tab.getAttribute('aria-controls') ?? '';
      expect(panelIds.filter((id) => id === controls)).toHaveLength(1);
    }
  });

  // Component ids are validated as "non-empty string, not a proto key" only, so
  // a payload id may carry whitespace. Whitespace in an `aria-controls` value
  // makes it an IDREF *list*, silently severing the tab↔panel relation for AT.
  it('emits whitespace-free ids when a payload id contains spaces', () => {
    const issues: A2uiValidationIssue[] = [];
    render({
      onValidationError: (next) => issues.push(...next),
      payload: [
        surface(),
        comps([
          { id: 'root', component: 'Column', children: ['my tab'] },
          { id: 'my tab', component: 'Tabs', tabs: [{ title: 'A', child: 'b1' }] },
          { id: 'b1', component: 'Text', text: 'BODY' }
        ])
      ]
    });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);

    const tab = screen.getByRole('tab');
    expect(tab.id).not.toMatch(/\s/);
    const controls = tab.getAttribute('aria-controls') ?? '';
    expect(controls).not.toMatch(/\s/);
    expect(document.getElementById(controls)).not.toBeNull();
  });

  // A plain <div> is role=generic, which forbids aria-label (axe
  // aria-prohibited-attr) — same rule the Column/Row/Card branches follow.
  it('gives a labelled Tabs role=group so aria-label is valid', () => {
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Tabs',
            accessibility: { label: 'Booking steps' },
            tabs: [{ title: 'A', child: 'b1' }]
          },
          { id: 'b1', component: 'Text', text: 'BODY' }
        ])
      ]
    });
    expect(screen.getByRole('group', { name: 'Booking steps' })).toBeTruthy();
    expect(document.querySelector('div[aria-label="Booking steps"]:not([role])')).toBeNull();
  });

  it('warns (not errors) on an empty tabs array and renders no tablist', () => {
    const issues: A2uiValidationIssue[] = [];
    render({
      onValidationError: (next) => issues.push(...next),
      payload: [surface(), comps([{ id: 'root', component: 'Tabs', tabs: [] }])]
    });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(issues.some((i) => i.code === A2UI_ISSUE_CODES.TABS_EMPTY)).toBe(true);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    // An empty `role="tablist"` violates aria-required-children — render nothing.
    expect(document.querySelector('[role="tablist"]')).toBeNull();
  });

  it('rejects the whole prop when an item uses `label` instead of the spec `title`', () => {
    const issues: A2uiValidationIssue[] = [];
    render({
      onValidationError: (next) => issues.push(...next),
      payload: [
        surface(),
        comps([
          { id: 'root', component: 'Tabs', tabs: [{ label: 'Wrong', child: 'p1' }] },
          { id: 'p1', component: 'Text', text: 'body' }
        ])
      ]
    });
    expect(issues.some((i) => i.code === A2UI_ISSUE_CODES.TYPE_MISMATCH)).toBe(true);
    // `tabs` is required, so dropping it makes the component a visible fault.
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  // Every payload-driven keyed {#each} is an each_key_duplicate surface, and a
  // Tabs strip renders TWO of them (triggers + panels) plus two DOM id spaces.
  // Mount AND unmount must survive any shape the model can emit.
  describe('never throws on adversarial Tabs payloads', () => {
    const attacks: Record<string, unknown[]> = {
      'duplicate titles': [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Tabs',
            tabs: [
              { title: 'Same', child: 'p1' },
              { title: 'Same', child: 'p2' }
            ]
          },
          { id: 'p1', component: 'Text', text: 'one' },
          { id: 'p2', component: 'Text', text: 'two' }
        ])
      ],
      'two items on the same child id': [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Tabs',
            tabs: [
              { title: 'A', child: 'shared' },
              { title: 'B', child: 'shared' }
            ]
          },
          { id: 'shared', component: 'Text', text: 'panel' }
        ])
      ],
      'child references an ancestor (cycle)': [
        surface(),
        comps([{ id: 'root', component: 'Tabs', tabs: [{ title: 'Loop', child: 'root' }] }])
      ],
      'child references the Tabs itself via a wrapper': [
        surface(),
        comps([
          { id: 'root', component: 'Column', children: ['tabs'] },
          { id: 'tabs', component: 'Tabs', tabs: [{ title: 'Up', child: 'root' }] }
        ])
      ],
      'empty tabs array': [surface(), comps([{ id: 'root', component: 'Tabs', tabs: [] }])],
      'dangling child id': [
        surface(),
        comps([{ id: 'root', component: 'Tabs', tabs: [{ title: 'Ghost', child: 'nope' }] }])
      ],
      'malformed items (non-object, missing child, non-string title)': [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Tabs',
            tabs: [null, 42, { title: 'ok' }, { child: 'p1' }, { title: { deep: {} }, child: 'p1' }]
          },
          { id: 'p1', component: 'Text', text: 'body' }
        ])
      ],
      'tabs is not an array': [
        surface(),
        comps([{ id: 'root', component: 'Tabs', tabs: { title: 'x', child: 'p1' } }])
      ],
      'title binds to a missing data path': [
        surface(),
        data({}),
        comps([
          { id: 'root', component: 'Tabs', tabs: [{ title: { path: '/gone' }, child: 'p1' }] },
          { id: 'p1', component: 'Text', text: 'body' }
        ])
      ],
      'nested Tabs inside a Tabs panel': [
        surface(),
        comps([
          { id: 'root', component: 'Tabs', tabs: [{ title: 'Outer', child: 'inner' }] },
          { id: 'inner', component: 'Tabs', tabs: [{ title: 'Inner', child: 'leaf' }] },
          { id: 'leaf', component: 'Text', text: 'deep' }
        ])
      ]
    };

    for (const [name, payload] of Object.entries(attacks)) {
      it(`survives: ${name}`, () => {
        expect(() => {
          render({ payload });
          flushSync();
          dispose?.();
          dispose = undefined;
        }).not.toThrow();
      });
    }
  });

  it('falls back to the first tab when an update shrinks the list under the selection', async () => {
    const user = userEvent.setup();
    const tabsOf = (titles: string[]) => ({
      id: 'root',
      component: 'Tabs',
      tabs: titles.map((title, i) => ({ title, child: `p${i}` }))
    });
    const props = render({
      payload: [
        surface(),
        comps([
          tabsOf(['A', 'B', 'C']),
          { id: 'p0', component: 'Text', text: 'PANEL-A' },
          { id: 'p1', component: 'Text', text: 'PANEL-B' },
          { id: 'p2', component: 'Text', text: 'PANEL-C' }
        ])
      ]
    });

    await user.click(screen.getByRole('tab', { name: 'C' }));
    flushSync();
    expect(screen.getByRole('tabpanel').textContent).toContain('PANEL-C');

    // A later updateComponents replaces `root` with a shorter list — the stored
    // selection now points at a tab that no longer exists. The strip must fall
    // back to the first tab, never leave the panel area blank.
    flushSync(() => {
      props.payload = [...(props.payload as unknown[]), comps([tabsOf(['A'])])];
    });
    flushSync();

    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('PANEL-A');
  });
});
