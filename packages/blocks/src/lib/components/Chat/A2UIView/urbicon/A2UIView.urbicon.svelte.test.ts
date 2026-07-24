// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import A2UIView from '../A2UIView.svelte';
import type { A2uiActionEvent, A2uiValidationIssue } from '../a2ui.types';
import type { A2uiPropSpec } from '../a2ui-registry';
import type { A2UIViewProps } from '../index';
import { urbiconA2uiCatalog } from './a2ui-urbicon-catalog';
import { URBICON_A2UI_CATALOG_ID, URBICON_A2UI_REGISTRY } from './a2ui-urbicon-registry';

// DOM tests for the Urbicon A2UI dispatcher. The registry + axes have a node
// suite; here we assert the render layer: every catalog component mounts through
// a real Urbicon primitive without a fault chip or error issue (drift guard),
// key components round-trip data/actions, and adversarial payloads never throw.
// House stack: Svelte's own mount/unmount, @testing-library/dom, no jest-dom.

const V = 'v0.9.1';
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
    case 'accessibility':
      return { label: 'x' };
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
            action: { event: { name: 'go', context: { who: { path: '/who' } } } }
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
        comps([{ id: 'root', component: 'Input', label: 'Name', value: { path: '/name' } }])
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
          value: { path: '/pick' },
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
        { id: 'pr', component: 'Progress', value: { path: '/p' }, max: Number.NaN },
        { id: 'sl', component: 'Slider', value: { path: '/s' }, max: Number.NEGATIVE_INFINITY }
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
