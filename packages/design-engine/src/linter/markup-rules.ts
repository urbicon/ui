/**
 * The AST-pass rules (DESIGN-MCP-V2 §6/§10, Funde F-G/F-J): correctness checks that
 * need to know *which attribute belongs to which element* — what the line-based
 * regex rules in `rules.ts` structurally cannot see. They run on the flat element
 * list from {@link scanMarkup}, scanned once per lint and shared via a tiny cache.
 *
 * All are scoped to Urbicon UI's own components (a curated name set) so they never
 * fire on a third-party `<Button>` from another library — the correctness gate
 * must stay false-positive free.
 */

import { type Element, innerContent, scanMarkup } from './markup.js';
import type { Finding, Rule } from './types.js';

/**
 * Urbicon UI's component names, for scoping the AST rules. A name missing here only
 * means a missed lint (never a false positive), so lagging a new component is safe;
 * keep it roughly in sync with the catalog. Not the catalog itself (props/docs) —
 * just the names, the same kind of design-system lint-data as the token sets.
 */
export const URBICON_COMPONENTS: ReadonlySet<string> = new Set([
  // primitives
  'Accordion',
  'Alert',
  'Avatar',
  'Badge',
  'Breadcrumb',
  'Button',
  'ButtonGroup',
  'Card',
  'Checkbox',
  'Collapsible',
  'Combobox',
  'ConfirmDialog',
  'Dialog',
  'Drawer',
  'FormField',
  'Input',
  'Menu',
  'Pagination',
  'Popover',
  'Progress',
  'RadioGroup',
  'SegmentGroup',
  'Select',
  'Separator',
  'Sidebar',
  'Skeleton',
  'Slider',
  'Spinner',
  'Stepper',
  'Tab',
  'Textarea',
  'Toast',
  'Toggle',
  'Toolbar',
  'Tooltip',
  // components
  'AreaChart',
  'BarChart',
  'Calendar',
  'ChartFrame',
  'CommandPalette',
  'CompositionBar',
  'CurrencyInput',
  'DatePicker',
  'DonutChart',
  'EmptyState',
  'FileUpload',
  'LineChart',
  'LocaleSwitcher',
  'Sankey',
  'SidebarLayout',
  'Sparkline',
  'ThemeSwitcher',
  'Table'
]);

/**
 * Prop names from other component libraries (Chakra/MUI/shadcn muscle memory) that
 * Urbicon UI does not have, mapped to the real prop. Every key is verified absent
 * from every `*Props` interface in the repo, and every value is a real prop — so
 * the fix hint is always correct. (`color`/`leftIcon`/`rightIcon` are deliberately
 * absent: they ARE real props on some components, so flagging them would misfire.)
 */
const PROP_NAME_CONFUSIONS: Readonly<Record<string, string>> = {
  tone: 'intent',
  colour: 'intent',
  colorScheme: 'intent',
  isLoading: 'loading',
  isDisabled: 'disabled'
};

/**
 * String-literal value confusions, per prop. Only values that are valid in NO
 * Urbicon component go here — variant vocabularies are per-component (`solid` is a
 * real Tab variant, `default` a real one elsewhere), so a global value map is only
 * safe for values that exist nowhere. `outline` (the shadcn spelling of `outlined`)
 * is the one that qualifies. Fuller per-component value validation needs the
 * catalog and is deferred with the find/init step (F-J, see DESIGN-MCP-V2 §10).
 */
const VALUE_CONFUSIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  variant: { outline: 'outlined' }
};

/** Single-entry scan cache: lintDesign runs the rules sequentially on one source. */
let cache: { raw: string; els: Element[] } | null = null;
function scanCached(raw: string): Element[] {
  if (cache?.raw !== raw) cache = { raw, els: scanMarkup(raw) };
  return cache.els;
}

