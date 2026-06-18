# DateGrid-Core, Calendar-Re-Base & Planner — Umsetzungsplan

> **Status:** In Umsetzung (Branch `feat/dategrid-planner`). **Phase 0–3 erledigt**: Schicht 0 (`@urbicon-ui/blocks/date`) + Schicht 1 (headless `DateGridController`/`DateGridScaffold`, internal) + Calendar-Re-Base auf den Controller (Fassade-Ansatz, siehe Phase 3). Phase 4–7 offen.
> **Sprache:** Internes Strategie-/Umsetzungsdokument (Deutsch). Nach Abschluss in ein englisches As-built in `docs/ARCHITECTURE.md` überführen.
> **Rahmen:** Greenfield. Kein Consumer nutzt `Calendar` produktiv ([[project_pre_release_status]]). **Keine** Migrations-, Kompatibilitäts- oder Breaking-Change-Rücksichten — wir bauen die saubere Zielarchitektur direkt.

## 1. Motivation & Befund

Die Kochbuch-App (`cookery`) hat ihren Wochenplan **trotz** verfügbarem `Calendar` + MCP von Hand gebaut. Die Analyse ergab drei unabhängige, je legitime Ursachen:

1. **Architektur-Mismatch.** `Calendar`s Week-View ist fest auf einen Stunden-Time-Grid verdrahtet (`Calendar.svelte:148` — `if (view === 'week' || view === 'day') return true`). Sein Datenmodell ist `CalendarEvent[]` (getimte Instants, `categoryId`, `recurrence`). Ein Wochenplan hat **kategoriale, uhrzeitlose, custom-gerenderte** Zellinhalte. Der `dayCell`-Snippet wird nicht einmal an das Week-Grid durchgereicht (`Calendar.svelte:765` übergibt nur `eventItem`).
2. **Die wiederverwendbaren Teile sind eingesperrt.** `calendar.engine.ts` hat `getWeekDates`, `getWeekNumber` (ISO), `formatWeekTitle`, `getWeekdayNames` — exakt das, was cookery in `src/lib/date.ts` von Hand nachbaute. Aber sie sind nicht aus `@urbicon-ui/blocks` exportiert.
3. **Der MCP steuerte weg, nicht hin.** `find_components` liefert `Calendar` als „event display, date selection"; `suggest_implementation` emittiert ein inkohärentes Skelett (`<Calendar bind:value>`, `<Table>`, `CommandPalette`). Kein `get_pattern("planner")` existiert.

**Schlüsselfund für die Machbarkeit:** Die Engine ist intern bereits sauber geschichtet — eine **Datums-Geometrie-Schicht** (`getMonthGrid`, `getWeekDates`, `getWeekNumber`, `formatWeekTitle`, `getWeekdayNames` — pure `date → date`) und davon getrennt eine **Event-Layout-Schicht** (`getMultiDayEventLayout`, `positionEvents`, `expandRecurrence`). Auch der `CalendarContext` (`calendar.context.ts`) ist zu ~70 % reine Geometrie/Navigation/Selektion und nur ~30 % event-spezifisch. Der „Nordstern" ist damit **Extraktion + Re-Base**, kein Rewrite.

## 2. Zielarchitektur (Nordstern)

Vier Schichten. Geteilt wird die **unsichtbare Mechanik** (State, Geometrie, Navigation, a11y, Gerüst); getrennt bleibt das **sichtbare Domänen-Markup** (Event-Bars/Time-Grid vs. Consumer-Snippet).

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Schicht 0 — @urbicon-ui/blocks/date            [PUBLIC subpath, Svelte-frei] │
│  Pure date-Funktionen: ISO-Woche, Wochen-/Monatsraster, Range, Formatierung │
│  Server- UND client-tauglich (zero-dep, lokale Daten, kein UTC-Drift)       │
└──────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │ nutzt
┌──────────────────────────────────────────────────────────────────────────┐
│  Schicht 1 — lib/internal/date-grid/            [INTERNAL, headless]          │
│  • DateGridController  ($state-Klasse: referenceDate, view, focus, selection)│
│  • dateGridContext     (createOptionalContext)                               │
│  • Keyboard/roving-tabindex + swipe Attachments                             │
│  • DateGridScaffold.svelte (view-parametrisiertes cell-Gerüst: week|month|range)│
│  KEIN Event-, KEIN Item-Begriff. Nur Daten, Zellen, Navigation, Fokus.       │
└──────────────────────────────────────────────────────────────────────────┘
              ▲                                          ▲
              │ + Event-Layer                            │ + Item-Bucketing
