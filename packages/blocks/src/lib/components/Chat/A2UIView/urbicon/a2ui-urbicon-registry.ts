/**
 * The Urbicon-native A2UI catalog registry — the single source of truth for
 * validation AND the Urbicon system prompt, exactly like the Basic registry but
 * carrying the FULL Urbicon vocabulary the Basic subset flattens away: real
 * intents (primary/secondary/success/warning/danger/neutral), a size axis, the
 * component-native `variant` axes, a structure layer (`Section`), a
 * plain-vs-markdown split (`Text` vs `RichText`) and labelled disclosure
 * (`Accordion`).
 *
 * HAND-curated (descriptions, childId conventions, prop whitelist) but the axis
 * VALUES it advertises are library truth: every prop that carries an `axis` is
 * coupled to `urbicon-axes.gen.ts` (generated from the docs-gen catalog) by a
 * blocks-internal drift test — curated `values ⊆ axis`, `default ===`, and every
 * `urbicon` reference exists. So the catalog can never offer a variant the real
 * component does not support. No Svelte imports: a server building the prompt has
 * no DOM.
 *
 * Curation rules (never in the catalog): snippets, callbacks (`on*`),
 * `class`/`unstyled`/`slotClasses`/`preset`/`mint`/`tier`, style booleans.
 * Snippet slots become `childId`s; composites become data props (Stepper steps
 * as a string list, Accordion items as `labeledChildren`); two-way state is a
 * `dynamic` prop the renderer writes back. Field errors travel on a single
 * `error?: string` (the renderer sets intent=danger) — NO per-field intent axis.
 */

import { A2UI_ISSUE_CODES } from '../a2ui.types';
import type { A2uiCatalogSpec } from '../a2ui-catalog';
import type { A2uiComponentSpec, A2uiPropSpec } from '../a2ui-registry';

/**
 * Axes shared across many components, defined ONCE so the prompt can document
 * them a single time and each prop reference them (compression) instead of
 * repeating the full list. Per-prop `default`s still vary (a Button defaults to
 * neutral, a Badge to primary), so only the value SET is shared.
 */
export const SHARED_AXES = {
  /** The six semantic intents. Alert additionally offers `info` (its own axis). */
  intent: ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const,
  /** The curated size subset (the library also has 2xs/xs/xl/2xl — deliberately omitted). */
  size: ['sm', 'md', 'lg'] as const
} satisfies Record<string, readonly string[]>;

/** A prop spec extended with Urbicon-specific drift/prompt anchors. */
export interface UrbiconPropSpec extends A2uiPropSpec {
  /**
   * The Urbicon variant-axis this prop maps to — the drift anchor into
   * `URBICON_AXES[component.urbicon][axis]`. Present only on style-axis props.
   */
  axis?: string;
  /**
   * When set, the prop's values come from `SHARED_AXES` — a prompt hint so the
   * axis is documented once and referenced, not spelled out per component.
   */
  sharedAxis?: 'intent' | 'size';
}

/** A component spec extended with the source component + a prompt-grouping category. */
export interface UrbiconComponentSpec extends A2uiComponentSpec {
  props: Record<string, UrbiconPropSpec>;
  /** The Urbicon component this maps to (drift anchor into `URBICON_AXES`). Omitted for structural/composite entries. */
  urbicon?: string;
  /** Prompt-grouping category (Layout / Text / Form / Status / Media). */
  category: string;
}

/** The opaque catalog id this catalog advertises in `createSurface`. Custom catalogs are spec-sanctioned via `catalogId`. */
export const URBICON_A2UI_CATALOG_ID = 'urbicon-ui/urbicon-catalog/v1';

/** Mapped `Icon.name` values: the Basic 16 plus 10 curated domain glyphs. */
export const URBICON_A2UI_ICON_NAMES: readonly string[] = [
  // Basic 16
  'add',
  'arrowBack',
  'check',
  'close',
  'delete',
  'edit',
  'error',
  'home',
  'info',
  'mail',
  'menu',
  'search',
  'send',
  'settings',
  'star',
  'warning',
  // Curated 10 (domain depth: scheduling, identity, contact, place, money, data ops, navigation)
  'calendar',
  'clock',
  'user',
  'phone',
  'mapPin',
  'euro',
  'filter',
  'refresh',
  'chevronRight',
  'link'
];