const apiHallucination: Rule = {
  id: 'api-hallucination',
  severity: 'warning',
  description:
    'Component prop/value from another UI library (e.g. `tone=`, `variant="outline"`) that Urbicon UI does not have.',
  check(_lines, raw) {
    const findings: Finding[] = [];
    for (const el of scanCached(raw)) {
      if (!el.isComponent || !URBICON_COMPONENTS.has(el.tag)) continue;
      for (const attr of el.attrs) {
        const rightName = PROP_NAME_CONFUSIONS[attr.name];
        if (rightName) {
          findings.push({
            ruleId: this.id,
            severity: this.severity,
            kind: 'deterministic',
            message: `\`${el.tag}\` has no \`${attr.name}\` prop — that is another library's name.`,
            fix: `Use \`${rightName}\` instead.`,
            line: attr.line,
            match: attr.name
          });
          continue;
        }
        if (attr.kind === 'string' && attr.value !== null) {
          const right = VALUE_CONFUSIONS[attr.name]?.[attr.value];
          if (right) {
            findings.push({
              ruleId: this.id,
              severity: this.severity,
              kind: 'deterministic',
              message: `\`${attr.name}="${attr.value}"\` is not an Urbicon UI value.`,
              fix: `Use \`${attr.name}="${right}"\`.`,
              line: attr.line,
              match: `${attr.name}="${attr.value}"`
            });
          }
        }
      }
    }
    return findings;
  }
};

/** Attributes that give an interactive control its accessible name. */
const LABEL_ATTRS: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby', 'title']);
/** Controls that are commonly rendered icon-only and then forgotten a label. */
const ICON_CONTROL_TAGS: ReadonlySet<string> = new Set(['Button', 'button']);

/** Any non-whitespace text once child tags are stripped (catches visible + sr-only labels). */
function hasTextLabel(inner: string): boolean {
  return inner.replace(/<[^>]*>/g, '').trim().length > 0;
}
/** An icon child — an `<svg>`, an `<Icon>`, or any `<…Icon>` component. */
function hasIconChild(inner: string): boolean {
  return /<svg\b/i.test(inner) || /<[A-Za-z][\w.]*Icon\b/.test(inner) || /<Icon\b/.test(inner);
}

/**
 * F-G: an icon-only Button/button with no accessible name — a screen reader
 * announces nothing. Conservative: skips when a spread might carry the label, when
 * content holds a `{…}` expression (a dynamic label), when any text (visible or
 * sr-only) is present, and only fires when an actual icon child is the sole
 * content. Errs toward silence so a labelled control is never flagged.
 */
const iconButtonNoLabel: Rule = {
  id: 'icon-button-no-label',
  severity: 'warning',
  description: 'Icon-only Button/button with no accessible name (aria-label / title / text).',
  check(_lines, raw) {
    const findings: Finding[] = [];
    for (const el of scanCached(raw)) {
      if (!ICON_CONTROL_TAGS.has(el.tag)) continue;
      if (el.attrs.some((a) => a.kind === 'spread')) continue; // {...rest} may carry aria-label
      const labelled = el.attrs.some(
        (a) => LABEL_ATTRS.has(a.name) && a.value !== null && a.value.trim() !== ''
      );
      if (labelled) continue;
      const inner = innerContent(raw, el);
      if (inner === null) continue; // self-closing / unbalanced — content unknown, skip
      if (inner.includes('{')) continue; // a dynamic child like {label} might be the name
      if (hasTextLabel(inner)) continue; // visible or visually-hidden text present
      if (!hasIconChild(inner)) continue; // only genuine icon-only controls
      findings.push({
        ruleId: this.id,
        severity: this.severity,
        kind: 'deterministic',
        message: `Icon-only \`<${el.tag}>\` has no accessible name — a screen reader announces nothing.`,
        fix: 'Add an `aria-label="…"` (or visually-hidden text) naming the action.',
        line: el.line
      });
    }
    return findings;
  }
};

/** The AST-pass rules, appended to the linter's RULES registry. */
export const MARKUP_RULES: Rule[] = [apiHallucination, iconButtonNoLabel];
