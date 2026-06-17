# Dashboard

Data-rich overview page with metrics, charts, and action shortcuts.

## Layout

- **Structure:** full-width content area, optionally within `SidebarLayout` for app navigation
- **Grid:** CSS grid with responsive columns. Desktop: 3-4 columns for stat tiles, 2 columns for charts/tables. Mobile: single column stack.
- **Content:** no max-width constraint (data-dense view). Cards fill available space.
- **Spacing:** `gap-4` between grid items, `gap-6` between sections (stats row, charts row, table row)

## Component Selection

| UI Need | Component | Configuration |
|---|---|---|
| Stat/KPI tile | `Card` | Compact padding, prominent number + label + trend indicator |
| Trend direction | `Badge` | `intent="success"` for up, `intent="danger"` for down |
| Proportional data | `CompositionBar` | Horizontal bar with legend |
| Flow visualization | `Sankey` | Multi-level relationship flows |
| Data table | `Table` | With sorting, filtering; limit visible rows (5-10), link to full view |
| Quick actions | `ButtonGroup` or `Toolbar` | Top-right of page or section |
| Date range filter | `DatePicker` or `Select` | Top of page, controls all widgets below |
| Empty widget | `EmptyState` | In Card, with action to configure/populate |
| Loading state | `Skeleton` | Match widget dimensions, not generic spinners |
| Notifications | `Alert` | Persistent, at page top, for system status |

## Section Ordering

1. **Page header:** title + date range filter + quick actions
2. **Stat tiles:** 3-4 KPI cards in a single row
3. **Charts / visualizations:** 2 cards side-by-side (e.g., CompositionBar + trend chart)
4. **Activity table:** recent activity or transactions, with link to full view
5. **Secondary widgets:** lower-priority info, may be collapsed or tabbed

## Behavioral Rules

- All widgets should show `Skeleton` during data loading, matching the widget's final dimensions.
- Date range filter at the top controls all widgets — changing the range refreshes everything.
- Stat tiles: show current value, trend (% change), and a subtle trend indicator (Badge with intent).
- Tables: show only 5-10 rows on the dashboard. Provide a "View all" link to the full table view.
- Auto-refresh: if data is live, use `Table` live-update capabilities (`pushInsert`, `pushUpdate`). Show a subtle timestamp ("Last updated: 2 min ago").
- Error states: per-widget errors, not a page-level error. Show `Alert` within the `Card` that failed.

## Anti-Patterns

- Do not use full-featured `Table` with all controls (grouping, column reorder, etc.) on the dashboard. Keep it compact.
- Do not mix different Card styles within the same section. Stat tiles should look uniform.
- Do not stack more than 3 vertical sections without scroll anchoring or navigation.
- Do not use `Dialog` for drill-down. Use `Drawer` or navigate to a detail page.
- Do not show raw numbers without context. Always pair a number with a label and, where applicable, a trend.

## Related

- Recipe: `dashboard` — complete production-ready code example
- Pattern: `settings-page` — for admin dashboards with settings navigation
