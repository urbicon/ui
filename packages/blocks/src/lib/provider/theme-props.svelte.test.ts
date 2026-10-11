// @vitest-environment jsdom
import { type Component, createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import A2UIView from '#lib/components/Chat/A2UIView/A2UIView.svelte';
import { urbiconA2uiCatalog } from '#lib/components/Chat/A2UIView/urbicon/a2ui-urbicon-catalog.js';
import { URBICON_A2UI_CATALOG_ID } from '#lib/components/Chat/A2UIView/urbicon/a2ui-urbicon-registry.js';
import DatePicker from '#lib/components/DatePicker/DatePicker.svelte';
import NumberInput from '#lib/components/NumberInput/NumberInput.svelte';
import Alert from '#lib/primitives/Alert/Alert.svelte';
import Badge from '#lib/primitives/Badge/Badge.svelte';
import Card from '#lib/primitives/Card/Card.svelte';
import Input from '#lib/primitives/Input/Input.svelte';
import ThemeContextHost from './__fixtures__/ThemeContextHost.svelte';
import ThemeHost from './__fixtures__/ThemeHost.svelte';
import type { ComponentDefaults, PresetMap } from './blocks-context';

type Config = { defaults?: Record<string, ComponentDefaults>; presets?: PresetMap };
type AnyComponent = Component<Record<string, unknown>>;

const mounted: { app: ReturnType<typeof mount>; target: HTMLElement }[] = [];

afterEach(() => {
  for (const { app, target } of mounted.splice(0)) {
    unmount(app);
    target.remove();
  }
  vi.restoreAllMocks();
});

function render(
  component: AnyComponent,
  props: Record<string, unknown> = {},
  config: Config = {}
): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  const app = mount(ThemeHost, { target, props: { component, props, config } });
  mounted.push({ app, target });
  flushSync();
  return target;
}

/** A target's markup with the per-mount ids `$props.id()` hands out made equal. */
function markup(root: HTMLElement): string {
  return root.innerHTML.replace(/\bc\d+\b/g, 'cN');
}

/** The class list of the first element matching `selector`. */
function classOf(root: HTMLElement, selector: string): string {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`no ${selector}`);
  return element.getAttribute('class') ?? '';
}

const field = (config: Config, props: Record<string, unknown> = {}) =>
  classOf(render(Input as AnyComponent, { label: 'L', ...props }, config), 'input');

describe('a theme default reads as the call site writing it', () => {
  it('gives Input the shipped underline variant, the same classes as `variant="underline"`', () => {
    const themed = field({ defaults: { Input: { props: { variant: 'underline' } } } });
    const written = field({}, { variant: 'underline' });
    expect(themed).toBe(written);
    // The shipped variant, not a hand-built one: the 2px edge, the ring turned off.
    expect(themed.split(' ')).toEqual(
      expect.arrayContaining(['border-b-2', 'focus-visible:ring-0'])
    );
    expect(themed).not.toBe(field({}));
  });

  it('ranks instance → preset → defaults → the component own default', () => {
    const config: Config = {
      defaults: { Input: { props: { variant: 'filled', size: 'lg' } } },
      presets: { Input: { zeile: { props: { variant: 'underline' } } } }
    };
    const bare = (props: Record<string, unknown>) => field({}, props);

    expect(field(config)).toBe(bare({ variant: 'filled', size: 'lg' }));
    expect(field(config, { preset: 'zeile' })).toBe(bare({ variant: 'underline', size: 'lg' }));
    expect(field(config, { preset: 'zeile', variant: 'ghost' })).toBe(
      bare({ variant: 'ghost', size: 'lg' })
    );
    expect(field({ presets: config.presets }, { preset: 'zeile' })).toBe(
      bare({ variant: 'underline' })
    );
  });

  it('follows a theme switched while the component is mounted', () => {
    const config = $state<Config>({ defaults: { Input: { props: { variant: 'filled' } } } });
    const root = render(Input as AnyComponent, { label: 'L' }, config);
    const filled = classOf(root, 'input');

    config.defaults = { Input: { props: { variant: 'underline' } } };
    flushSync();

    expect(classOf(root, 'input')).not.toBe(filled);
    expect(classOf(root, 'input')).toBe(field({}, { variant: 'underline' }));
  });
});

