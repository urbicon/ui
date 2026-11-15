// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import A2UIView from '../A2UIView.svelte';
import { A2UI_ISSUE_CODES, type A2uiActionEvent, type A2uiValidationIssue } from '../a2ui.types';
import type { A2uiPropSpec } from '../a2ui-registry';
import { validateA2uiPayload } from '../a2ui-validate';
import type { A2UIViewProps } from '../index';
import { urbiconA2uiCatalog } from './a2ui-urbicon-catalog';
import {
  URBICON_A2UI_CATALOG_ID,
  URBICON_A2UI_REGISTRY,
  urbiconA2uiCatalogSpec
} from './a2ui-urbicon-registry';

// DOM tests for the Urbicon A2UI dispatcher. The registry + axes have a node
// suite; here we assert the render layer: every catalog component mounts through
// a real Urbicon primitive without a fault chip or error issue (drift guard),
// key components round-trip data/actions, and adversarial payloads never throw.
// House stack: Svelte's own mount/unmount, @testing-library/dom, no jest-dom.

const V = '1.0';
const CID = URBICON_A2UI_CATALOG_ID;
type Envelope = Record<string, unknown>;

function surface(id = 's'): Envelope {
  return { version: V, createSurface: { surfaceId: id, catalogId: CID } };
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

function render(initial: Partial<A2UIViewProps> & { payload: unknown }) {
  const issues: A2uiValidationIssue[] = [];
  const props = $state<A2UIViewProps>({
    catalogs: [urbiconA2uiCatalog],
    unsupportedLabel: 'FAULTCHIP',
    onValidationError: (next) => {
      issues.length = 0;
      issues.push(...next);
    },
    ...initial
  });
  const instance = mount(A2UIView, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  return { props, issues };
}

// ── Minimal-valid payload generator (kind-driven) ──────────────────────────────
function minimalValue(spec: A2uiPropSpec): unknown {
  switch (spec.kind) {
    case 'string':
      return 'x';
    case 'number':
      return 1;
    case 'boolean':
      return false;
    case 'stringList':
      return spec.required ? [] : undefined;
    case 'enum':
      return spec.values?.[0];
    case 'icon':
      return spec.values?.[0] ?? 'info';
    case 'childId':
      return 'stub';
    case 'childList':
      return ['stub'];
    case 'labeledChildren':
      return [{ label: 'L', child: 'stub' }];
    case 'action':
      return { event: { name: 'act' } };
    case 'options':
      return [{ label: 'A', value: 'a' }];
  }
}

function minimalComponent(name: string): Record<string, unknown> {
  const spec = URBICON_A2UI_REGISTRY[name];
  const out: Record<string, unknown> = { id: 'root', component: name };
  for (const [key, propSpec] of Object.entries(spec.props)) {
    if (!propSpec.required) continue;
    const value = minimalValue(propSpec);
    if (value !== undefined) out[key] = value;
  }
  // Slider needs a max even though `value` is the only listed-required numeric.
  if (name === 'Slider') out.max = 10;
  return out;
}

describe('registry ↔ dispatcher drift guard', () => {
  for (const name of Object.keys(URBICON_A2UI_REGISTRY)) {
    it(`${name} mounts through a real component without a fault or error issue`, () => {
      const { issues } = render({
        payload: [
          surface(),
          data({}),
          comps([minimalComponent(name), { id: 'stub', component: 'Text', text: 'stub' }])
        ]
      });
      const errors = issues.filter((issue) => issue.severity === 'error');
      expect(errors, `${name}: ${errors.map((e) => e.message).join('; ')}`).toEqual([]);
      expect(document.body.textContent).not.toContain('FAULTCHIP');
    });
  }
});

// The drift guard above asserts the chip's absence; this asserts it appears.
describe('fault chip', () => {
  it('stands in for a known component missing a required prop, and for an unknown one', () => {
    for (const [component, props] of [
      ['Button', { child: 'stub' }],
      ['Nope', {}]
    ] as const) {
      const { issues } = render({
        payload: [
          surface(),
          comps([
            { id: 'root', component, ...props },
            { id: 'stub', component: 'Text', text: 'stub' }
          ])
        ]
      });
      expect(issues.some((issue) => issue.severity === 'error')).toBe(true);
      expect(document.body.textContent).toContain(`FAULTCHIP: ${component}`);
      expect(document.querySelector('button')).toBeNull();
      dispose?.();
      dispose = undefined;
      document.body.replaceChildren();
    }
  });
});

describe('Urbicon rendering + interaction', () => {
  it('Button dispatches a spec-exact action with a resolved context binding', async () => {
    const user = userEvent.setup();
    const actions: A2uiActionEvent[] = [];
    render({
      payload: [
        surface(),
        data({ who: 'Ada' }),
        comps([
          {
            id: 'root',
            component: 'Button',
            intent: 'primary',
            child: 'lbl',
            action: { event: { name: 'go', context: { who: { '@path': '/who' } } } }
          },
          { id: 'lbl', component: 'Text', text: 'Go' }
        ])
      ],
      onAction: (event) => actions.push(event)
    });
    await user.click(screen.getByRole('button', { name: /Go/ }));
    flushSync();
    expect(actions).toHaveLength(1);
    expect(actions[0].name).toBe('go');
    expect(actions[0].context).toEqual({ who: 'Ada' });
  });

  it('Input writes back into the bound data model (two-way)', async () => {
    const user = userEvent.setup();
    const { props } = render({
      payload: [
        surface(),
        data({ name: '' }),
        comps([{ id: 'root', component: 'Input', label: 'Name', value: { '@path': '/name' } }])
      ]
    });
    const input = screen.getByLabelText('Name');
    await user.type(input, 'Ada');
    flushSync();
    // The bound model updated; re-render reflects it.
    expect((input as HTMLInputElement).value).toBe('Ada');
    expect(props).toBeDefined();
  });

  it('Text renders PLAIN (no markdown) while RichText parses markdown', () => {
    render({
      payload: [
        surface(),
        comps([
          { id: 'root', component: 'Column', children: ['t', 'r'] },
          { id: 't', component: 'Text', text: 'A **bold** claim' },
          { id: 'r', component: 'RichText', content: 'A **bold** claim' }
        ])
      ]
    });
    // Plain Text keeps the asterisks literally; RichText emits a <strong>.
    expect(document.body.textContent).toContain('A **bold** claim');
    expect(document.querySelector('strong')?.textContent).toBe('bold');
  });

  it('Text with markdown raises a MARKDOWN_IN_TEXT warning', () => {
    const { issues } = render({
      payload: [surface(), comps([{ id: 'root', component: 'Text', text: 'has `code`' }])]
    });
    expect(issues.some((i) => i.code === 'MARKDOWN_IN_TEXT' && i.severity === 'warning')).toBe(
      true
    );
  });

  it('Accordion renders one panel per labeledChildren item', () => {
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Accordion',
            items: [
              { label: 'First', child: 'p1' },
              { label: 'Second', child: 'p2' }
            ]
          },
          { id: 'p1', component: 'Text', text: 'Panel one' },
          { id: 'p2', component: 'Text', text: 'Panel two' }
        ])
      ]
    });
    expect(document.body.textContent).toContain('First');
    expect(document.body.textContent).toContain('Second');
  });

  it('Progress omits value when indeterminate', () => {
    const { issues } = render({
      payload: [surface(), comps([{ id: 'root', component: 'Progress', indeterminate: true }])]
    });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(document.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('Accordion keeps labels aligned with panels when an earlier item cycles', async () => {
    const user = userEvent.setup();
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'Accordion',
            multiple: true,
            items: [
              { label: 'Alpha', child: 'root' }, // cyclic ref → dropped from node.children
              { label: 'Beta', child: 'pb' },
              { label: 'Gamma', child: 'pc' }
            ]
          },
          { id: 'pb', component: 'Text', text: 'PANEL-BETA' },
          { id: 'pc', component: 'Text', text: 'PANEL-GAMMA' }
        ])
      ]
    });
    // All three labels render (the cyclic item is not dropped, only its panel).
    const beta = screen.getByRole('button', { name: /Beta/ });
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Gamma/ })).toBeDefined();
    // Beta's panel must be PANEL-BETA, not shifted to PANEL-GAMMA.
    await user.click(beta);
    flushSync();
    const panelId = beta.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    expect(panel?.textContent).toContain('PANEL-BETA');
    expect(panel?.textContent).not.toContain('PANEL-GAMMA');
  });

  it('Card places header, body and footer children', () => {
    render({
      payload: [
        surface(),
        comps([
          { id: 'root', component: 'Card', header: 'h', child: 'b', footer: 'f' },
          { id: 'h', component: 'Text', text: 'HEAD' },
          { id: 'b', component: 'Text', text: 'BODY' },
          { id: 'f', component: 'Text', text: 'FOOT' }
        ])
      ]
    });
    expect(document.body.textContent).toContain('HEAD');
    expect(document.body.textContent).toContain('BODY');
    expect(document.body.textContent).toContain('FOOT');
  });
});