┌─────────────────────────────────┐      ┌─────────────────────────────────────┐
│  Schicht 2a — Calendar  [PUBLIC] │      │  Schicht 2b — Planner  [PUBLIC, NEU] │
│  events/categories, multi-day,   │      │  generisches items: T[] + getDate,   │
│  time-grid, recurrence, drag.    │      │  view=week|month|range, cell-Snippet.│
│  = Termin-Scheduler.             │      │  = Datums-Raster mit deinem Inhalt.  │
└─────────────────────────────────┘      └─────────────────────────────────────┘
```

**Grenze bewusst gezogen:** `DateGridScaffold` deckt die **zell-basierten** Views ab (month-Grid 6×7, week-Spalten, range). Calendars **Time-Grid**- und **Agenda/Day**-Views bleiben Calendar-eigen (Stunden-Zeilen + absolute Event-Positionierung sind zu speziell; Planner braucht sie nicht). Die View-Render-Komponenten werden **nicht** geteilt — nur Controller/Context/Scaffold.

## 3. Festgelegte Design-Entscheidungen

Diese beantworten die beiden offenen Architekturfragen verbindlich.

### D1 — Planner-Snippets bekommen generisches `T`, nicht `CalendarEvent`

Die Primitive **bucketed Items pro Zelle** (das ist ihr Kernwert — cookery's `entriesForDay` + Sortierung), aber der Item-Typ ist ein generisches `T`, kein `CalendarEvent`. Gründe:

- **Richtiger Primärschlüssel.** `CalendarEvent` verlangt `start: Date` (Zeitpunkt). Eine Mahlzeit/Task hat ein **Kalenderdatum**. `getDate(item)` darf einen **ISO-Local-String** (`'2026-06-16'`) zurückgeben → kein UTC-Off-by-one (erhält cookerys „alles lokal, nicht UTC"-Philosophie).
- **Typsicherheit end-to-end.** Der `cell`-Snippet bekommt `items: T[]` mit dem echten Consumer-Typ (`MealEntry`). Kein `event.meta: Record<string,unknown>` + Cast pro Zelle. (Entspricht [[feedback_prefer_explicit_over_fallbacks]].)
- **Kein Capability-Rauschen.** `allDay`/`end`/`categoryId`/`recurrence` sind für Boards bedeutungslos.
- **Mehrtages-Spanning** (Buchungen/Urlaub) bleibt bewusst Calendar-Domäne (Event-Modell + `getMultiDayEventLayout`). Planner ist Single-Date-Bucketing.

### D2 — Planner ist view-parametrisiert, nicht week-only

Die Geometrie ist view-agnostisch (`getMonthGrid` und `getWeekDates` koexistieren bereits). Planner unterstützt `view="week" | "month" | "range"`. Week ist nur die **erste ausgelieferte** View (Liefer-Reihenfolge), keine Architekturgrenze.

### D3 — Geteilt wird Mechanik, nicht Markup

`DateGridController` + `dateGridContext` + Keyboard/Swipe + `DateGridScaffold`. Die View-Komponenten (`CalendarGrid` mit Event-Bars vs. `PlannerWeekGrid` mit cell-Snippet) bleiben getrennt, nutzen aber dasselbe Gerüst + denselben Context.

### D4 — Naming

| Ebene | Name | Sichtbarkeit | Begründung |
| --- | --- | --- | --- |
| Schicht 0 | `@urbicon-ui/blocks/date` | public subpath | Svelte-frei, server-tauglich — der entscheidende cookery-Use-Case |
| Schicht 1 | `DateGridController`, `dateGridContext`, `DateGridScaffold` | **internal** (`lib/internal/`) | Zwei öffentliche Konsumenten genügen; headless-Core später exponierbar |
| Schicht 2a | `Calendar` | public (bleibt) | Termin-Scheduler |
| Schicht 2b | `Planner` | public (neu) | Use-case-sprechend (Wochen-/Schicht-/Belegungsplan) → bessere MCP-Discovery als das neutrale `DateGrid` |

### D5 — Selektion

Der Controller trägt die volle Selektions-Logik (`single | range | multiple`, aus Calendar). **Planner** exponiert nur `selectedDate` (single, „aktiver Tag" wie im cookery-Screenshot der hervorgehobene Di). Range/multiple bleiben Calendar.

### D6 — Headless-Core bleibt vorerst internal

`lib/internal/date-grid/` wird **nicht** aus dem Paket exportiert. Begründung: API-Stabilitätslast vermeiden, solange nur Calendar + Planner konsumieren. Re-Export ist eine reine package.json-Ergänzung, falls später ein Consumer den nackten Core will.

## 4. Schicht-Spezifikation

### Schicht 0 — `lib/date/` (public subpath)

Reine Funktionen, **keine Svelte/Runes-Abhängigkeit**. Herausgelöst aus `calendar.engine.ts` (Geometrie-Teil).

```
packages/blocks/src/lib/date/
├── index.ts            # öffentliche API (re-exportiert die Module unten)
├── geometry.ts         # getMonthGrid, getWeekDates, getWeekNumber(ISO), getYearMonths
├── range.ts            # eachDayOfRange, startOfWeek, endOfWeek, addDays, isoToDate, toIso
├── compare.ts          # isSameDay, isWeekend, isInRange, stripTime, daysBetween, dateKey
└── format.ts           # formatWeekTitle, formatWeekRange, getWeekdayNames, formatDate(Full)
```

Öffentliche API (Auswahl):

```ts
// geometry
export function getMonthGrid(year: number, month: number, weekStartsOn?: number): Date[][]
export function getWeekDates(date: Date, weekStartsOn?: number): Date[]
export function getWeekNumber(date: Date): number          // ISO 8601