/** Real Urbicon components deliberately not in the v1 catalog (error chip, not "unknown"). */
export const UNSUPPORTED_URBICON_A2UI_COMPONENTS: ReadonlySet<string> = new Set([
  'Tabs',
  'Combobox',
  'Toolbar',
  'ButtonGroup',
  'FormField',
  'SegmentGroup',
  'Dialog',
  'Drawer',
  'Popover',
  'Menu',
  'Tooltip',
  'Table',
  'CommandPalette'
]);

/** Props recognised anywhere but intentionally ignored (validation warning only, dropped before render). */
export const URBICON_A2UI_IGNORED_PROPS: ReadonlySet<string> = new Set([
  'checks',
  'validationRegexp'
]);

const COMMON_PROPS: Record<string, UrbiconPropSpec> = {
  accessibility: {
    kind: 'accessibility',
    description:
      'Accessibility attributes { label, description } for assistive technologies. label is a short (1–3 word) purpose string; description adds instructions or format requirements.'
  },
  weight: {
    kind: 'number',
    description:
      'Relative flex-grow weight within a Row or Column (like CSS flex-grow). ONLY honored when this component is a direct child of a Row or Column.'
  }
};

function withCommon(props: Record<string, UrbiconPropSpec>): Record<string, UrbiconPropSpec> {
  return { ...props, ...COMMON_PROPS };
}

/** An `intent` prop drawn from the six shared intents, with a component-specific default. */
function intentProp(def: string, description: string): UrbiconPropSpec {
  return {
    kind: 'enum',
    values: SHARED_AXES.intent,
    default: def,
    sharedAxis: 'intent',
    axis: 'intent',
    description
  };
}

/** A `size` prop drawn from the shared size subset (default md). */
function sizeProp(description = 'Size of the component.'): UrbiconPropSpec {
  return {
    kind: 'enum',
    values: SHARED_AXES.size,
    default: 'md',
    sharedAxis: 'size',
    axis: 'size',
    description
  };
}

