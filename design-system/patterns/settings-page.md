# Settings Page

Multi-section user preferences with sidebar navigation and grouped content areas.

## Layout

- **Structure:** `SidebarLayout` with sidebar navigation + scrollable content area
- **Sidebar:** 240-280px width, grouped navigation links via `Sidebar` with `Accordion` for groups
- **Content:** max-width 720px, vertically stacked sections
- **Responsive:** below 768px, sidebar collapses; use a `Select` or horizontal scrollable navigation to switch sections
- **Spacing:** `gap-8` between sections, `gap-4` within sections

## Component Selection

| UI Need | Component | Configuration |
|---|---|---|
| Section navigation | `Sidebar` + `Accordion` | Grouped links, highlight active section |
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

- Do not use `Tab` for settings groups. Tabs imply peer sections at the same hierarchy; settings are hierarchical.
- Do not put all settings in a single scrollable list without navigation.
- Do not use modals for inline editing. Edit in place, save with the section's save action.
- Do not auto-save without explicit user signal. Settings changes should be intentional.

## Related

- Recipe: `settings` — complete production-ready code example
- Pattern: `form-page` — for standalone forms within settings sections
