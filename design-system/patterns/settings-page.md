# Settings Page

Multi-section user preferences. Pick the navigation by scale and edit model — this
pattern covers both the small (tabbed) and the large (sidebar) shape.

## Choosing the navigation

| Settings shape | Navigation | Why |
|---|---|---|
| **Small & flat** — up to ~5 co-equal groups, one Save for the whole page, no nested subsections | `Tab` (client-side, `bind:value`) | The groups are peer sections at one hierarchy level; a full sidebar shell is heavier than the content warrants. The `settings` recipe is this case. |
| **Large, hierarchical, or per-section save** — many sections, nested groups, or each section commits independently | `Sidebar` (+ `Accordion` for groups) | Scales vertically past what a tab bar can hold, expresses nesting, gives each section its own URL, and fits the free-switch model that per-section save/cancel needs. |

Rule of thumb: reach for `Sidebar` the moment a section owns its Save/Cancel, the
list will keep growing, or groups nest. Otherwise `Tab` is the lighter, correct
choice — don't force a sidebar onto three flat panels.

## Layout — large / hierarchical

- **Structure:** `SidebarLayout` with sidebar navigation + scrollable content area
- **Sidebar:** 240-280px width, grouped navigation links via `Sidebar` with `Accordion` for groups
- **Content:** max-width 720px, vertically stacked sections
- **Responsive:** below 768px, sidebar collapses; use a `Select` or horizontal scrollable navigation to switch sections
- **Spacing:** `gap-8` between sections, `gap-4` within sections

## Layout — small / flat

- **Structure:** a single `Tab` (`bind:value`) below the page header, one panel per section, a single Save/Cancel for the page
- **Content:** same max-width 720px, vertically stacked fields within each panel
- **Reference:** the `settings` recipe (Profile / Notifications / Security)

## Component Selection

| UI Need | Component | Configuration |
|---|---|---|
| Section navigation (small / flat) | `Tab` | Client-side `bind:value`, one panel per section |
| Section navigation (large / hierarchical) | `Sidebar` + `Accordion` | Grouped links, highlight active section |
| Section container | `Card` | `variant="outlined"` |
| Section heading | Native `h2` | `text-text-primary font-semibold text-lg` |
| Subsection heading | Native `h3` | `text-text-secondary font-medium text-base` |
| Boolean setting | `Toggle` | With label, not `Checkbox` |
| Enum setting (3-6) | `Select` | Labeled via `FormField` |
| Enum setting (7+) | `Combobox` | Searchable, labeled via `FormField` |
| Free text | `Input` or `Textarea` | Labeled via `FormField` |
| Save/cancel | `Button` pair | Sticky bottom bar when form exceeds viewport |
| Destructive action | `Button intent="danger"` | Separated at bottom, requires `ConfirmDialog` |
| Status feedback | `Toast` | On save success/failure |

## Behavioral Rules

- Group related settings in Cards. One Card per conceptual group (Account, Notifications, Privacy).
- Save button shows loading state (spinner) during save.
- Warn on unsaved changes: intercept navigation, show `ConfirmDialog`.
- Reset/Cancel returns to last saved state, not initial page load state.
- Destructive settings (delete account, revoke access) separated at the bottom of the page, visually distinct from other settings.
- Default values: show the active value, not "unchanged". Users should see what is currently configured.

## Anti-Patterns

- Do not force a `Sidebar` shell onto a small, flat, single-save settings page — a client-side `Tab` is lighter and appropriate. Conversely, do not keep `Tab` once sections nest, grow past ~5, or each gains its own Save/Cancel — switch to `Sidebar`.
- Do not put all settings in a single scrollable list without navigation.
- Do not use modals for inline editing. Edit in place, save with the section's save action.
- Do not auto-save without explicit user signal. Settings changes should be intentional.

## Related

- Recipe: `settings` — the small, flat, tabbed example.
- Pattern: `tab-navigation` — route-addressable peer sections (each tab is a URL).
- Pattern: `form-page` — for standalone forms within settings sections.