export const URBICON_A2UI_REGISTRY: Readonly<Record<string, UrbiconComponentSpec>> = Object.freeze({
  // ── Layout ────────────────────────────────────────────────────────────────
  Column: {
    category: 'Layout',
    description:
      'A layout container that arranges its children vertically. Nest Rows inside a Column to build a grid.',
    props: withCommon({
      children: {
        kind: 'childList',
        required: true,
        description:
          'The children: either an array of component IDs, or a template { componentId, path } that repeats one component over a data-model array. Children are referenced by ID only — never defined inline.'
      },
      justify: {
        kind: 'enum',
        values: ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'],
        default: 'start',
        description:
          'Arrangement along the main (vertical) axis. Use spaceBetween to push items to the top and bottom edges.'
      },
      align: {
        kind: 'enum',
        values: ['start', 'center', 'end', 'stretch'],
        default: 'stretch',
        description: 'Alignment along the cross (horizontal) axis, like CSS align-items.'
      }
    })
  },

  Row: {
    category: 'Layout',
    description:
      'A layout container that arranges its children horizontally. Nest Columns inside a Row to build a grid.',
    props: withCommon({
      children: {
        kind: 'childList',
        required: true,
        description:
          'The children: either an array of component IDs, or a template { componentId, path } that repeats one component over a data-model array. Children are referenced by ID only — never defined inline.'
      },
      justify: {
        kind: 'enum',
        values: ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'],
        default: 'start',
        description:
          'Arrangement along the main (horizontal) axis. Use spaceBetween to push items to the left and right edges.'
      },
      align: {
        kind: 'enum',
        values: ['start', 'center', 'end', 'stretch'],
        default: 'center',
        description: 'Alignment along the cross (vertical) axis, like CSS align-items.'
      }
    })
  },

  List: {
    category: 'Layout',
    description:
      'A list container. Prefer a template { componentId, path } to render one row per data-model array item.',
    props: withCommon({
      children: {
        kind: 'childList',
        required: true,
        description:
          'The children: an array of component IDs, or a template { componentId, path }. Children are referenced by ID only.'
      },
      direction: {
        kind: 'enum',
        values: ['vertical', 'horizontal'],
        default: 'vertical',
        description: 'The direction list items flow in.'
      }
    })
  },

  Card: {
    category: 'Layout',
    urbicon: 'Card',
    description:
      'A visually grouped container. Its main content is one `child` (wrap several elements in a Column/Row). Optional `header` and `footer` childIds frame it.',
    props: withCommon({
      child: {
        kind: 'childId',
        required: true,
        description:
          'The ID of the main child component. Pass a layout container ID for multiple elements. Never inline the child.'
      },
      header: {
        kind: 'childId',
        description: 'Optional header child ID, rendered above the content with a divider.'
      },
      footer: {
        kind: 'childId',
        description: 'Optional footer child ID, rendered below the content with a divider.'
      },
      variant: {
        kind: 'enum',
        values: ['elevated', 'floating', 'outlined', 'quiet'],
        default: 'quiet',
        axis: 'variant',
        description:
          'Surface style. quiet is a flat panel; outlined adds a border; elevated/floating add shadow.'
      }
    })
  },

  Separator: {
    category: 'Layout',
    urbicon: 'Separator',
    description: 'A thin rule that visually separates content.',
    props: withCommon({
      orientation: {
        kind: 'enum',
        values: ['horizontal', 'vertical'],
        default: 'horizontal',
        axis: 'orientation',
        description: 'Orientation of the separator.'
      }
    })
  },

  Section: {
    category: 'Layout',
    description:
      'A titled content block: a heading (and optional description) above one `child`. The building block for page-like structure — group related controls under a Section instead of a bare Column.',
    props: withCommon({
      title: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The section heading.'
      },
      description: {
        kind: 'string',
        dynamic: true,
        description: 'Optional supporting text under the heading.'
      },
      child: {
        kind: 'childId',
        required: true,
        description: 'The ID of the section body (usually a Column). Never inline the child.'
      }
    })
  },

  EmptyState: {
    category: 'Layout',
    urbicon: 'EmptyState',
    description:
      'A centered placeholder for "no data" / "nothing here yet": an optional icon, a title, supporting text, and an optional call-to-action button.',
    props: withCommon({
      title: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The primary message (e.g. "No appointments yet").'
      },
      description: {
        kind: 'string',
        dynamic: true,
        description: 'Optional secondary text explaining the state or the next step.'
      },
      icon: {
        kind: 'icon',
        values: URBICON_A2UI_ICON_NAMES,
        description: 'Optional icon name shown above the title.'
      },
      cta: {
        kind: 'childId',
        description: 'Optional call-to-action child ID (usually a Button). Never inline the child.'
      }
    })
  },

  // ── Text ──────────────────────────────────────────────────────────────────
  Text: {
    category: 'Text',
    description:
      'Displays PLAIN text — no Markdown is parsed (a literal `**x**` shows the asterisks). Use RichText for formatted prose. Choose a `variant` for the typographic role.',
    props: withCommon({
      text: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The text to display. Bind to the data model with { path } for live values.'
      },
      variant: {
        kind: 'enum',
        values: ['h1', 'h2', 'h3', 'h4', 'h5', 'body', 'caption'],
        default: 'body',
        description:
          'Typographic role. h1–h5 are headings; caption is small secondary text; body is default.'
      }
    })
  },

  RichText: {
    category: 'Text',
    description:
      'Displays formatted prose from Markdown (bold, italic, lists, code, and links). Links are gated by the host URL policy. Use this — NOT Text — whenever you need any formatting.',
    props: withCommon({
      content: {
        kind: 'string',
        required: true,
        dynamic: true,
        description:
          'The Markdown source. Bind with { path } for live values. Images are blocked; links follow the host policy.'
      }
    })
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  Button: {
    category: 'Form',
    urbicon: 'Button',
    description:
      'A clickable button. Its `child` is the label (a Text). `action` MUST be a server event. Use `intent` for meaning (primary CTA, danger action) and `variant` for emphasis.',
    props: withCommon({
      child: {
        kind: 'childId',
        required: true,
        description:
          'The ID of the label component (usually a Text). For an icon-only button pass an Icon ID. Never inline the child.'
      },
      action: {
        kind: 'action',
        required: true,
        description:
          'The interaction handler. Use the server-event form { event: { name, context } }. Resolve dynamic context values with { path } bindings; use literals for static values.'
      },
      intent: intentProp(
        'neutral',
        'Semantic intent. primary is the main call to action; danger a destructive action; success/warning as appropriate.'
      ),
      variant: {
        kind: 'enum',
        values: ['filled', 'ghost', 'outlined', 'text'],
        default: 'filled',
        axis: 'variant',
        description:
          'Emphasis. filled is solid; outlined is bordered; ghost is subtle; text is link-like.'
      },
      size: sizeProp('Button size.'),
      disabled: {
        kind: 'boolean',
        dynamic: true,
        description:
          'Whether the button is disabled. Bind with { path } to gate on data-model state.'
      }
    })
  },

  Input: {
    category: 'Form',
    urbicon: 'Input',
    description:
      'A single-line text input. `label` is required. Bind `value` to a data-model path for two-way binding (typing writes to the model immediately). Report a field error via `error`.',
    props: withCommon({
      label: { kind: 'string', required: true, dynamic: true, description: 'The field label.' },
      value: {
        kind: 'string',
        dynamic: true,
        description: 'The field value. Bind with { path } for two-way binding.'
      },
      placeholder: { kind: 'string', dynamic: true, description: 'Placeholder text when empty.' },
      inputType: {
        kind: 'enum',
        values: ['text', 'email', 'number', 'tel', 'url', 'password'],
        default: 'text',
        description: 'The input type (controls the keyboard and validation).'
      },
      error: {
        kind: 'string',
        dynamic: true,
        description:
          'A validation error message. When non-empty the field renders in the danger intent with the message below.'
      }
    })
  },

  Textarea: {
    category: 'Form',
    urbicon: 'Textarea',
    description:
      'A multi-line text input. `label` is required. Bind `value` for two-way binding. Report a field error via `error`.',
    props: withCommon({
      label: { kind: 'string', required: true, dynamic: true, description: 'The field label.' },
      value: {
        kind: 'string',
        dynamic: true,
        description: 'The field value. Bind with { path } for two-way binding.'
      },
      placeholder: { kind: 'string', dynamic: true, description: 'Placeholder text when empty.' },
      rows: { kind: 'number', description: 'Visible number of text rows.' },
      error: {
        kind: 'string',
        dynamic: true,
        description: 'A validation error message; non-empty renders the field in the danger intent.'
      }
    })
  },

  Checkbox: {
    category: 'Form',
    urbicon: 'Checkbox',
    description:
      'A single boolean checkbox with a label. Bind `value` to a data-model boolean for two-way binding.',
    props: withCommon({
      label: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The text shown next to the checkbox.'
      },
      value: {
        kind: 'boolean',
        required: true,
        dynamic: true,
        description: 'The checked state. Bind with { path } for two-way binding.'
      }
    })
  },

  RadioGroup: {
    category: 'Form',
    urbicon: 'RadioGroup',
    description:
      'Single-choice selection from a list of options. Bind `value` to the selected option value (a single string).',
    props: withCommon({
      options: {
        kind: 'options',
        required: true,
        dynamic: true,
        description:
          'The available options as an array of { label, value } objects; `value` is a stable string. Bind it when the options come from data you fetched.'
      },
      value: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The selected option value. Bind with { path } for two-way binding.'
      },
      label: { kind: 'string', dynamic: true, description: 'An optional label for the group.' },
      orientation: {
        kind: 'enum',
        values: ['horizontal', 'vertical'],
        default: 'vertical',
        axis: 'orientation',
        description: 'Layout direction of the radio items.'
      }
    })
  },

  Select: {
    category: 'Form',
    urbicon: 'Select',
    description:
      'A dropdown select. Bind `value` to a data-model STRING ARRAY (single-select writes a one-element array). Set `multiple` for multi-select.',
    props: withCommon({
      options: {
        kind: 'options',
        required: true,
        dynamic: true,
        description:
          'The options as an array of { label, value } objects; `value` is a stable string. Bind it when the options come from data you fetched.'
      },
      value: {
        kind: 'stringList',
        required: true,
        dynamic: true,
        description:
          'The selected values as a string array in the data model. Single-select writes a one-element array.'
      },
      multiple: {
        kind: 'boolean',
        default: false,
        description: 'Allow selecting several options.'
      },
      label: { kind: 'string', dynamic: true, description: 'An optional label for the select.' },
      placeholder: {
        kind: 'string',
        dynamic: true,
        description: 'Placeholder when nothing is selected.'
      }
    })
  },

  Slider: {
    category: 'Form',
    urbicon: 'Slider',
    description:
      'A numeric slider. `value` and `max` are required (`min` defaults to 0). Bind `value` for two-way binding.',
    props: withCommon({
      value: {
        kind: 'number',
        required: true,
        dynamic: true,
        description: 'The current value. Bind with { path } for two-way binding.'
      },
      max: { kind: 'number', required: true, description: 'The maximum value.' },
      min: { kind: 'number', default: 0, description: 'The minimum value (default 0).' },
      step: { kind: 'number', description: 'The step increment.' },
      label: { kind: 'string', dynamic: true, description: 'An optional label for the slider.' }
    })
  },

  Toggle: {
    category: 'Form',
    urbicon: 'Toggle',
    description:
      'An on/off switch with a label. Bind `value` to a data-model boolean for two-way binding.',
    props: withCommon({
      label: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The text shown next to the switch.'
      },
      value: {
        kind: 'boolean',
        required: true,
        dynamic: true,
        description: 'The on/off state. Bind with { path } for two-way binding.'
      }
    })
  },

  DatePicker: {
    category: 'Form',
    urbicon: 'DatePicker',
    description:
      'A calendar date input. `value` is an ISO date STRING (YYYY-MM-DD, "" when unset). Bind `value` for two-way binding; initialize the bound path with "".',
    props: withCommon({
      value: {
        kind: 'string',
        required: true,
        dynamic: true,
        description:
          'The ISO date (YYYY-MM-DD, "" when unset). Bind with { path } for two-way binding.'
      },
      label: { kind: 'string', dynamic: true, description: 'The field label.' },
      min: { kind: 'string', dynamic: true, description: 'Minimum allowed date (YYYY-MM-DD).' },
      max: { kind: 'string', dynamic: true, description: 'Maximum allowed date (YYYY-MM-DD).' },
      error: {
        kind: 'string',
        dynamic: true,
        description: 'A validation error message; non-empty renders the field in the danger intent.'
      }
    })
  },

  TimeInput: {
    category: 'Form',
    urbicon: 'TimeInput',
    description:
      'A time-of-day input. `value` is an ISO time STRING (HH:MM, "" when unset). Bind `value` for two-way binding; initialize the bound path with "".',
    props: withCommon({
      value: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The ISO time (HH:MM, "" when unset). Bind with { path } for two-way binding.'
      },
      label: { kind: 'string', dynamic: true, description: 'The field label.' },
      min: { kind: 'string', dynamic: true, description: 'Minimum allowed time (HH:MM).' },
      max: { kind: 'string', dynamic: true, description: 'Maximum allowed time (HH:MM).' },
      error: {
        kind: 'string',
        dynamic: true,
        description: 'A validation error message; non-empty renders the field in the danger intent.'
      }
    })
  },

  // ── Status / Media ──────────────────────────────────────────────────────────
  Badge: {
    category: 'Status',
    urbicon: 'Badge',
    description:
      'A small status/label pill. Its `text` is the label. Use `intent` for meaning and `variant` for style.',
    props: withCommon({
      text: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The badge label. Bind with { path } for a live value.'
      },
      intent: intentProp('primary', 'Semantic intent (colour) of the badge.'),
      variant: {
        kind: 'enum',
        values: ['filled', 'soft', 'outlined', 'dot'],
        default: 'filled',
        axis: 'variant',
        description: 'Fill style. dot renders a leading status dot before the label.'
      }
    })
  },

  Alert: {
    category: 'Status',
    urbicon: 'Alert',
    description:
      'A prominent inline message (info/success/warning/danger). `title` is required; add a `child` for rich body content. Use the `info` intent for neutral notices.',
    props: withCommon({
      title: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The alert heading. Bind with { path } for a live value.'
      },
      description: {
        kind: 'string',
        dynamic: true,
        description: 'Optional supporting text under the title.'
      },
      child: {
        kind: 'childId',
        description:
          'Optional rich body child ID (e.g. a Column of controls). Never inline the child.'
      },
      intent: {
        kind: 'enum',
        values: ['info', 'success', 'warning', 'danger', 'primary', 'neutral'],
        default: 'primary',
        axis: 'intent',
        description: 'Semantic intent. info is a neutral notice; danger a critical error.'
      },
      variant: {
        kind: 'enum',
        values: ['soft', 'filled', 'inline'],
        default: 'soft',
        axis: 'variant',
        description: 'Emphasis. soft is tinted; filled is solid; inline is compact.'
      }
    })
  },

  Progress: {
    category: 'Status',
    urbicon: 'Progress',
    description:
      'A progress bar. Bind `value` (0..max) for live progress, or set `indeterminate` for an unknown-duration pulse.',
    props: withCommon({
      value: {
        kind: 'number',
        dynamic: true,
        description: 'The current progress (0..max). Bind with { path } for live updates.'
      },
      max: { kind: 'number', default: 100, description: 'The maximum value (default 100).' },
      indeterminate: {
        kind: 'boolean',
        default: false,
        description: 'Show an indeterminate (unknown-duration) animation instead of a value.'
      },
      intent: intentProp('primary', 'Semantic intent (colour) of the bar.'),
      label: { kind: 'string', dynamic: true, description: 'An optional label above the bar.' }
    })
  },

  Stepper: {
    category: 'Status',
    urbicon: 'Stepper',
    description:
      'A read-only progress indicator across ordered steps. `steps` are the step labels; `current` is the zero-based active step index.',
    props: withCommon({
      steps: {
        kind: 'stringList',
        required: true,
        description: 'The ordered step labels as a string array.'
      },
      current: {
        kind: 'number',
        dynamic: true,
        description:
          'The zero-based index of the active step. Bind with { path } for live progress.'
      },
      orientation: {
        kind: 'enum',
        values: ['horizontal', 'vertical'],
        default: 'horizontal',
        axis: 'orientation',
        description: 'Layout direction of the steps.'
      },
      variant: {
        kind: 'enum',
        values: ['default', 'minimal', 'outlined'],
        default: 'default',
        axis: 'variant',
        description: 'Visual style of the step markers.'
      }
    })
  },

  Accordion: {
    category: 'Layout',
    urbicon: 'Accordion',
    description:
      'A vertical list of collapsible sections. `items` is an array of { label, child }: the label is the header, the child is the panel body (a component ID). Set `multiple` to allow several open at once.',
    props: withCommon({
      items: {
        kind: 'labeledChildren',
        required: true,
        description:
          'The sections as an array of { label, child }. label is the header text; child is the panel body component ID (never inlined).'
      },
      multiple: {
        kind: 'boolean',
        default: false,
        description: 'Allow more than one section open at the same time.'
      },
      variant: {
        kind: 'enum',
        values: ['default', 'card', 'ghost'],
        default: 'default',
        axis: 'variant',
        description: 'Visual style of the accordion.'
      }
    })
  },

  Avatar: {
    category: 'Media',
    urbicon: 'Avatar',
    description:
      'A user/entity avatar. Provide `src` (an image URL, subject to the host policy) and/or `name` (initials fallback). Choose `variant` for shape and `size`.',
    props: withCommon({
      src: {
        kind: 'string',
        dynamic: true,
        description: 'The image URL (blocked by default unless the host allows the source).'
      },
      name: {
        kind: 'string',
        dynamic: true,
        description: 'A name used for initials and the accessible label when no image loads.'
      },
      variant: {
        kind: 'enum',
        values: ['circle', 'rounded', 'square'],
        default: 'circle',
        axis: 'variant',
        description: 'Shape of the avatar.'
      },
      size: sizeProp('Avatar size.')
    })
  },

  Icon: {
    category: 'Media',
    description:
      'Displays a named icon from the mapped set. Use `name` with one of the supported names; unknown names fall back to a generic glyph.',
    props: withCommon({
      name: {
        kind: 'icon',
        required: true,
        values: URBICON_A2UI_ICON_NAMES,
        description:
          'The icon name (one of the supported names). May also bind to the data model with { path }. Custom vector art via { svgPath } is accepted but discouraged.'
      }
    })
  },

  Image: {
    category: 'Media',
    description:
      'Displays an image from a URL. Images are blocked by default unless the host allows the source — provide a meaningful `description` so a blocked image still conveys meaning.',
    props: withCommon({
      url: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The image URL. Subject to the host URL policy (blocked by default).'
      },
      description: {
        kind: 'string',
        dynamic: true,
        description:
          'Alt text describing the image for accessibility and when the image is blocked.'
      },
      fit: {
        kind: 'enum',
        values: ['contain', 'cover', 'fill', 'none', 'scaleDown'],
        default: 'cover',
        description: 'How the image resizes to fit its box (CSS object-fit).'
      },
      variant: {
        kind: 'enum',
        values: ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'],
        default: 'mediumFeature',
        description: 'Size/style preset for the image.'
      }
    })
  }
});