// range
export function eachDayOfRange(start: Date, end: Date): Date[]
export function startOfWeek(date: Date, weekStartsOn?: number): Date
export function addDays(date: Date, days: number): Date
export function toIso(date: Date): string                  // 'YYYY-MM-DD', lokal
export function isoToDate(iso: string): Date               // lokal, kein UTC-Parse

// compare / format
export function isSameDay(a: Date, b: Date): boolean
export function isWeekend(date: Date, weekStartsOn?: number): boolean
export function formatWeekRange(date: Date, locale?: string, weekStartsOn?: number): string  // "15. Juni – 21. Juni"
export function getWeekdayNames(locale: string, weekStartsOn: number, format?: 'narrow'|'short'|'long'): string[]
```

**package.json (blocks) — neuer Export-Eintrag:**

```jsonc
"./date": {
  "types": "./dist/date/index.d.ts",
  "svelte": "./dist/date/index.js",   // svelte-package packt lib/date mit
  "import": "./dist/date/index.js",
  "default": "./dist/date/index.js"
}
```

`calendar.engine.ts` re-importiert dann aus `$lib/date` (interne Konsumierung), behält nur die Event-Layout-Funktionen.

### Schicht 1 — `lib/internal/date-grid/`

```
packages/blocks/src/lib/internal/date-grid/
├── date-grid.svelte.ts        # DateGridController ($state-Klasse)
├── date-grid.context.ts       # createOptionalContext<DateGridContext>
├── date-grid.keyboard.ts      # roving-tabindex + Pfeil/Home/End/PageUp-Down Handler
├── DateGridScaffold.svelte    # view-parametrisiertes cell-Gerüst
└── date-grid.types.ts         # DateGridView, DayCellInfo, ...
```

**`DateGridController`** (Rollenmodell: `utils/overlay-stack.svelte.ts` — Klasse mit `$state` + reaktive Inputs via Getter-Optionen):

```ts
export type DateGridView = 'month' | 'week' | 'range' | 'day';

export interface DateGridOptions {
  get referenceDate(): Date;             // controlled (bind über Wrapper)
  get view(): DateGridView;
  get weekStartsOn(): number;
  get locale(): string;
  get rangeStart(): Date | undefined;
  get rangeEnd(): Date | undefined;
  get minDate(): Date | undefined;
  get maxDate(): Date | undefined;
  isDateDisabled?: (d: Date) => boolean;
  onNavigate?: (date: Date, range: { start: Date; end: Date }) => void;
}

