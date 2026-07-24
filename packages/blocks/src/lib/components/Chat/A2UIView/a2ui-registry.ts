/**
 * The A2UI catalog subset this engine renders — the single source of truth for
 * BOTH validation (`a2ui-validate.ts`) and the agent-facing system prompt
 * (`a2ui-prompt.ts`). No Svelte imports: this module must be importable
 * standalone (a server building the system prompt has no DOM).
 *
 * The subset covers the v0.9.1 `basic` components except the deliberately
 * excluded ones (Modal, Tabs, Video, AudioPlayer), which validate to a visible
 * error chip; see `UNSUPPORTED_A2UI_COMPONENTS`.
 *
 * Prop names, kinds, `required`, defaults and enum sets mirror
 * `catalogs/basic/catalog.json` **case-sensitively**. Every `description` here
 * is written to be read by an agent — it is emitted verbatim into the prompt.
 */

/** How a prop value is shaped and validated. */
export type A2uiPropKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'stringList'
  | 'enum'
  | 'childId'
  | 'childList'
  | 'labeledChildren'
  | 'action'
  | 'options'
  | 'icon'
  | 'accessibility';

export interface A2uiPropSpec {
  kind: A2uiPropKind;
  /** Required on the component. @default false */
  required?: boolean;
  /** Accepts the Dynamic union (literal | `{ path }` | function call). @default false */
  dynamic?: boolean;
  /** Allowed values for `enum`/`icon` kinds. */
  values?: readonly string[];
  /** Documented default (rendered in the prompt). */
  default?: string | number | boolean;
  /** Agent-facing description; emitted into the system prompt verbatim. */
  description: string;
  /**
   * Accepted for spec-compatibility but omitted from the prompt and rendered
   * with a degraded fallback (e.g. ChoicePicker `displayStyle`/`filterable`).
   */
  promptHidden?: boolean;
}

export interface A2uiComponentSpec {
  /** Agent-facing description; emitted into the system prompt verbatim. */
  description: string;
  props: Record<string, A2uiPropSpec>;
}

/** Opaque catalog identifier this subset advertises in `createSurface`. */
export const A2UI_CATALOG_ID = 'urbicon-ui/a2ui-basic-subset/v0.9.1';

/** Envelope `version` strings this engine accepts. */
export const A2UI_SUPPORTED_VERSIONS: readonly string[] = ['v0.9', 'v0.9.1'];

/**
 * Real v0.9.1 `basic` components the engine deliberately does not render.
 * Distinguished from wholly-unknown component names so the error message can
 * say "not part of the rendered subset" rather than "unknown".
 */
export const UNSUPPORTED_A2UI_COMPONENTS: ReadonlySet<string> = new Set([
  'Modal',
  'Tabs',
  'Video',
  'AudioPlayer'
]);

/**
 * Mapped `Icon.name` values. A name outside this set degrades to a fallback
 * glyph (a warning, not an error). Kept in sync with the direct icon imports in
 * `A2UINode.svelte` (WP-B).
 */
export const A2UI_ICON_NAMES: readonly string[] = [
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
  'warning'
];

/**
 * Grammar guard for inline `Icon.name.svgPath`. Only SVG path commands, digits,
 * whitespace and separators — no `<`, no attributes, no entities. WP-B MUST
 * re-apply this guard before inlining a `<path d>` (defense in depth).
 */
export const A2UI_SVG_PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.+\-eE]+$/;

/**
 * Props every component accepts (spread into each entry). `accessibility` maps
 * to ARIA; `weight` is flex-grow, honored only on a direct Row/Column child.
 */
