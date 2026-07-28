# Design Principles

Fixture principles for CLI tests.

## Visual Hierarchy

Size and weight before colour.

## Theming

Token hierarchy: foundation → semantic → interaction.

## Accessibility

Focus-visible everywhere.

## Component Selection

| Need | Component | Why |
|---|---|---|
| 7+ options or needs search | `Combobox` | Searchable, filterable |
| Boolean on/off setting | `Toggle` | Immediate visual feedback |

## Layout

Content max-width 720px. See the `settings-page` pattern for the scale-based choice —
the real section names a pattern too, so this fixture does as well: the primer may
*point* at a pattern, it must only never carry its body.

### Layout markup

Layout is markup, not a component. Every wrapper earns its place.