export class DateGridController {
  constructor(opts: DateGridOptions) { ... }

  // --- reaktiver State ---
  focusedDate = $state<Date>(...);
  hoveredDate = $state<Date | null>(null);
  navDirection = $state<'forward' | 'backward' | null>(null);

  // --- abgeleitete Geometrie ($derived) ---
  get cells(): Date[][]      // month: Wochenzeilen; week: [eineZeile]; range: gechunkte Wochen
  get weekDates(): Date[]
  get weekdayNames(): string[]
  get title(): string        // lokalisiert ("KW 25 · 15.–21. Juni")
  get rangeStart(): Date
  get rangeEnd(): Date
  get canGoBack(): boolean
  get canGoForward(): boolean
  weekNumberFor(date: Date): number

  // --- Queries ---
  isToday(d: Date): boolean
  isWeekend(d: Date): boolean
  isOutside(d: Date): boolean   // month-Spill / range-Rand
  isDisabled(d: Date): boolean

  // --- Aktionen ---
  navigate(delta: number): void
  goToToday(): void
  goTo(date: Date): void
  setFocusedDate(d: Date): void
  setHoveredDate(d: Date | null): void
}
```

**`DateGridScaffold.svelte`** — rendert das geteilte Gerüst und ruft pro Tag einen `cell`-Snippet. Übernimmt: weekday-Header-Zeile, optionale Wochennummer-Spalte, `role="grid"` + Keyboard, `fly`-Transition beim Navigieren, `swipeable`-Attachment, responsive `grid` (Spalten → Stack). Pro Woche optional ein `weekOverlay`-Snippet (Calendar legt dort multi-day-Bars drüber; Planner nutzt es nicht).

```svelte
<script lang="ts">
  interface Props {
    cell: Snippet<[DayCellInfo]>;          // Pflicht
    dayHeader?: Snippet<[DayHeaderInfo]>;
    weekOverlay?: Snippet<[{ week: Date[]; weekIndex: number }]>;
    class?: string;
  }
</script>
<!-- liest getDateGridContext(); rendert cells; ruft {@render cell(info)} je Tag -->
```

`DayCellInfo` ist der **geteilte** Zell-Kontext (Calendar und Planner reichern ihn an):

```ts
export interface DayCellInfo {
  date: Date;
  isoDate: string;
  isToday: boolean;
  isWeekend: boolean;
  isOutside: boolean;
  isFocused: boolean;
  weekNumber: number;
}
```

### Schicht 2a — `Calendar` (Re-Base)

`Calendar.svelte` instanziiert den `DateGridController`, legt einen `dateGridContext` **und** einen schlanken `calendarEventContext` (events/categories/time-grid/drag) an. Die zell-basierten Views (`CalendarGrid` month, week-ohne-time-grid) rendern über `DateGridScaffold` + `weekOverlay` für multi-day-Bars. Time-Grid/Agenda/Day-Views bleiben eigene Komponenten, lesen aber `dateGridContext` für Navigation/Geometrie.

- **Was wandert raus** aus `calendar.context.ts` → `dateGridContext`: Zeilen 12–27 (Navigation, View, Selection), 35–53 (Styling/locale/grid/weekdays/title/weekDates), 56–89 (focus/hover/actions/queries/animation).
- **Was bleibt** `calendarEventContext`: Zeilen 28–33 (events/categories), 91–114 (time-grid, popover, mini-calendar, drag, resize).
- `createSlotHelper` wird generisch über die jeweilige Variants-Tabelle (Calendar und Planner haben je eigene `*.variants.ts`).

**Begleitend (sinnvoll, da wir ohnehin re-basen):** den dead `{:else}`-Spalten-Zweig in `CalendarWeekGrid` auflösen — Calendars Week-View bekommt über das Scaffold konsistente Zellen; Asymmetrie month/week verschwindet.

### Schicht 2b — `Planner` (neu)

```
packages/blocks/src/lib/components/Planner/
├── index.ts                 # PlannerProps<T> + JSDoc (MCP-Quelle) + re-exports
├── Planner.svelte           # Orchestrator: Controller + Bucketing + Scaffold
├── PlannerWeekGrid.svelte    # view='week'  (Spalten → Stack)
├── PlannerMonthGrid.svelte   # view='month' (6×7)
├── PlannerHeader.svelte      # prev/next/today/Titel/KW (optional, via header-Snippet ersetzbar)
├── planner.variants.ts       # tv() slots
├── planner.context.ts        # PlannerContext (items-Bucket-Map + Controller-Bridge)
└── planner.types.ts
```

**Props** (Reihenfolge nach ComponentStructureStandard: Content → View → State → Variants → Behavior → Callbacks → Snippets → Mint/Styling/a11y):

```ts
/**
 * @description Date-indexed planning grid — week, month or custom range — whose
 * cells hold YOUR domain content (meals, shifts, bookings) via a generic `cell`
 * snippet. Buckets items by date, handles navigation, ISO weeks, keyboard a11y and
 * responsive column→stack layout. For timed appointments use Calendar instead.
 * @tag display
 * @tag layout
 * @related Calendar
 * @related DatePicker
 * @stability beta
 */
