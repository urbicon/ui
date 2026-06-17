# Form Page

Standalone form for data entry — registration, creation, multi-step wizards.

## Layout

- **Structure:** centered content area with constrained width
- **Content:** max-width 560px for simple forms, 720px for complex forms with side context
- **Spacing:** `gap-6` between form groups, `gap-4` between fields within a group
- **Responsive:** single-column stack. On desktop, short related fields (first/last name, city/zip) can sit side-by-side in a 2-column grid.
- **Actions:** bottom of form, right-aligned. Primary action first (right), secondary (Cancel/Back) second (left).

## Component Selection

| UI Need | Component | Configuration |
|---|---|---|
| Text input | `Input` | Wrapped in `FormField` |
| Multi-line text | `Textarea` | Wrapped in `FormField`, with character count if limited |
| Email/password | `Input` | `type="email"` / `type="password"`, wrapped in `FormField` |
| Enum selection | `Select` or `RadioGroup` | Select for 4+, RadioGroup for 2-3 visible options |
| Searchable selection | `Combobox` | 7+ options, wrapped in `FormField` |
| Boolean consent | `Checkbox` | For agreements ("I accept the terms") |
| Boolean toggle | `Toggle` | For preference settings within a form |
| Date input | `DatePicker` | Wrapped in `FormField` |
| Currency | `CurrencyInput` | Locale-aware, wrapped in `FormField` |
| File | `FileUpload` | Drag-and-drop zone, clear accepted formats |
| Form group | `Card` or visual separator | Card for distinct sections, `Separator` for light division |
| Submit action | `Button intent="primary"` | Loading state during submission |
| Multi-step | `Stepper` | Shows progress, validates per step |
| Validation feedback | `FormField` error prop | Inline, under the field |
| Submit feedback | `Toast` | Success/error after submission |

## Validation Rules

- Validate on blur for individual fields (immediate feedback).
- Validate on submit for cross-field rules (password confirmation, date ranges).
- Show error text below the field via `FormField` error prop, not in a `Toast` or `Alert`.
- Required fields: mark optional fields with "(optional)" label suffix instead of marking required with asterisks.
- Disable submit button only while submission is in-flight (spinner), not while fields are invalid — let users click and see validation errors.

## Multi-Step Forms

- Use `Stepper` to show progress.
- Validate the current step before allowing navigation to the next.
- Allow backward navigation without losing data.
- Show a summary/review step before final submission for important forms.
- Keep step count visible (e.g., "Step 2 of 4"), not just a progress bar.

## Behavioral Rules

- Pre-fill known data (from user profile, previous entries, URL params).
- Persist draft state for long forms (localStorage or server-side draft).
- Show unsaved-changes warning on navigation away (`ConfirmDialog`).
- Group related fields together. Use `Card` with a heading for distinct sections (Personal Info, Payment, Shipping).
- Place help text in `FormField` description, not in `Tooltip`. Tooltips are hidden by default.

## Anti-Patterns

- Do not use `Dialog` for forms with more than 3 fields. Use a dedicated page or `Drawer`.
- Do not use horizontal multi-column layouts for unrelated fields. Side-by-side only for naturally paired fields (first + last name, city + zip).
- Do not put the submit button above the form. Actions go at the bottom, where the user ends.
- Do not use `placeholder` as the only label. Always use `FormField` with a visible label.
- Do not auto-submit on field change without explicit user instruction.

## Related

- Recipe: `login` — login/registration form example
- Recipe: `wizard` — multi-step form wizard example
- Pattern: `settings-page` — for forms embedded in settings sections