describe('overrides match the value a prop resolved to', () => {
  // The rung order is unchanged — props decide the variant, overrides then
  // match it — so a theme that defaults `outlined` makes every `outlined`
  // rule fire on instances that pass no variant at all.
  const config: Config = {
    defaults: {
      Card: {
        props: { variant: 'outlined' },
        overrides: [{ variant: 'outlined', class: { base: 'zz-outlined-rule' } }]
      }
    }
  };
  const card = (props: Record<string, unknown> = {}) =>
    classOf(render(Card as AnyComponent, props, config), 'div').split(' ');

  it('fires for an instance that names no variant', () => {
    expect(card()).toContain('zz-outlined-rule');
  });

  it('does not fire for an instance whose own variant wins', () => {
    expect(card({ variant: 'quiet' })).not.toContain('zz-outlined-rule');
  });
});

describe('what already beats the own default beats the theme too', () => {
  function probe(parent: 'toolbar' | 'group', defaults: Record<string, ComponentDefaults>) {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(ThemeContextHost, { target, props: { parent, defaults } });
    mounted.push({ app, target });
    flushSync();
    const button = [...target.querySelectorAll('button')].find((b) => b.textContent === 'Probe');
    return button?.getAttribute('class') ?? '';
  }

  it("keeps a Toolbar's TierContext above a Button theme tier", () => {
    expect(probe('toolbar', { Button: { props: { tier: 'commit' } } })).toBe(probe('toolbar', {}));
  });

  it("keeps a ButtonGroup's variant above a Button theme variant", () => {
    expect(probe('group', { Button: { props: { variant: 'filled' } } })).toBe(probe('group', {}));
  });
});

describe('a component that renders another one', () => {
  it('lets the inner name through where the wrapper sets nothing', () => {
    // NumberInput declares variant without a default of its own, so what its
    // name leaves unset Input resolves under `Input`, as it does for classes.
    const viaInput = classOf(
      render(
        NumberInput as AnyComponent,
        {},
        { defaults: { Input: { props: { variant: 'underline' } } } }
      ),
      'input'
    );
    expect(viaInput).toBe(
      classOf(render(NumberInput as AnyComponent, { variant: 'underline' }), 'input')
    );
    expect(viaInput.split(' ')).toContain('border-b-2');
  });

  it("ranks the wrapper's own name above the inner one", () => {
    const both = classOf(
      render(
        NumberInput as AnyComponent,
        {},
        {
          defaults: {
            Input: { props: { variant: 'underline' } },
            NumberInput: { props: { variant: 'filled' } }
          }
        }
      ),
      'input'
    );
    expect(both.split(' ')).not.toContain('border-b-2');
    expect(both).toBe(classOf(render(NumberInput as AnyComponent, { variant: 'filled' }), 'input'));
  });

  it("stops at a wrapper's own default: DatePicker's field takes `inputVariant`", () => {
    const plain = classOf(render(DatePicker as AnyComponent), 'input');
    const viaInput = classOf(
      render(
        DatePicker as AnyComponent,
        {},
        { defaults: { Input: { props: { variant: 'underline' } } } }
      ),
      'input'
    );
    const viaOwnName = classOf(
      render(
        DatePicker as AnyComponent,
        {},
        { defaults: { DatePicker: { props: { inputVariant: 'underline' } } } }
      ),
      'input'
    );
    expect(viaInput).toBe(plain);
    expect(viaOwnName).toBe(
      classOf(render(DatePicker as AnyComponent, { inputVariant: 'underline' }), 'input')
    );
    expect(viaOwnName).not.toBe(plain);
  });
});

describe('agent-rendered components', () => {
  // The reason presets did not help (#214): an agent never writes `preset`.
  // A theme default needs no call site, so it reaches what the agent renders —
  // provided the renderer leaves an unspecified style prop unset.
  const payload = (card: Record<string, unknown>, button: Record<string, unknown>) => [
    { version: 'v0.9.1', createSurface: { surfaceId: 's', catalogId: URBICON_A2UI_CATALOG_ID } },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 's',
        components: [
          { id: 'root', component: 'Card', child: 'b', ...card },
          {
            id: 'b',
            component: 'Button',
            child: 't',
            action: { event: { name: 'go' } },
            ...button
          },
          { id: 't', component: 'Text', text: 'Go' }
        ]
      }
    }
  ];
  const view = (card: Record<string, unknown>, button: Record<string, unknown>, config: Config) =>
    markup(
      render(
        A2UIView as unknown as AnyComponent,
        { payload: payload(card, button), catalogs: [urbiconA2uiCatalog] },
        config
      )
    );
  const theme: Config = {
    defaults: { Card: { props: { variant: 'outlined' } }, Button: { props: { intent: 'primary' } } }
  };

  it('gives an agent Card and Button the theme values the agent did not name', () => {
    expect(view({}, {}, theme)).toBe(view({ variant: 'outlined' }, { intent: 'primary' }, {}));
    expect(view({}, {}, theme)).not.toBe(view({}, {}, {}));
  });

  it('keeps what the agent did name above the theme', () => {
    expect(view({ variant: 'elevated' }, { intent: 'danger' }, theme)).toBe(
      view({ variant: 'elevated' }, { intent: 'danger' }, {})
    );
  });
});

