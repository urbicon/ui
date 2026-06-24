# Urbicon UI – Responsive & Mobile Guidelines

Standards for responsive and mobile behavior across all Urbicon UI components.

---

## Principles

1. **Mobile-first** – Base styles target the smallest viewport; larger breakpoints enhance progressively.
2. **CSS over JS** – Prefer CSS breakpoints and container queries over JavaScript viewport detection.
3. **Touch-ready by default** – Interactive elements meet minimum touch target sizes without opt-in.
4. **Semantic tokens** – Responsive behavior uses the same token-based approach as colors, shadows, and z-index.

---

## Breakpoint System

### Standard Breakpoints (Tailwind 4 defaults)

| Token | Width | Prefix | Typical use |
|-------|-------|--------|-------------|
| Mobile | 0–639px | (base) | Single column, stacked layouts |
| Tablet | 640px | `sm:` | Side-by-side elements, expanded controls |
| Desktop | 768px | `md:` | Multi-column layouts, full toolbars |
| Wide | 1024px | `lg:` | Sidebars, expanded navigation |
| Ultra | 1280px | `xl:` | Maximum content width, dashboard grids |

### Container Queries

Tokens defined in `foundation.css`:

```css
--blocks-container-sm: 480px;
--blocks-container-md: 640px;
--blocks-container-lg: 768px;
```

**When to use which:**
- **Viewport breakpoints** (`sm:`, `md:`): Page-level layout, sidebar visibility, navigation
- **Container queries**: Embedded components (SmartFilterBar, Toolbar, Card grids) in varying-width containers

---

## Touch Targets

### Minimum Sizes

| Level | Minimum | Application |
|-------|---------|-------------|
| **Required** (WCAG 2.5.8 AA) | 24×24px | All interactive elements |
| **Recommended** (WCAG 2.5.5 AAA) | 44×44px | Primary actions on touch devices |

### Touch-Specific Tokens (`interaction.css`)

```css
@media (pointer: coarse) {
  --blocks-touch-target-min: 2.75rem;  /* 44px */
  --blocks-touch-spacing: 0.5rem;      /* 8px */
}
```

### Per-Component Rules

| Component | Strategy |
|-----------|----------|
| **Checkbox, Toggle** | `control` wrapper has `min-h-11` (44px) |
| **Select / Combobox / Menu items** | Per-size token: `sm` 2rem · `md` 2.5rem · `lg` 3rem. Touch-target ≥ 44 px is guaranteed by the parent `control` wrappers (button/input) on coarse pointers, not by individual list rows — list density is optimised for desktop scanning. |
| **Focusable text inputs (Input, Combobox, Textarea, CommandPalette)** | Font-size floored to **≥16px on coarse pointers** via `pointer-coarse:text-base` on the sub-16px `xs`/`sm` variants. Below 16px iOS Safari auto-zooms the field on focus and never restores the zoom (page stays scrolled sideways). Fine pointers keep the designed 12/14px. **Any new focusable text input must carry this floor** — never use `maximum-scale`/`user-scalable=no` on the viewport, which breaks accessibility. |
| **Breadcrumb links** | `min-h-11` via touch padding |
| **Button** | `md` (40px) acceptable for desktop; avoid `2xs`/`xs` as sole touch targets |

---

## Overlay Patterns

### Bottom Sheet (Dialog)

On mobile (base), modals and dialogs render as bottom sheets:

```
Base (mobile):  Full-width, items-end, rounded-t-xl, max-h-[85dvh]
sm+ (tablet):   Centered, max-w from size prop, rounded-xl
```

Size constraints (`sm:max-w-sm`, `sm:max-w-md`, etc.) apply from `sm:` upward.

### Floating UI Integration

- **Combobox**: Uses `computePosition` with `flip()`, `shift()`, `offset()`, `size()` to prevent viewport overflow.
- **Popover**: `overflow-y-auto` + `max-h-[calc(100dvh-4rem)]` for long content.
- **Menu / Tooltip**: Already positioned via Popover's Floating UI.

### Virtual Keyboard

`detectOverflow()` in `floating.ts` uses `window.visualViewport` for correct overflow detection when the virtual keyboard is open. Dialog uses `dvh` units.

---

## Layout Patterns

| Pattern | Use for | Implementation |
|---------|---------|----------------|
| **Horizontal scroll** | Tab lists, Toolbar | `overflow-x-auto` with hidden scrollbar |
| **Wrap** | Button groups, filter chips | `flex-wrap gap-2` |
| **Stack** | Side-by-side → vertical | `flex-col sm:flex-row` |
| **Truncate** | Long text in constrained space | `truncate max-w-48` + Tooltip |

---

## Content Prioritization

### Table Column Priority (`TABLE_RESPONSIVE`)

| Priority | Visibility | Use for |
|----------|-----------|---------|
| 1 | Always visible | Primary identifier (name, title) |
| 2 | `hidden sm:table-cell` | Key info (status, date) |
| 3 | `hidden md:table-cell` | Secondary info (category, assignee) |
| 4 | `hidden lg:table-cell` | Detail info (created date, tags) |
| 5 | `hidden xl:table-cell` | Auxiliary info (internal IDs, metadata) |

`TableCell` and `TableHead` use `TABLE_RESPONSIVE.priority` lookup for all five levels.

---

## New Component Checklist

Every new component must address before merge:

- [ ] **Touch targets**: Interactive sizes meet 24×24px minimum; 44×44px recommended
- [ ] **Overflow**: Handles content exceeding container (truncate, scroll, wrap, or collapse)
- [ ] **Stacking**: Horizontal layouts verify mobile stacking behavior
- [ ] **Viewport clipping**: Overlays use flip/shift or viewport-relative max-height
- [ ] **Focus management**: Focus trap works on mobile; focus returns after keyboard dismissal
- [ ] **Content reduction**: Consider what to hide or condense on narrow viewports
- [ ] **`min-w-0`**: Flex children with text have `min-w-0` for proper shrinking

---

## Performance

### Transitions

All variant files use specific CSS transition properties instead of `transition-all`:

```typescript
'transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)]'
```

Exceptions: Tab indicator and Toast progress bar use `transition-all` (animate position/size).

### Resize Handling

- Prefer CSS over JavaScript for responsive behavior
- Use `ResizeObserver` over `window.resize` for element-level sizing
- Clean up observers in `$effect` return functions
- Desktop/Mobile table visibility is CSS-based (no JS viewport checks)