// The render layer must survive any untrusted payload without throwing — every
// payload-driven keyed {#each} (Select/RadioGroup options, Accordion items,
// Stepper steps) is an each_key_duplicate surface, and out-of-range numbers /
// injected enum values must degrade, never crash. Mount AND unmount must not
// throw (unmount runs the components' teardown).
describe('never throws on adversarial Urbicon payloads', () => {
  function mountUnmount(payload: unknown) {
    const { props } = render({ payload });
    void props;
    flushSync();
    dispose?.();
    dispose = undefined;
  }

  const attacks: Record<string, unknown[]> = {
    'duplicate Select option values': [
      surface(),
      data({ pick: [] }),
      comps([
        {
          id: 'root',
          component: 'Select',
          value: { '@path': '/pick' },
          options: [
            { label: 'A', value: 'dup' },
            { label: 'B', value: 'dup' },
            { label: 'C', value: 'dup' }
          ]
        }
      ])
    ],
    'duplicate RadioGroup option values': [
      surface(),
      comps([
        {
          id: 'root',
          component: 'RadioGroup',
          value: 'dup',
          options: [
            { label: 'A', value: 'dup' },
            { label: 'B', value: 'dup' }
          ]
        }
      ])
    ],
    'Accordion items pointing at the same child id': [
      surface(),
      comps([
        {
          id: 'root',
          component: 'Accordion',
          items: [
            { label: 'One', child: 'shared' },
            { label: 'Two', child: 'shared' }
          ]
        },
        { id: 'shared', component: 'Text', text: 'panel' }
      ])
    ],
    'labeledChildren cycle (item child references an ancestor)': [
      surface(),
      comps([{ id: 'root', component: 'Accordion', items: [{ label: 'Loop', child: 'root' }] }])
    ],
    'EmptyState cta references an undefined component': [
      surface(),
      comps([{ id: 'root', component: 'EmptyState', title: 'Empty', cta: 'ghost' }])
    ],
    'NaN / Infinity on Progress and Slider': [
      surface(),
      data({ p: Number.NaN, s: Number.POSITIVE_INFINITY }),
      comps([
        { id: 'root', component: 'Column', children: ['pr', 'sl'] },
        { id: 'pr', component: 'Progress', value: { '@path': '/p' }, max: Number.NaN },
        { id: 'sl', component: 'Slider', value: { '@path': '/s' }, max: Number.NEGATIVE_INFINITY }
      ])
    ],
    'Stepper with duplicate step labels': [
      surface(),
      comps([{ id: 'root', component: 'Stepper', steps: ['Same', 'Same', 'Same'], current: 1 }])
    ],
    'injected enum values (unknown variant/intent, non-string)': [
      surface(),
      comps([
        {
          id: 'root',
          component: 'Badge',
          text: 'x',
          variant: 'not-a-variant',
          intent: 12345
        }
      ])
    ],
    'Alert with a dangling body child': [
      surface(),
      comps([{ id: 'root', component: 'Alert', title: 'Heads up', child: 'nope' }])
    ],
    'dot Badge carrying text': [
      surface(),
      comps([{ id: 'root', component: 'Badge', text: 'hidden', variant: 'dot', intent: 'success' }])
    ],
    'Avatar with a policy-blocked src': [
      surface(),
      comps([{ id: 'root', component: 'Avatar', src: 'https://evil.example/pic.png', name: 'Ada' }])
    ]
  };

  for (const [name, payload] of Object.entries(attacks)) {
    it(`survives: ${name}`, () => {
      expect(() => mountUnmount(payload)).not.toThrow();
    });
  }
});

