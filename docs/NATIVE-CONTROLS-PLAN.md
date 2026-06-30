# Native Controls — Strategie & Umsetzungsplan

> **Status:** 📋 Geplant — noch nicht umgesetzt. Diskussionsgrundlage + Umsetzungsplan, entstanden aus der iOS-Positionierungs-Saga rund um Combobox/Select im modalen Dialog (Codeberg #23, behoben in v6.3.12–v6.3.15). **Letzte Revision:** 2026-06-26.

## 1. Motivation

Die vier Releases, die nötig waren, damit ein Custom-Auswahlpanel (Select/Combobox) in einem modalen Dialog auf iOS mit offener Tastatur korrekt sitzt, sind das beste Argument für diesen Plan: Die gesamte Floating-UI-/Containing-Block-/visualViewport-Akrobatik existiert **nur, weil wir das Panel selbst positionieren**. Ein natives `<select>` öffnet auf iOS einen Picker-Wheel, der außerhalb des DOM-Layouts lebt — kein floating panel, keine Tastatur-Kollision, kein Sidebar-Transform, kein Top-Layer-Konflikt. Die ganze Bug-Klasse kann dort nicht entstehen.

Die These: Für eine Untermenge der Form-Komponenten ist ein **nativer Render-Modus als opt-in Escape-Hatch** sinnvoll — als robuste Alternative, wenn der Custom-Pfad auf einem konkreten Screen (klein, touch, tastaturnah) zu frickelig oder fehleranfällig wird. Nicht als Default, nicht als Ersatz.

## 2. Leitplanken

1. **Opt-in, nie Default.** Der Custom-Pfad bleibt die Standard-Erfahrung (Brand-Konsistenz). `native` ist eine bewusste, dokumentierte Wahl des Konsumenten.
2. **Gleiche API-Oberfläche.** `value`, `onValueChange`, `options`, `name`, `disabled`, `required` verhalten sich in beiden Modi identisch. Ein Wechsel `native={true/false}` darf die Daten-/Form-Integration nicht ändern.
3. **Lib-Philosophie wahren.** `native` ist orthogonal zu `unstyled`/`preset`/`slotClasses`: Diese gestalten weiterhin den *gestylten* Teil (den geschlossenen Trigger). Nur das geöffnete Dropdown/Wheel ist im native-Modus nicht gestaltbar — das ist der bewusste Trade.
4. **Fail-loud statt stiller Degradierung.** Setzt ein Konsument `native` zusammen mit einer Prop, die nativ unmöglich ist (z. B. Rich-Option-Snippets, Filter, Multi-Chips), warnt die Komponente im DEV-Build und ignoriert die Prop sichtbar — statt sie stillschweigend zu schlucken. (Konsistent zu [`feedback_prefer_explicit_over_fallbacks`].)
5. **Keine Render-Magie in der Lib.** Kein automatisches Umschalten nach Pointer-Typ/Breakpoint innerhalb der Komponente (SSR/Hydration-Mismatch, zwei verdeckte Pfade). Responsive bleibt eine explizite Consumer-Entscheidung: `native={isCoarsePointer}`.

## 3. Drei Ebenen von „nativ" — sauber trennen

Diese Trennung ist der Kern des Plans. Sie entkoppelt einen billigen Quick Win von der größeren API-Erweiterung.

| Ebene | Was | Kosten | Wann |
| --- | --- | --- | --- |
| **1 — Affordances** | `inputmode`, `enterkeyhint`, `autocomplete`, `autocapitalize`, `spellcheck`, `type` auf den *Custom*-Eingabefeldern garantieren + dokumentieren | sehr niedrig (Props existieren via `HTMLInputAttributes` schon) | **sofort** |
| **2 — Natives Widget (opt-in)** | `native`-Prop rendert das echte HTML-Control statt des Custom-Panels | mittel (neuer Render-Zweig je Komponente) | selektiv, gestaffelt |
| **3 — Responsive Auto-Switch** | nativ auf Touch, custom auf Desktop | hoch (SSR/Test/Konsistenz) | **bewusst NICHT in der Lib** — nur als Consumer-Pattern dokumentiert |

## 4. Komponenten-Matrix (Ist-Stand erhoben 2026-06-26)

| Komponente | Heute | Natives Äquivalent | `native`-Prop (Ebene 2)? | Begründung |
| --- | --- | --- | --- | --- |
| **Select** | Custom (`<button role=combobox>` + `<div role=listbox>`), erbt nur `HTMLAttributes` | `<select>` | ✅ **Ja — Pilot** | Echtes Äquivalent; größter Mobile-Robustheitsgewinn; geschlossener Trigger bleibt token-gestylt |
| **DatePicker** | Custom `Calendar` | `<input type="date">` | ✅ Ja — Phase 2 | Nativer Date-Picker auf Mobile exzellent (System-Wheel, Locale, A11y) |
| **Slider** | Custom (`<div role=slider>`) | `<input type="range">` | ✅ Ja — Phase 2 | Native range besser bei Touch/A11y/Voice; Custom nur für Ticks/Range/Marken |
| **Combobox** | Custom (`<input role=combobox>` + listbox) | `<input list>` / `<datalist>` | ❌ Nein | `datalist` zu schwach/buggy (iOS); Filter/async/Rich-Optionen sind der Kernwert |
| **CurrencyInput** | `<input type=text inputmode=decimal>` | — (schon nativ-aware) | — (nur Ebene 1) | Bereits korrekt; ggf. `enterkeyhint` ergänzen |
| **Input / Textarea** | nativ `<input>` / `<textarea>`, erbt `HTMLInputAttributes` | — (ist nativ) | — (nur Ebene 1) | Affordances dokumentieren + via FormField weiterreichen |
| **Checkbox / Toggle / RadioGroup** | nativ `<input type=checkbox/radio>` | — | — | Schon nativ; nichts zu tun |
| **SegmentGroup** | Custom (`<button>`-Gruppe) | radio-group | ❌ Nein | Gestaltetes Segment-Control; kein Mobile-Robustheitsproblem |
| **Menu / CommandPalette** | Custom | — | ❌ Nein | Action-Family; kein natives Pendant, Rich-Interaktion ist der Zweck |

## 5. API-Design der `native`-Prop (Ebene 2)

```ts
/**
 * Render the control as a native HTML widget instead of the custom panel.
 * Trades the styled dropdown for platform robustness (no floating panel, no
 * keyboard/viewport conflicts, native a11y). The closed trigger stays styled;
 * the open list/picker is the platform's. `value`/`onValueChange`/`options`/
 * `name` behave identically. @default false
 */
native?: boolean;
```

**Verhalten im `native`-Modus (am Beispiel Select):**

- Rendert `<select>` (statt button + listbox). Der geschlossene `<select>` wird über die bestehenden `trigger`/Container-`slotClasses` + Tokens gestylt (Trigger ist nativ stylebar; das offene Dropdown nicht).
- `options` → `<option>` (flach) bzw. `<optgroup>` (Gruppen). Reine Text-Labels.
- `value` ↔ `<select>.value`; `onValueChange` aus dem `change`-Event. Kein verstecktes `<input>` mehr nötig — `name`/`required` sitzen direkt am `<select>` (saubere Form-Integration).
- **DEV-Warnungen** bei nativ-unverträglichen Props: Rich-Option-Snippets, `multiple` mit Chip-Rendering, Combobox-Filter, `slotClasses.listbox/option` (greifen nicht). → `console.warn` + sichtbarer Fallback, kein stilles Schlucken.
- **Multi-Select:** zunächst nur Single. `<select multiple>` ist auf Mobile schwer bedienbar; Multi bleibt vorerst Custom-only (als Limitation notiert, nicht als Lücke).

**Konsistenz:** `native` ist unabhängig von `unstyled`/`preset`/`overrides`. Diese gelten weiter für den gestylten Trigger.

## 6. Ebene 1 — Affordances (Quick Win, keine neue API)

`Input`/`Textarea`/`Combobox` erben bereits `HTMLInputAttributes` und spreaden `{...restProps}` auf das native `<input>`/`<textarea>` — `inputmode`, `enterkeyhint`, `autocomplete`, `autocapitalize`, `spellcheck`, `type` **gehen heute schon durch**, sind aber weder dokumentiert noch garantiert noch in der JSDoc/MCP-Oberfläche sichtbar. To-do:

1. **Garantie absichern:** Test, der prüft, dass diese Attribute auf dem inneren `<input>` landen (Regressionsschutz gegen ein künftiges `restProps`-Refactor).
2. **Durch FormField/Wrapper weiterreichen** dort, wo ein Wrapper sie heute abschneidet (verifizieren).
3. **Sinnvolle Defaults nur, wo eindeutig:** CurrencyInput `inputmode="decimal"` (vorhanden) ggf. + `enterkeyhint`; ein Such-Combobox-Preset `enterkeyhint="search"`. Niemals erzwingen — nur ermöglichen.
4. **Dokumentieren:** kurzer Abschnitt in [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md) („native input affordances werden durchgereicht; setze `inputmode`/`enterkeyhint` für die richtige Mobiltastatur").

## 7. Rollout-Phasen

- **Phase 0 — Ebene 1 (Affordances):** §6. Klein, sofort, keine neue API. Eigener Patch-Release.
- **Phase 1 — `native` Pilot an Select:** API etablieren (§5), DEV-Warnungen, Form-Integration, Doc-Seiten-Abschnitt, Decision-Matrix-Eintrag. **Auf iOS-Simulator UND echtem Gerät verifizieren** (siehe §9). `minor`-Bump.
- **Phase 2 — DatePicker (`<input type=date>`) + Slider (`<input type=range>`):** dieselbe `native`-Konvention übertragen.
- **Phase 3 — DX/Discovery:** `@description`-JSDoc je Komponente (MCP-Catalog/llm.txt), Eintrag in [COMPONENT-DECISION-MATRICES.md](COMPONENT-DECISION-MATRICES.md) („wann nativ vs. custom"), ggf. `validate_design`-Hinweis.
- **Phase 4 — Zukunft (beobachten, nicht bauen):** CSS *Customizable Select* (`appearance: base-select` + `<selectedcontent>`) — natives `<select>` mit voll stylebarem Dropdown. Stand 2026: Chromium ja, Safari/Firefox nein. Sobald breit verfügbar, kann der `native`-Modus vom „robust-aber-ungebrandet" zum „nativ **und** gebrandet" wachsen — **ohne API-Bruch**, weil die Prop schon existiert. Genau deshalb lohnt die saubere opt-in-Einführung jetzt.

## 8. Nicht-Ziele (bewusst, mit Begründung)

- **Kein `native` für Combobox/Menu/CommandPalette/SegmentGroup** — kein brauchbares natives Pendant; Rich-Interaktion ist der Daseinszweck.
- **Kein responsive Auto-Switch in der Lib** (Ebene 3) — nur als Consumer-Pattern dokumentiert (`native={new MediaQuery('(pointer: coarse)').current}`).
- **Keine Pixel-Identität** zwischen native- und Custom-Modus — der native-Modus ist bewusst plattformnah.
- **Kein Multi-Select nativ** (vorerst) — `<select multiple>` ist mobil schlecht bedienbar.

## 9. Verifikation (Lehre aus #23 fest eingebaut)

Der ganze Sinn des native-Modus ist Mobile-Robustheit — also wird er **genau dort** geprüft, wo der Custom-Modus schwächelte:

1. **iOS-Simulator UND echtes Gerät** — nicht nur der Simulator. Die #23-Saga hat gezeigt: der Simulator kann einen anderen Render-Pfad nehmen als das echte Gerät (in-dialog → Sim `fixed`, Gerät Top-Layer). Tooling + Diagnose-Snippet: siehe [`reference_ios_webkit_repro_tooling`].
2. **Szenario:** native Select/DatePicker im modalen Dialog, mit offener Tastatur — exakt der #23-Fall. Erwartung: keinerlei Positionierungsarbeit nötig (System-Picker).
3. **Form-Integration:** Submit mit `name`/`required` in beiden Modi identisch.
4. **A11y-Smoke:** VoiceOver/TalkBack auf dem nativen Control.
5. **Desktop-Regression:** Chromium + WebKit, beide Modi, kein Bruch am Custom-Pfad.

## 10. Offene Fragen

- **`<select>`-Trigger-Styling-Grenzen** je Browser (Pfeil, Padding, Schrift) — wie weit kommen wir mit Tokens, wo ist die ehrliche Decke? (Vor Phase 1 kurz evaluieren.)
- **Icons/zweizeilige Optionen** im native Select schlicht nicht möglich → DEV-Warnung; reicht das, oder braucht es eine separate `richOptions`-Erkennung?
- **DatePicker nativ + i18n:** `<input type=date>` nutzt die System-Locale, nicht unsere i18n-Locale — bewusst akzeptieren oder als Limitation dokumentieren?

## 11. Industrie-Referenz

| System | Ansatz |
| --- | --- |
| **Shopify Polaris** | `<Select>` **nativ by default** — bewusste Robustheits-Entscheidung |
| **MUI** | Custom default, `native`-Prop am `<Select>` — explizit für Mobile empfohlen (Vorbild für unsere API) |
| **Bootstrap** | Native `<select>`, leicht gestylt (geschlossen) |
| **Radix / Ark / Headless UI** | Reine Custom-Primitives, kein native-Modus (Styling-Kontrolle priorisiert) |
| **Chakra** | Beides: natives `Select` + Custom |
| **HIG / Material Design** | empfehlen native Picker auf Touch |

Grobe Linie: content-/Mobile-first Systeme lehnen zu nativ, design-control-first Systeme bleiben custom. Unser opt-in-`native` (MUI-Linie) ist der pragmatische Mittelweg, der zur `unstyled`/`preset`-Philosophie passt.
