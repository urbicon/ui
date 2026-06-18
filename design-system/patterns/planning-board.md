# Planning Board

Date-indexed board that lays domain items — meals, shifts, bookings, content slots — onto calendar days across a week, month or custom range.

## Layout

- **Structure:** `Planner` is the whole board. It buckets `items` by day and renders each cell via your `cell` snippet — no manual date math, no per-day grid.
- **View:** `view="week"` for a column-per-day plan (the default), `view="month"` for a compact 6×7 overview, `view="range"` for an arbitrary span. Week stacks to one column per day on mobile automatically.
- **Cells:** put a small stack of cards or rows inside `cell`. Keep each item to one or two lines (icon + label); the cell is narrow.
- **Spacing:** week cells get `gap-1`–`gap-2` between items; month cells stay terse — show counts or 1–2 items, not the full list.
- **Server alignment:** load the week on the server with `@urbicon-ui/blocks/date` (`startOfWeek` / `toIso`) so the SSR range and the client grid agree — no UTC drift.

## Component Selection

| UI Need | Component | Configuration |
|---|---|---|
| The board itself | `Planner` | `view`, `items`, `getDate`; `sort` for intra-day order |
| Per-day content | `cell` snippet | Receives typed `items: T[]`, `isoDate`, `isToday`, `selectDate()` |
| An item card | `Card` or a plain `div` | One per item, kept to a line or two |
| Item category / status | `Badge` | `intent` per category (`success`/`warning`/`primary`…) |
| Add-on-a-day affordance | `Button variant="ghost" size="sm"` | Inside `cell` — rendered for empty days too |
| Empty-day placeholder | `empty` snippet | Optional; omit it to let `cell` handle empty days |
| Custom toolbar | `header` snippet | Replaces prev/next/today/title |
| Timed appointments instead | `Calendar` | Use Calendar, not Planner, when items have a clock time |

## Behavioral Rules

- `getDate` returns a `Date` or a local ISO date string (`'2026-06-16'`); strings are taken verbatim, so a day never shifts across timezones. Pass a `Date` for UTC instants.
- The `cell` snippet runs for **every** day, empty ones included — keep the "add" button there so it is reachable on blank days.
- Drive data loading from `onNavigate(date, range)`: fetch `range.start … range.end`, not the whole month.
- `bind:value` is the reference date; `bind:selectedDate` is the active day. Clicking a cell's body selects its day; clicks on interactive cell content keep their own behaviour.
- Sort within a day via `sort` (e.g. breakfast → lunch → dinner), not by reordering `items`.

## Anti-Patterns

- Do not reach for `Calendar` for uhrzeit-lose day content — its model is timed `CalendarEvent`s with bars and recurrence. Planner is single-date bucketing of your own type.
- Do not rebuild the week/month grid by hand with `getWeekDates` + a `{#each}`. That is exactly what Planner removes.
- Do not stuff a full item list into a month cell. Summarise (count or top item) and switch to `view="week"` for detail.
- Do not parse a plain date string through `new Date()` before handing it to `getDate` — you reintroduce the UTC off-by-one Planner avoids.
- Do not gate the add affordance behind "has items". Empty days are where you add most.

## Related

- Component: `Planner` — the board; see also `Calendar` for timed events
- Recipe: `meal-planner` — complete production-ready weekly plan
- Pattern: `dashboard` — when the board is one panel among analytics