describe('UrbiconA2UINode — @accessibility', () => {
  // The name is dom-accessibility-api's (through getByRole); its 0.5 line reads
  // `aria-describedby` but not `aria-description`, so the description is
  // computed here, in accname's order: an `aria-describedby` that points at an
  // element wins, and `aria-description` counts only without one.
  const descriptionOf = (element: Element) => {
    const referenced = (element.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((id) => document.getElementById(id) ?? []);
    return referenced.length > 0
      ? referenced.map((node) => node.textContent ?? '').join(' ')
      : (element.getAttribute('aria-description') ?? '');
  };
  /** The text a sighted user can see: every text node outside a `hidden` element. */
  const visibleText = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.parentElement?.closest('[hidden]')) out.push(node.textContent ?? '');
    }
    return out.join(' ');
  };
  /** The hidden elements an `aria-labelledby` or `aria-describedby` points at. */
  const hiddenReferences = () => {
    const ids = [...document.querySelectorAll('[aria-labelledby], [aria-describedby]')].flatMap(
      (element) =>
        `${element.getAttribute('aria-labelledby') ?? ''} ${element.getAttribute('aria-describedby') ?? ''}`
          .split(/\s+/)
          .filter(Boolean)
    );
    return [...new Set(ids)].flatMap((id) => {
      const element = document.getElementById(id);
      return element?.hidden ? [element] : [];
    });
  };
  /**
   * The whitespace-only text nodes next to `element`, looking past the comment
   * anchors and empty text nodes Svelte leaves, which render nothing.
   */
  const blankTextBeside = (element: Element) =>
    (['previousSibling', 'nextSibling'] as const).flatMap((side) => {
      let sibling = element[side];
      while (
        sibling &&
        (sibling.nodeType === Node.COMMENT_NODE ||
          (sibling.nodeType === Node.TEXT_NODE && sibling.textContent === ''))
      ) {
        sibling = sibling[side];
      }
      return sibling?.nodeType === Node.TEXT_NODE && /^\s+$/.test(sibling.textContent ?? '')
        ? [sibling]
        : [];
    });
  const kid = { id: 'kid', component: 'Text', text: 'kid' };
  const go = { event: { name: 'go' } };
  const options = [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' }
  ];
  // [case, component, the role that carries the name, its siblings]
  const named: Array<[string, Record<string, unknown>, string, unknown[]?]> = [
    ['Column', { component: 'Column', children: ['kid'] }, 'group', [kid]],
    ['List', { component: 'List', children: ['kid'] }, 'list', [kid]],
    ['Card', { component: 'Card', child: 'kid' }, 'group', [kid]],
    ['Section', { component: 'Section', title: 'Title', child: 'kid' }, 'region', [kid]],
    [
      'Accordion',
      { component: 'Accordion', items: [{ label: 'I1', child: 'kid' }] },
      'group',
      [kid]
    ],
    ['Icon', { component: 'Icon', name: 'calendar' }, 'img'],
    ['Image', { component: 'Image', url: 'https://img.example/a.png', description: 'Alt' }, 'img'],
    ['Avatar', { component: 'Avatar', name: 'Ada Lovelace' }, 'img'],
    ['Badge', { component: 'Badge', text: 'New' }, 'status'],
    ['Alert', { component: 'Alert', title: 'Heads up' }, 'status'],
    ['Progress', { component: 'Progress', value: 5, max: 10, label: 'Shown' }, 'progressbar'],
    ['Stepper', { component: 'Stepper', steps: ['One', 'Two'], current: 0 }, 'list'],
    ['Button', { component: 'Button', child: 'kid', action: go }, 'button', [kid]],
    ['Input', { component: 'Input', label: 'Shown', value: { '@path': '/t' } }, 'textbox'],
    ['Textarea', { component: 'Textarea', label: 'Shown', value: { '@path': '/t' } }, 'textbox'],
    ['Checkbox', { component: 'Checkbox', label: 'Shown', value: { '@path': '/c' } }, 'checkbox'],
    ['Toggle', { component: 'Toggle', label: 'Shown', value: { '@path': '/c' } }, 'switch'],
    [
      'RadioGroup, labelled',
      { component: 'RadioGroup', label: 'Shown', options, value: { '@path': '/r' } },
      'radiogroup'
    ],
    [
      'RadioGroup, unlabelled',
      { component: 'RadioGroup', options, value: { '@path': '/r' } },
      'radiogroup'
    ],
    [
      'Select, labelled',
      { component: 'Select', label: 'Shown', options, value: { '@path': '/s' } },
      'combobox'
    ],
    ['Select, unlabelled', { component: 'Select', options, value: { '@path': '/s' } }, 'combobox'],
    [
      'Select multiple',
      { component: 'Select', label: 'Shown', options, value: { '@path': '/s' }, multiple: true },
      'combobox'
    ],
    [
      'Slider, labelled',
      { component: 'Slider', label: 'Shown', value: { '@path': '/n' }, max: 10 },
      'slider'
    ],
    ['Slider, unlabelled', { component: 'Slider', value: { '@path': '/n' }, max: 10 }, 'slider'],
    [
      'DatePicker, labelled',
      { component: 'DatePicker', label: 'Shown', value: { '@path': '/d' } },
      'textbox'
    ],
    ['DatePicker, unlabelled', { component: 'DatePicker', value: { '@path': '/d' } }, 'textbox']
  ];

  it.each(named)(
    'names and describes the %s where focus lands, and never shows the label',
    (_case, component, role, siblings = []) => {
      render({
        urlPolicy: { allowedImagePrefixes: ['https://img.example/'] },
        payload: [
          surface(),
          comps([
            {
              id: 'root',
              ...component,
              '@accessibility': { label: 'Named', description: 'Described' }
            },
            ...siblings
          ])
        ]
      });
      const target = screen.getByRole(role, { name: 'Named' });
      expect(descriptionOf(target)).toBe('Described');
      expect(visibleText()).not.toContain('Named');
      if (component.label !== undefined) expect(visibleText()).toContain('Shown');
    }
  );

  // The label names the one group TimeInput draws around its segments; the
  // description reaches each segment, where TimeInput's own messages go.
  it.each([
    ['label and description', { label: 'Named', description: 'Described' }, 'Named'],
    ['description', { description: 'Described' }, 'Shown']
  ])('names the group of a TimeInput and describes its segments, given a %s', (_c, a11y, name) => {
    render({
      payload: [
        surface(),
        comps([
          {
            id: 'root',
            component: 'TimeInput',
            label: 'Shown',
            value: { '@path': '/d' },
            '@accessibility': a11y
          }
        ])
      ]
    });
    const group = screen.getByRole('group');
    expect(screen.getByRole('group', { name })).toBe(group);
    const segments = screen.getAllByRole('spinbutton');
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      expect(group.contains(segment)).toBe(true);
      expect(descriptionOf(segment)).toBe('Described');
    }
    expect(visibleText()).toContain('Shown');
    expect(visibleText()).not.toContain('Named');
  });

  // A field's own error is an `aria-describedby`, which an `aria-description`
  // loses to; the error is read first, as Input reads its own.
  it.each([
    ['Input', { component: 'Input', label: 'Shown', value: { '@path': '/t' } }, 'textbox'],
    ['Textarea', { component: 'Textarea', label: 'Shown', value: { '@path': '/t' } }, 'textbox'],
    [
      'DatePicker',
      { component: 'DatePicker', label: 'Shown', value: { '@path': '/d' } },
      'textbox'
    ],
    [
      'TimeInput',
      { component: 'TimeInput', label: 'Shown', value: { '@path': '/d' } },
      'spinbutton'
    ]
  ])('reads the error of a %s, then its description', (_case, component, role) => {
    for (const [a11y, description] of [
      [{ description: 'Described' }, 'Wrong Described'],
      [undefined, 'Wrong']
    ] as const) {
      render({
        payload: [
          surface(),
          comps([
            {
              id: 'root',
              ...component,
              error: 'Wrong',
              ...(a11y ? { '@accessibility': a11y } : {})
            }
          ])
        ]
      });
      const targets = screen.getAllByRole(role);
      for (const target of targets) expect(descriptionOf(target)).toBe(description);
      expect(visibleText()).toContain('Wrong');
      dispose?.();
      document.body.replaceChildren();
    }
  });

  // An `aria-label` beside `alt=""` is a presentation-role conflict (axe).
  it.each([
    ['a label', { '@accessibility': { label: 'Named' } }, 'Named'],
    [
      'a label and a description',
      { description: 'Alt', '@accessibility': { label: 'Named' } },
      'Named'
    ],
    ['a description', { description: 'Alt' }, 'Alt'],
    ['neither', {}, '']
  ])('gives an Image with %s its name as alt text', (_c, props, alt) => {
    render({
      urlPolicy: { allowedImagePrefixes: ['https://img.example/'] },
      payload: [
        surface(),
        comps([{ id: 'root', component: 'Image', url: 'https://img.example/a.png', ...props }])
      ]
    });
    const image = document.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('alt')).toBe(alt);
    expect(image.hasAttribute('aria-label')).toBe(false);
  });

  // Inside a `white-space: pre-wrap` bubble, a whitespace text node beside the
  // hidden spans is an empty line in a block container such as a list item.
  it.each([
    ['RadioGroup', { component: 'RadioGroup', options, value: { '@path': '/r' } }],
    ['Select', { component: 'Select', options, value: { '@path': '/s' } }],
    ['Select multiple', { component: 'Select', options, value: { '@path': '/s' }, multiple: true }],
    ['Slider', { component: 'Slider', value: { '@path': '/n' }, max: 10 }],
    ['Toggle', { component: 'Toggle', label: 'Shown', value: { '@path': '/c' } }],
    ['Input', { component: 'Input', label: 'Shown', value: { '@path': '/t' } }],
    ['Textarea', { component: 'Textarea', label: 'Shown', value: { '@path': '/t' } }],
    ['DatePicker', { component: 'DatePicker', value: { '@path': '/d' }, error: 'Wrong' }],
    ['TimeInput', { component: 'TimeInput', value: { '@path': '/d' }, error: 'Wrong' }]
  ])('leaves no whitespace beside the hidden references of a %s', (_case, component) => {
    render({
      payload: [
        surface(),
        comps([
          { id: 'root', component: 'List', children: ['field'] },
          {
            id: 'field',
            ...component,
            '@accessibility': { label: 'Named', description: 'Described' }
          }
        ])
      ]
    });
    const references = hiddenReferences();
    expect(references).toHaveLength(2);
    for (const reference of references) expect(blankTextBeside(reference)).toEqual([]);
  });

  it('gives an unlabelled Card or Accordion no group role', () => {
    render({
      payload: [
        surface(),
        comps([
          { id: 'root', component: 'Column', children: ['card', 'acc'] },
          { id: 'card', component: 'Card', child: 'kid' },
          { id: 'acc', component: 'Accordion', items: [{ label: 'I1', child: 'kid2' }] },
          kid,
          { id: 'kid2', component: 'Text', text: 'kid2' }
        ])
      ]
    });
    expect(screen.queryAllByRole('group')).toHaveLength(0);
  });
});