/**
 * Heuristic for "this looks like Markdown" — bold, inline code, a link, or an
 * ATX heading. Conservative (a stray `*` won't trip it) so the MARKDOWN_IN_TEXT
 * warning stays a helpful nudge toward RichText, not noise.
 */
const MARKDOWN_HINT_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|^#{1,6}\s)/m;

/**
 * The Urbicon catalog, spec half (Svelte-free — a server building the prompt can
 * import this). The Svelte wiring (`Node`, `createIcons`) is added in
 * `a2ui-urbicon-catalog.ts`. `flexContainers` and the layered check semantics
 * mirror the Basic catalog; the sole catalog-specific check nudges the agent
 * from plain `Text` toward `RichText` when it emits Markdown.
 */
export const urbiconA2uiCatalogSpec: A2uiCatalogSpec = {
  catalogId: URBICON_A2UI_CATALOG_ID,
  registry: URBICON_A2UI_REGISTRY,
  iconNames: URBICON_A2UI_ICON_NAMES,
  unsupportedComponents: UNSUPPORTED_URBICON_A2UI_COMPONENTS,
  ignoredProps: URBICON_A2UI_IGNORED_PROPS,
  flexContainers: new Set(['Row', 'Column']),
  componentChecks: {
    Text: ({ id, props, surfaceId, base }) => {
      const value = props.get('text');
      if (typeof value === 'string' && MARKDOWN_HINT_RE.test(value)) {
        return [
          {
            severity: 'warning',
            code: A2UI_ISSUE_CODES.MARKDOWN_IN_TEXT,
            message: `Text "${id}" contains Markdown syntax, but Text renders PLAIN — use RichText for formatting`,
            surfaceId,
            path: base
          }
        ];
      }
      return [];
    }
  }
};

/** The axis truth this registry couples to — re-exported for the drift test. */
export { URBICON_AXES } from './urbicon-axes.gen';