const COMMON_PROPS: Record<string, A2uiPropSpec> = {
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

function withCommon(props: Record<string, A2uiPropSpec>): Record<string, A2uiPropSpec> {
  return { ...props, ...COMMON_PROPS };
}

export const A2UI_REGISTRY: Readonly<Record<string, A2uiComponentSpec>> = Object.freeze({
  Column: {
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
        default: 'stretch',
        description: 'Alignment along the cross (vertical) axis, like CSS align-items.'
      }
    })
  },

  List: {
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
      },
      align: {
        kind: 'enum',
        values: ['start', 'center', 'end', 'stretch'],
        default: 'stretch',
        description: 'Alignment of items along the cross axis.'
      }
    })
  },

  Card: {
    description:
      'A visually grouped container with exactly one child. To place several elements in a Card, wrap them in a Column or Row and pass that container ID as the child.',
    props: withCommon({
      child: {
        kind: 'childId',
        required: true,
        description:
          'The ID of the single child component to render inside the card. Pass a layout container ID for multiple elements. Never inline the child.'
      }
    })
  },

  Divider: {
    description: 'A thin rule that visually separates content.',
    props: withCommon({
      axis: {
        kind: 'enum',
        values: ['horizontal', 'vertical'],
        default: 'horizontal',
        description: 'Orientation of the divider.'
      }
    })
  },

  Text: {
    description:
      'Displays text. `text` supports simple inline Markdown (bold, italic, code) — no HTML, images or links. Prefer dedicated components over Markdown for structured content.',
    props: withCommon({
      text: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The text to display. Bind to the data model with { path } for live values.'
      },
      variant: {
        kind: 'enum',
        values: ['h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body'],
        default: 'body',
        description:
          'Text style hint. h1–h5 are headings; caption is small secondary text; body is default.'
      }
    })
  },

  Image: {
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
        default: 'fill',
        description: 'How the image resizes to fit its box (CSS object-fit).'
      },
      variant: {
        kind: 'enum',
        values: ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'],
        default: 'mediumFeature',
        description: 'Size/style preset for the image.'
      }
    })
  },

  Icon: {
    description:
      'Displays a named icon from the mapped set. Use `name` with one of the supported names; unknown names fall back to a generic glyph.',
    props: withCommon({
      name: {
        kind: 'icon',
        required: true,
        values: A2UI_ICON_NAMES,
        description:
          'The icon name (one of the supported names). May also bind to the data model with { path }. Custom vector art via { svgPath } is accepted but discouraged.'
      }
    })
  },

  Button: {
    description:
      'A clickable button. Its `child` is the label (use a Text component). `action` MUST be a server event. Both `child` and `action` are required.',
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
      variant: {
        kind: 'enum',
        values: ['default', 'primary', 'borderless'],
        default: 'default',
        description:
          'Button style. primary marks the main call to action; borderless renders as a link-like button.'
      }
    })
  },

  TextField: {
    description:
      'A single- or multi-line text input. `label` is required. Bind `value` to a data-model path for two-way binding (typing writes to the model immediately).',
    props: withCommon({
      label: {
        kind: 'string',
        required: true,
        dynamic: true,
        description: 'The field label.'
      },
      value: {
        kind: 'string',
        dynamic: true,
        description: 'The field value. Bind with { path } for two-way binding.'
      },
      variant: {
        kind: 'enum',
        values: ['shortText', 'longText', 'number', 'obscured'],
        default: 'shortText',
        description:
          'Input type: shortText (one line), longText (multi-line), number (numeric), obscured (password).'
      }
    })
  },

  CheckBox: {
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

  ChoicePicker: {
    description:
      'Select one or more options from a list. Bind `value` to a data-model string array. Use variant mutuallyExclusive for single-select, multipleSelection for multi-select.',
    props: withCommon({
      options: {
        kind: 'options',
        required: true,
        dynamic: true,
        description:
          'The available options as an array of { label, value } objects; `value` is a stable string. Bind it when the options come from data you fetched.'
      },
      value: {
        kind: 'stringList',
        required: true,
        dynamic: true,
        description:
          'The selected values as a string array in the data model. Single-select writes a one-element array.'
      },
      label: {
        kind: 'string',
        dynamic: true,
        description: 'An optional label for the whole group.'
      },
      variant: {
        kind: 'enum',
        values: ['mutuallyExclusive', 'multipleSelection'],
        default: 'mutuallyExclusive',
        description:
          'mutuallyExclusive is single-select (radios); multipleSelection allows several.'
      },
      displayStyle: {
        kind: 'enum',
        values: ['checkbox', 'chips'],
        default: 'checkbox',
        promptHidden: true,
        description: 'Display hint. chips is rendered with a checkbox/radio fallback.'
      },
      filterable: {
        kind: 'boolean',
        promptHidden: true,
        description: 'If true, requests a filter input; rendered without one (fallback).'
      }
    })
  },

  Slider: {
    description:
      'A numeric slider. `value` and `max` are required (`min` defaults to 0). Bind `value` for two-way binding.',
    props: withCommon({
      value: {
        kind: 'number',
        required: true,
        dynamic: true,
        description: 'The current value. Bind with { path } for two-way binding.'
      },
      max: {
        kind: 'number',
        required: true,
        description: 'The maximum value.'
      },
      min: {
        kind: 'number',
        default: 0,
        description: 'The minimum value (default 0).'
      },
      label: {
        kind: 'string',
        dynamic: true,
        description: 'An optional label for the slider.'
      }
    })
  },

  DateTimeInput: {
    description:
      'A date and/or time input. `value` is an ISO 8601 STRING ("" when unset) — date ' +
      '(YYYY-MM-DD), time (HH:MM), or both (YYYY-MM-DDTHH:MM). ALWAYS set enableDate and/or ' +
      'enableTime explicitly (both default to false). Bind `value` to a data-model path for ' +
      'two-way binding and initialize that path with "".',
    props: withCommon({
      value: {
        kind: 'string',
        required: true,
        dynamic: true,
        description:
          'The ISO 8601 date/time string ("" when unset). Bind with { path } for two-way binding.'
      },
      enableDate: {
        kind: 'boolean',
        default: false,
        description: 'Allow picking a calendar date (the YYYY-MM-DD part).'
      },
      enableTime: {
        kind: 'boolean',
        default: false,
        description: 'Allow picking a time of day (the HH:MM part).'
      },
      label: {
        kind: 'string',
        dynamic: true,
        description: 'The field label.'
      },
      min: {
        kind: 'string',
        dynamic: true,
        description:
          'Minimum allowed value, ISO 8601. The DATE part is enforced; a TIME bound is ' +
          'enforced only when the bound is time-only (the time part of a date-time bound ' +
          'is not enforced).'
      },
      max: {
        kind: 'string',
        dynamic: true,
        description:
          'Maximum allowed value, ISO 8601. The DATE part is enforced; a TIME bound is ' +
          'enforced only when the bound is time-only (the time part of a date-time bound ' +
          'is not enforced).'
      }
    })
  }
});

/** Props recognized anywhere but intentionally ignored (validation only, dropped before render). */
export const A2UI_IGNORED_PROPS: ReadonlySet<string> = new Set(['checks', 'validationRegexp']);