export interface PlannerProps<T = unknown>
  extends Omit<PlannerVariants, 'view'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  // Content / Data
  items?: T[];
  getDate: (item: T) => Date | string;          // Pflicht; ISO-Local-String erlaubt (D1)
  sort?: (a: T, b: T) => number;                // Intra-Zell-Sortierung
  // View
  view?: 'week' | 'month' | 'range';            // @default 'week'
  rangeStart?: Date;                            // view='range'
  rangeEnd?: Date;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;     // @default 1
  locale?: string;                              // @default 'de-DE'
  showWeekNumber?: boolean;
  // State
  value?: Date;                                 // bind:value — Referenzdatum
  selectedDate?: Date;                          // bind:selectedDate — aktiver Tag (D5)
  // Variants
  variant?: 'default' | 'bordered' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  // Behavior
  highlightToday?: boolean;                     // @default true
  highlightWeekend?: boolean;
  swipeable?: boolean;                          // @default true
  animated?: boolean;                           // @default true
  disabled?: boolean;
  // Callbacks
  onNavigate?: (date: Date, range: { start: Date; end: Date }) => void;
  onDateSelect?: (date: Date) => void;
  onItemClick?: (item: T) => void;
  // Snippets
  header?: Snippet<[PlannerHeaderContext]>;     // ersetzt die Default-Toolbar
  dayHeader?: Snippet<[PlannerDayContext]>;     // pro Spalten-/Zellkopf
  cell?: Snippet<[PlannerCellContext<T>]>;      // Zellinhalt (der Kern)
  empty?: Snippet<[PlannerCellContext<T>]>;     // wenn items leer
  // Mint / Styling / a11y
  mint?: MintProp;
  class?: string;
  unstyled?: boolean;
  slotClasses?: Partial<Record<PlannerSlotName, string>>;
  preset?: string;
}
```

**Snippet-Kontexte:**

```ts
export interface PlannerCellContext<T> {
  date: Date;
  isoDate: string;            // 'YYYY-MM-DD', lokal
  items: T[];                 // gebucketed + sortiert (T, NICHT CalendarEvent)
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  isOutsideRange: boolean;
  weekNumber: number;
  selectDate: () => void;
}
export interface PlannerDayContext {
  date: Date; isoDate: string; weekday: string;
  isToday: boolean; isWeekend: boolean; weekNumber: number;
}
export interface PlannerHeaderContext {
  title: string; rangeStart: Date; rangeEnd: Date; weekNumber: number;
  view: 'week' | 'month' | 'range';
  navigate: (delta: number) => void; goToToday: () => void; goTo: (d: Date) => void;
  canGoBack: boolean; canGoForward: boolean;
}
```

**Ziel-Consumer-Code** (cookery-Wochenplan, ~286 Zeilen → das hier):

```svelte
<Planner view="week" items={entries} getDate={(e) => e.date}
         sort={(a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]}
         bind:value={referenceDate} onNavigate={(_, r) => loadWeek(r.start)}>
  {#snippet cell({ items, selectDate })}
    {#each items as entry (entry.id)}
      <MealCard {entry} />
    {/each}
    <Button variant="ghost" size="sm" onclick={() => openAdd(entry.isoDate)}>
      <PlusIcon /> Mahlzeit hinzufügen
    </Button>
  {/snippet}
</Planner>
```

## 5. Phasenplan

Jede Phase ist eigenständig grün (`bun run check && bun run lint && bun run test`) und für sich mergebar.

### Phase 0 — Inventar & Klassifikation ✅
- `calendar.engine.ts` Funktionen in **Geometrie** vs. **Event-Layout** markieren (Kommentar-Tags), gegen `calendar.engine.test.ts` (40 KB) abgleichen — welche Tests wandern in Schicht 0.
- `calendar.context.ts` Felder Core vs. Event annotieren (Vorlage in §4 Schicht 2a).
- **Akzeptanz:** Klassifikations-Tabelle als PR-Beschreibung; keine Code-Änderung.

### Phase 1 — Schicht 0 `lib/date/` ✅
- Geometrie/Format/Compare-Funktionen nach `lib/date/` verschieben; `calendar.engine.ts` importiert von dort.
- Geometrie-Tests aus `calendar.engine.test.ts` → `lib/date/*.test.ts`; neue Tests für `eachDayOfRange`, `isoToDate`/`toIso` (lokal, DST-Grenzen).
- package.json `./date`-Export ergänzen; `svelte-package` build prüfen (`dist/date/`).
- **Akzeptanz:** `bun run build` erzeugt `dist/date/index.js`; `import { getWeekNumber } from '@urbicon-ui/blocks/date'` typecheckt; Calendar unverändert grün.

### Phase 2 — Schicht 1 `DateGridController` + Scaffold ✅
- Controller + Context + Keyboard + Scaffold neu in `lib/internal/date-grid/`.
- Unit-Tests für Controller (navigate über Monats-/Wochen-/Range-Grenzen, `cells`-Geometrie je View, focus-Roving-Logik, selection).
- **Akzeptanz:** Controller-Tests grün; Scaffold rendert ein nacktes Grid in einem Smoke-Test (cell-Snippet zählt Tage).

### Phase 3 — Schicht 2a Calendar Re-Base ✅

**Umgesetzt (As-built):** `Calendar.svelte` instanziiert den `DateGridController` als geteilten **Mechanik-Motor** (Geometrie, Navigation für month/week/day, Roving-Focus, Hover, Selektion, today, navDirection). Die ~150 Zeilen duplizierte Logik (`navigateMonth/Week/Day`, `selectDate`-Selektion, `checkIsDate*`, `clampMonth`/`grid`/`weekDates`-derives, `focusedDate`/`hoveredDate`-state, today-Effekt) sind entfallen. Eine einzige SSoT `referenceDate` (displayedMonth/Year `$derived`). Der `CalendarContext` bleibt als **delegierende Fassade** (Subkomponenten unverändert); seine Mechanik-Getter lesen den Controller. Dead `{:else}`-Spaltenzweig in `CalendarWeekGrid` entfernt (week ist immer Time-Grid). Schicht-1-Verfeinerung: `onSelect(selection, date)` — der Trigger-Tag ermöglicht Calendars `onDateClick`/Spill-Navigation (+ Planners `onDateSelect`, D5). Neues Test-Netz: `Calendar.smoke.test.ts` (SSR-Render aller 5 Views + Selektion/Geometrie/Seeding, 17 Tests) — Calendar hatte zuvor **keine** Component-Tests.

**Bewusste Abweichungen vom ursprünglichen Plan-Wortlaut (begründet):**
- **Kein `DateGridScaffold` für Calendars month-view.** `CalendarDay` ist ein reicher interaktiver `<button>` (Popover mit Hover/Focus-Timer, Drag-Target, `ondblclick`→`onDateCreate`, `aria-label`/`aria-current`, `data-state`, `dayState`-tv()-Styling, roving-`tabindex`). Das Scaffold-Modell macht hingegen das `gridcell`-`div` **selbst** interaktiv (onclick/keyboard/tabindex/data-date) — beide würden die `gridcell`-Rolle tragen. Ein Zwang würde entweder CalendarDay-Features/a11y brechen **oder** das Scaffold mit Calendar-Spezifika überladen (genau das D3-Risiko „Über-Abstraktion"). Das Scaffold wird in Phase 4 an **Planner** validiert, dessen Zellen tatsächlich einfache `cell`-Container sind.
- **Kein Subkomponenten-Context-Split** (getrennte `dateGridContext` + `calendarEventContext` für die 17 Subkomponenten). 8/14 brauchen beide; die Methodennamen divergieren stark (`isDateToday`↔`isToday`, `isDateInMonth`↔`isOutside` invertiert, `grid`↔`cells`); ohne DOM-Test-Netz wäre ein Big-Bang-Split aller 17 Dateien fahrlässig. Der SSoT-Zweck ist über die Fassade erfüllt (der Controller IST die geteilte, getestete Mechanik; Planner braucht den `CalendarContext` nie).

**Bewusste Verhaltens-Verfeinerungen (Konsistenz-Fixes, kein Feature-Verlust):** `goToToday` feuert jetzt den view-passenden Callback (`onWeekChange`/`onDayChange`/`onMonthChange` statt immer `onMonthChange` — konsistent mit `navigate`); Keyboard-Monatswechsel animiert in korrekter Richtung; Spill-Tag-Navigation auf month-view beschränkt (verhindert Anker-Sprünge in week/day). Per Reviews als äquivalent/verbessert bestätigt.

**Notiert für später:** `CalendarDayView` hat einen analogen toten Nicht-Time-Grid-Zweig (XC-16 in `docs/internal/TODO.md`).

- **Akzeptanz erfüllt:** `bun run check` 0 Errors (−6 Warnungen ggü. main); Engine-Tests + neue Smoke-Tests grün; `svelte-autofixer` 0 Issues auf beiden geänderten `.svelte`; zwei Review-Agenten (keine High-Confidence-Bugs); visuelle Stichprobe month/week/year + Navigation in der docs-app, keine Konsolenfehler.

### Phase 4 — Schicht 2b Planner
- Komponente, Views (week zuerst, dann month, dann range), Variants, Context, `index.ts` mit JSDoc.
- Tests: Bucketing (ISO-String & Date-Input, lokal), view-Wechsel, `selectedDate`-Highlight, leere Zelle → `empty`-Snippet.
- `docs:scaffold Planner --group components` → Doc-Seite; `docs:gen:all` (Catalog + llm.txt + MCP-Catalog).
- **Akzeptanz:** Planner-Tests grün; Doc-Seite rendert; `Planner` erscheint in `mcp/component-catalog.json`.

### Phase 5 — DX / Discovery-Reparatur
- `design-system/patterns/planning-board.md` (für `get_pattern`); `docs/COMPONENT-DECISION-MATRICES.md` um **Calendar vs. Planner** ergänzen (siehe §7).
- MCP `suggest_implementation`-Matcher: bei „planner/meal/shift/board/week grid" → `Planner` + Card/Button; bei niedrigem Score **ehrlich** „kein direkter Fit, komponiere aus X" statt Junk-Skelett.
- Recipe `week-board` / `meal-planner` (`packages/mcp-server` recipe-Set + docs-recipe-Seite).
- **Akzeptanz:** `find_components("meal planner")` listet Planner zuerst; `suggest_implementation` liefert ein kohärentes Planner-Skelett; `get_pattern("planning-board")` antwortet.

### Phase 6 — Validierung am echten Consumer (cookery)
- In `~/Workspace/cookery` (separates Repo, **nicht** Teil dieses PRs): `src/lib/date.ts` durch `@urbicon-ui/blocks/date` ersetzen; `routes/plan/+page.svelte`-Grid durch `<Planner>` ersetzen.
- **Akzeptanz:** cookery-Wochenplan verhaltensgleich; Zeilenzahl `+page.svelte` deutlich kleiner; `src/lib/date.ts` gelöscht. Erkenntnisse fließen als API-Korrekturen zurück (Planner ist `@stability beta`, darf sich noch bewegen).

### Phase 7 — Release
- `bun run bump:minor` (neue Komponente = feat). Changelog via git-cliff. ([[bump_npm_nvm_path]] beachten.)

## 6. Datei-Übersicht

**Neu:** `lib/date/{index,geometry,range,compare,format}.ts` (+ Tests) · `lib/internal/date-grid/{date-grid.svelte.ts,date-grid.context.ts,date-grid.keyboard.ts,DateGridScaffold.svelte,date-grid.types.ts}` (+ Tests) · `components/Planner/*` (+ Tests, Doc-Seite) · `design-system/patterns/planning-board.md`

**Geändert:** `calendar.engine.ts` (Geometrie raus) · `calendar.context.ts` (Split) · `Calendar.svelte`, `CalendarGrid.svelte`, `CalendarWeekGrid.svelte` (Scaffold) · `packages/blocks/package.json` (`./date`-Export) · `packages/blocks/src/lib/index.ts` (Planner-Export) · `docs/COMPONENT-DECISION-MATRICES.md` · `packages/mcp-server` (suggest_implementation, recipe)

**Gelöscht (Greenfield-Bonus):** dead `{:else}`-Pfad in `CalendarWeekGrid`; ggf. `CalendarMiniMonth`-Sonderpfade, die nun das Scaffold nutzen.

## 7. Calendar vs. Planner — Decision-Matrix (für §`COMPONENT-DECISION-MATRICES.md`)

| Frage | → Calendar | → Planner |
| --- | --- | --- |
| Hat der Inhalt eine **Uhrzeit**? | ja (Termin 14:00–15:00) | nein (Mahlzeit/Schicht/Tagesnotiz) |
| Sollen Items über **mehrere Tage** spannen? | ja (Urlaub, Reise) | nein (Single-Date) |
| Zellinhalt = **dein** Domänen-Markup mit Aktionen? | nein, Event-Liste/Bars | ja, `cell`-Snippet mit `T` |
| Brauchst du **Time-Grid / Recurrence / Drag-Resize**? | ja | nein |
| Datentyp im Snippet | `CalendarEvent` | dein `T` |
| Typische Fälle | Buchungskalender, Müllabfuhr, Termine | Wochen-/Menüplan, Schichtplan, Belegung, Content-Kalender |

## 8. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
| --- | --- |
| Calendar-Regression beim Re-Base (40 KB Engine-Tests) | Phase 1+2 lassen Calendar unangetastet; Re-Base (Phase 3) erst wenn Controller-Tests grün; bestehende Tests sind das Sicherheitsnetz |
| Zwei Datums-Komponenten verwirren Consumer | Decision-Matrix (§7) + scharfe JSDoc-`@description` + MCP-Pattern (Phase 5) |
| `DateGridScaffold` driftet zur Über-Abstraktion (will Time-Grid mit-abdecken) | Harte Grenze D3: Scaffold = nur zell-basiert; Time-Grid bleibt Calendar-eigen |
| Subpath-Export `./date` bricht Bundler | svelte-package-Standardpfad; Smoke-Import-Test in Phase 1 |
| Generics in Svelte 5 (`Planner<T>`) | Rollenmodell `Combobox.svelte` (bereits generisch im Repo) |

## 9. Definition of Done

- [x] `@urbicon-ui/blocks/date` öffentlich, Svelte-frei, getestet (DST/lokal).
- [x] `DateGridController` + `DateGridScaffold` internal, unit-getestet.
- [x] `Calendar` auf den Core re-based (Fassade-Ansatz), Bestands- + neue Smoke-Tests grün, dead `{:else}`-Week-Zweig weg. (Scaffold-Re-Base von Calendars month-view bewusst nicht — siehe Phase 3.)
- [ ] `Planner<T>` mit `view=week|month|range`, generischem `cell`-Snippet, Doc-Seite, MCP-Catalog-Eintrag.
- [ ] MCP: `find_components`/`suggest_implementation`/`get_pattern` führen zum Planner statt weg.
- [ ] cookery-Wochenplan auf Planner portiert (Validierung), `src/lib/date.ts` gelöscht.
- [ ] `bun run check && bun run lint && bun run test` grün; `svelte-autofixer` 0 Issues auf allen neuen `.svelte`.

---

**Empfohlener Start:** Phase 0 + 1 (Inventar + `lib/date/`-Extraktion) — risikolos, sofort wertstiftend, schaltet die anderen Phasen frei.