describe('a field the data model cannot take', () => {
  const at = (path: string, value: unknown): Envelope => ({
    version: V,
    updateDataModel: { surfaceId: 's', path, value }
  });
  const form = (field: Record<string, unknown>, dataModel: unknown): unknown[] => [
    { version: V, createSurface: { surfaceId: 's', catalogId: CID, dataModel } },
    comps([
      { id: 'root', component: 'Column', children: ['field'] },
      { id: 'field', ...field }
    ])
  ];
  const locked = (element: Element) =>
    (element as HTMLInputElement).disabled === true ||
    element.getAttribute('aria-disabled') === 'true';
  const pointerErrors = (issues: readonly A2uiValidationIssue[]) =>
    issues.filter((issue) => issue.code === A2UI_ISSUE_CODES.POINTER_ERROR);
  const through = { '@path': '/user/name/first' };
  const options = [
    { label: 'One', value: 'one' },
    { label: 'Two', value: 'two' }
  ];

  it.each([
    ['Input', { component: 'Input', label: 'First', value: through }, 'textbox'],
    ['Textarea', { component: 'Textarea', label: 'First', value: through }, 'textbox'],
    ['Checkbox', { component: 'Checkbox', label: 'First', value: through }, 'checkbox'],
    ['RadioGroup', { component: 'RadioGroup', options, value: through }, 'radio'],
    ['Select', { component: 'Select', multiple: true, options, value: through }, 'combobox'],
    ['Slider', { component: 'Slider', max: 10, value: through }, 'slider'],
    ['Toggle', { component: 'Toggle', label: 'First', value: through }, 'switch'],
    ['DatePicker', { component: 'DatePicker', label: 'First', value: through }, 'textbox'],
    ['TimeInput', { component: 'TimeInput', label: 'First', value: through }, 'spinbutton']
  ])(
    'locks %s while its pointer runs through a string, and unlocks it once a message fixes the model',
    (_name, field, role) => {
      const payload = form(field, { user: { name: 'Alice' } });
      const { props, issues } = render({ payload });

      expect(screen.getAllByRole(role).every(locked)).toBe(true);
      expect(pointerErrors(issues).map((issue) => issue.severity)).toEqual(['error']);
      expect(issues).toEqual(validateA2uiPayload(payload, { catalogs: [urbiconA2uiCatalogSpec] }));

      flushSync(() => {
        props.payload = [...payload, at('/user/name', {})];
      });
      expect(screen.getAllByRole(role).some(locked)).toBe(false);
      expect(pointerErrors(issues)).toEqual([]);
    }
  );

  it('locks an Input on a root a message replaced with a number', () => {
    const payload = [
      ...form({ component: 'Input', label: 'Name', value: { '@path': '/name' } }, { name: 'A' }),
      at('/', 7)
    ];
    const { props, issues } = render({ payload });
    expect(locked(screen.getByRole('textbox'))).toBe(true);
    expect(pointerErrors(issues)).toHaveLength(1);
    flushSync(() => {
      props.payload = [...payload, at('/', {})];
    });
    expect(locked(screen.getByRole('textbox'))).toBe(false);
    expect(pointerErrors(issues)).toEqual([]);
  });

  it('locks only the template items whose scoped pointer the model refuses', () => {
    const payload = [
      {
        version: V,
        createSurface: { surfaceId: 's', catalogId: CID, dataModel: { rows: [{}, 'b'] } }
      },
      comps([
        { id: 'root', component: 'List', children: { componentId: 'row', path: '/rows' } },
        { id: 'row', component: 'Input', label: 'Row', value: { '@path': 'name' } }
      ])
    ];
    const { props, issues } = render({ payload });
    expect(screen.getAllByRole('textbox').map(locked)).toEqual([false, true]);
    expect(pointerErrors(issues)).toHaveLength(1);
    flushSync(() => {
      props.payload = [...payload, at('/rows/1', {})];
    });
    expect(screen.getAllByRole('textbox').map(locked)).toEqual([false, false]);
    expect(pointerErrors(issues)).toEqual([]);
  });

  it('leaves a field enabled and silent whose write creates what its pointer passes through', () => {
    const payload = form(
      { component: 'Input', label: 'Guest', value: { '@path': '/guests/1/name' } },
      {}
    );
    const { issues } = render({ payload });
    expect(locked(screen.getByRole('textbox'))).toBe(false);
    expect(issues).toEqual([]);
  });
});