describe('a theme sets the look, never what is announced or rendered', () => {
  /** The innermost element carrying a role that contains `text`. */
  function roleAround(root: HTMLElement, text: string): string | null {
    const owners = [...root.querySelectorAll('[role]')].filter((el) =>
      el.textContent?.includes(text)
    );
    return owners.at(-1)?.getAttribute('role') ?? null;
  }

  // Alert's intent is also its announced urgency: `danger` and `warning` take
  // `role="alert"`, which interrupts a screen reader. A theme colours every
  // alert; whether this one interrupts is the call site's to say.
  it("takes an Alert's colour from the theme and its urgency from the call site alone", () => {
    const danger: Config = { defaults: { Alert: { props: { intent: 'danger' } } } };
    const themed = render(Alert as AnyComponent, { title: 'Saved' }, danger);
    expect(roleAround(themed, 'Saved')).toBe('status');
    expect(markup(themed).replace(/role="\w+"/g, '')).toBe(
      markup(render(Alert as AnyComponent, { title: 'Saved', intent: 'danger' })).replace(
        /role="\w+"/g,
        ''
      )
    );
    expect(
      roleAround(render(Alert as AnyComponent, { title: 'Saved', intent: 'danger' }), 'Saved')
    ).toBe('alert');
    // A preset is named at the call site, but its props rank as theme: an
    // `error` preset colours the alert and does not make it interrupt.
    const preset: Config = { presets: { Alert: { error: { props: { intent: 'danger' } } } } };
    expect(
      roleAround(
        render(Alert as AnyComponent, { title: 'Saved', preset: 'error' }, preset),
        'Saved'
      )
    ).toBe('status');
  });

  it('keeps an agent Alert without an intent polite under a theme intent', () => {
    const alertPayload = (alert: Record<string, unknown>) => [
      { version: 'v0.9.1', createSurface: { surfaceId: 's', catalogId: URBICON_A2UI_CATALOG_ID } },
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'root', component: 'Alert', title: 'Saved', ...alert }]
        }
      }
    ];
    const agent = (alert: Record<string, unknown>, config: Config) =>
      roleAround(
        render(
          A2UIView as unknown as AnyComponent,
          { payload: alertPayload(alert), catalogs: [urbiconA2uiCatalog] },
          config
        ),
        'Saved'
      );
    const danger: Config = { defaults: { Alert: { props: { intent: 'danger' } } } };
    expect(agent({}, danger)).toBe('status');
    expect(agent({ intent: 'danger' }, {})).toBe('alert');
  });

  // `variant: 'dot'` hides a badge's content. The type admits no theme `dot`;
  // this pins that an untyped config cannot delete badge text either.
  it("keeps a Badge's text under a theme `variant: 'dot'`", () => {
    const text = createRawSnippet(() => ({ render: () => '<span>New</span>' }));
    const dot = { defaults: { Badge: { props: { variant: 'dot' } } } } as unknown as Config;
    const themed = render(Badge as AnyComponent, { children: text }, dot);
    expect(themed.textContent).toContain('New');
    expect(markup(themed)).toBe(markup(render(Badge as AnyComponent, { children: text })));
  });
});

describe('a key that is not a style prop', () => {
  it('is reported once in development, naming the component', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { defaults: { Input: { props: { disabled: true } } } } as unknown as Config;
    field(config);
    field(config);
    const reports = warn.mock.calls.filter(([message]) => String(message).includes('"disabled"'));
    expect(reports).toHaveLength(1);
    expect(String(reports[0][0])).toContain('"Input"');
  });
});
