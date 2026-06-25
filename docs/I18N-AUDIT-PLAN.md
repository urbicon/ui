# i18n-Audit — Unübersetzte Strings & unbenutzte Keys (Umsetzungsplan)

> **Status:** In Umsetzung (Branch `feat/i18n-audit`). WP-Reihenfolge unten; jedes Arbeitspaket wird einzeln committet, mit Review-Agent geprüft und nachgebessert.
> **Sprache:** Internes Strategie-/Umsetzungsdokument (Deutsch). Public-API von `auditTranslations` + die `urbicon i18n`-Hilfetexte sind Englisch (Top-Level-Konvention). Nach Abschluss As-built in `docs/ARCHITECTURE.md` / `packages/i18n/README` kondensieren.
> **Rahmen:** Pre-Release ([[project_pre_release_status]]) — keine externen Konsumenten außer den eigenen Apps (Hausy/Utilio) + Dogfooding. Breaking erlaubt, aber wir halten `validatePackageTranslations` non-breaking, weil es billig ist.
> **Entscheidungen (Felix, 2026-06-25):** Tool-Heimat = `urbicon`-CLI (`@urbicon-ui/design`); Umfang v1 = **A + B + C** (inkl. Hardcoded-Lint).

## 1. Motivation & Befund

Frage war: Hat `@urbicon-ui/i18n` eine Funktion, mit der Konsumenten **unübersetzte Strings** oder **unbenutzte Keys** detektieren? Befund:

- **`validatePackageTranslations()`** (`packages/i18n/src/lib/i18n/package-integration.ts:267`) prüft **nur Key-Parität** zwischen Locales (missing = error, extra = warning). Keine leeren Strings, keine Interpolations-Parameter-Parität, keine Plural-Kategorien.
- **Prototyp `packages/blocks/scripts/i18n-analyzer.js`** (~1030 Zeilen, verdrahtet über root-Scripts `i18n:analyze`/`i18n:check`) detektiert bereits Unused-Keys, Missing-Translations **und** Hardcoded-Strings — aber:
  - **regex-basiert** mit **hartcodierter Alias-Namen-Liste** (`bt|tt|tableT|blocksT|docsT|td|componentsT`) → verallgemeinert nicht auf Konsumenten mit frei benannten Aliassen (`const x = useTranslate()`).
  - **keine Dynamik-Behandlung**: Template-Literals werden in `findMissingTranslations` schlicht übersprungen (`registry-analyzer.js`-Logik `if (usedKey.includes('${')…) continue`) → eine Dynamik-Familie wie `filter.operators.*` erscheint vollständig als „unused" (**False-Positives**).
  - **nicht als API exponiert**, nur internes Script; `showDebug = true` hartverdrahtet, `accessibility.avatar`-Debug-Litter → Prototyp-Charakter.
- **Laufzeit**: `registry.translate()` fällt bei fehlendem Key still auf den Key selbst zurück (`registry.svelte.ts:277`) — **kein** `onMissingKey`-Hook. Das widerspricht der fail-loud-Linie ([[feedback_prefer_explicit_over_fallbacks]]).

**Nordstern:** Prototyp ersetzen durch ein **AST-basiertes, binding-bewusstes, konfidenzgestuftes** Tool, dessen Domänenlogik in `@urbicon-ui/i18n` lebt und dessen Kommando-Oberfläche in der `urbicon`-CLI sitzt — plus eine reine Daten-API (`auditTranslations`) und einen Laufzeit-`onMissingKey`-Hook.

## 2. Architektur — Logik in `@urbicon-ui/i18n`, Oberfläche in `urbicon`

Die Packaging-Wahl (urbicon-CLI) betrifft die **UX**. Die **Domänenlogik** bleibt im i18n-Paket — erzwungen durch drei Gründe:

1. **Feature A muss als Test-API ohne CLI nutzbar sein** (`expect(auditTranslations(bundles).ok).toBe(true)` im Vitest des Konsumenten).
2. Die Parität-Checks kennen das Datenmodell intim (`collectDeepKeys`, `{{param}}`-Syntax, `_plural`/`Intl.PluralRules`) — i18n-Heimatdomäne.
3. Die `urbicon`-CLI ist „bundled, Node-runnable, kein Bun nötig"; der Scanner braucht `typescript` + `svelte/compiler`. → Scanner als **dev-only Subpath** `@urbicon-ui/i18n/audit` mit ts/svelte als **optionalDependencies, lazy `import()`** (kein Top-Level-Import → Bundler inlined sie nicht; Abwesenheit lässt nur den Scan fehlschlagen, nie die ganze CLI).

```
@urbicon-ui/i18n
├─ (main)            auditTranslations() + onMissingKey/createMissingKeyCollector   ← Feature A + Runtime, zero-dep, Test-API
└─ /audit (subpath)  scanUsage() · findUnusedKeys() · findHardcodedStrings()        ← Feature B + C; ts+svelte optional/lazy

@urbicon-ui/design (urbicon-CLI)
└─ src/cli/commands/i18n.ts  runI18n()  → importiert aus @urbicon-ui/i18n[/audit], dünner Wrapper
   (registriert in index.ts switch + HELP; reuse args.ts/output.ts/gate.ts/manifest-io.ts)
```

Spiegelt das bestehende Engine/CLI-Thin-Wrapper-Muster (`validate` → `lintDesign` aus `@urbicon-ui/design-engine`).

## 3. Drei Detektionen

Der Prototyp vermischt drei Dinge; wir trennen sauber.

### Feature A — Parität & Übersetzungsqualität (Daten-Ebene, kein Scan)

Reine Funktion über die Locale-Bundles. Deterministisch, **null False-Positives**. Neue `auditTranslations(packageName, bundles, opts)`; `validatePackageTranslations` bleibt (Parität-Teilmenge).

| `code` | Severity | Bedeutung |
| --- | --- | --- |
| `missing-key` | error | Key in Base, fehlt in Ziel-Locale |
| `extra-key` | warning | Key nur in Ziel-Locale |
| `empty-value` | error\* / warning | Leaf `''`/whitespace. \*error, wenn Base nicht-leer ist (klare Regression), sonst warning |
| `param-mismatch` | error | `{{x}}`-Param-Menge Ziel ≠ Base (fehlend → Platzhalter rendert; extra → nie geliefert) |
| `plural-shape-invalid` | error | `${key}_plural`-Wert ist kein parsebares JSON-Objekt mit string-`other` |
| `plural-category-incomplete` | warning | `_plural` deckt nicht alle `Intl.PluralRules(locale).pluralCategories` (Laufzeit fällt auf `other` → grammatikalisch falsch) |
| `value-equals-key` | warning | Wert === Key-Pfad (Platzhalter-Smell) |
| `same-as-base` | warning (opt-in, default off) | Ziel-Wert identisch zu Base → vermutlich unübersetzt; FP-anfällig (Markennamen/„OK") |

**Laufzeit-Komplement — `onMissingKey`:** Hook in `I18nConfigureOptions`/`configureI18n`, gefeuert am echten Miss (`registry.svelte.ts:277`, vor `translation = key`). Nur bei „nirgends aufgelöst" (`reason: 'no-translation'`). Plus `createMissingKeyCollector()` → `{ onMissingKey, report() }` für Test-Asserts „keine fehlenden Keys getroffen" — und Ground-Truth-Quelle für Feature B (Layer 5).

### Feature B — Unbenutzte Keys (Quelltext-Scan)

Drei Teilprobleme:

**B1 — Welche Call-Sites sind Übersetzungs-Calls?** (Alias-Namen sind frei.)
- **Binding-aware AST (Kern):** tracke Identifier, die an eine Translate-Quelle gebunden sind (`const x = useI18n().t`, `const {t} = useI18n()`, `createPackageI18n('pkg',…).useTranslate()`/`.t`), dann gilt `x(...)` als Call — findet beliebige lokale Namen automatisch und kennt zugleich das Package des Alias (→ exakte Namespace-Zuordnung).
- **Default-Recognizer:** die konkreten Factories dieser Lib (`useI18n`, `useTranslate`, `createPackageI18n().useTranslate`, Destrukturierung, `<T key>`, `$t`).
- **Escape-Hatch:** Config `functionNames: [...]` für seltene prop-durchgereichte/cross-file-Fälle.
- Verworfen: voller Type-Checker (zu schwer/langsam aufzusetzen; Binding-Tracker deckt ~99 %).

**B2 — Key aus dem Argument extrahieren:**
- String-Literal / Template ohne Substitution → statischer Key.
- Ternary/`||` → in beide Zweige rekursieren (real immer statische Literale).
- Template mit Substitution `` `filter.operators.${x}` `` → Dynamik-Präfix `filter.operators.*` (Usage-Pattern, kein konkreter Key).
- Identifier/Member/Call `t(item.nameKey)` → opaker dynamischer Call-Site (file:line merken).

**B3 — „Unused" sicher entscheiden** (False-Positive-Kontrolle, der Knackpunkt). Ein Key gilt nur als unused, wenn ihn KEIN Layer erreicht — Union mit Konfidenz-Bias „lieber als benutzt zählen":

| Layer | markiert *benutzt* via | Konfidenz | fängt |
| --- | --- | --- | --- |
| 1 statische Usage | exakter Literal-Key im Translate-Call | hoch | Normalfall |
| 2 Dynamik-Präfix | Key matcht `filter.operators.*` | konservativ | Template-Familien |
| 3 Loose Literal-Harvest | *jedes* String-Literal im Code == definierter Key-Pfad (auch außerhalb `t()`) | niedrig | data-driven Keys (`nameKey:'nav.overview'`) |
| 4 Allowlist (Config + Inline-Marker) | `dynamicKeys:['errors.*']` / `/* i18n-used: errors.* */` | explizit | Rest der Dynamik |
| 5 Runtime-Usage (optional) | JSON aus `createMissingKeyCollector` im Test/E2E | höchste (Dynamik) | beweist Erreichbarkeit |

Bias-Begründung: ein False-Negative auf „unused" ist harmlos; ein False-Positive (→ jemand löscht einen lebenden Key) ist gefährlich → Layer 3 invertiert den riskanten Fehler. ([[feedback_prefer_explicit_over_fallbacks]]: write strict / read tolerant.)

**Confidence-Tiers im Output:**
- **`unused-confirmed`** — von keinem Layer berührt, keine opaken Dynamik-Sites im Scope → autonom handhabbar (LLM/CI). Gating: error.
- **`unused-suspect`** — statisch unused, aber opake `t(variable)`-Sites existieren → Sites mitanzeigen, prüfen statt löschen. Gating: warning (nur `--strict`).

**Gratis-Bonus `used-but-undefined`** (hoher Wert): statisch-exakter Key in `t()`-Call, der in keinem Bundle existiert → Tippfehler/Stale-Rename, rendert rohen Key. Gating: error. Erweiterung pro Locale = „benutzt, in `en` definiert, in `de` fehlend".

### Feature C — Hardcoded-String-Lint

svelte-compiler-AST (nicht Prototyp-Regex) → flaggt nur Text-Nodes + Attribute (`aria-label`/`title`/`placeholder`/`alt`) + `{'literal'}`, niemals `<script>`/`<style>`. Skip-Heuristik (Längenbounds, no-letters, all-caps, URLs, Identifier, schon-gewrappt) + Config `ignoreStrings` + Inline-`<!-- i18n-ignore -->`. **Advisory by default**, gating nur opt-in — exakt das `--slop-floor`-Modell des Design-Gates (FP-anfällige Heuristik darf sauberen Lauf nicht rot färben).

## 4. CLI-Oberfläche (flacher Parser; Dispatch über `positionals[0]`)

```
urbicon i18n <check> [paths...]
  check:  parity | unused | hardcoded | audit (= alle)
  --json            { ok, findings, unused, unusedSuspect, usedButUndefined, … }, stabile codes, deterministisch sortiert
  --strict          warnings gaten auch
  --only / --skip   Checks scopen
  --config <path>   i18n.audit.json (sources, translations, functionNames, dynamicKeys, ignoreKeys, runtimeUsage)
  --manifest <path> Token-/History-Integration wie validate
```
Konventionen von `validate` geerbt: rekursives Sammeln, `node_modules/.svelte-kit/dist`-Skip, stdin, `EXIT {OK:0,FAIL:1,USAGE:2}`, `formatReport`-Stil.

**Enforcement:** CI-Step `urbicon i18n audit --json` (parity + unused-confirmed + used-but-undefined gaten hart; hardcoded + suspect + same-as-base advisory). PostToolUse-`hook` ist per-Datei → passt nur für die lokalen Checks (used-but-undefined/hardcoded der editierten Datei); Ganzprojekt-Checks (unused/parity) bleiben CI/`validate`-Style.

## 5. Arbeitspakete (ToDos)

- [x] **WP0 — Plan-Doc** persistieren (dieses Dokument) + committen. (Commit `ae8427a`)
- [x] **WP1 — Feature A + Runtime** (`@urbicon-ui/i18n`) — Commits `38d9dca` (Feature) + `ef33a9f` (Review-Härtung). 94 Tests, svelte-check clean.
  - [x] `src/lib/audit/translations.ts`: `auditTranslations()` + Finding-Typen (`TranslationFinding`, `TranslationFindingCode`, `TranslationAuditReport`).
  - [x] Checks: missing/extra (reuse `collectDeepKeys`), empty-value, param-mismatch (`extractParamNames`), plural-shape/-category (`Intl.PluralRules`), value-equals-key, same-as-base (opt-in). Review ergänzte `wrong-type` (Non-String-Leaf) + `invalid-locale` (kein Intl-Crash bei vertipptem Tag).
  - [x] `onMissingKey` in `I18nConfigureOptions` + `configureI18n` + Registry-Feld + Fire am Resolve-Nowhere-Punkt (`reportMissing:false` für `_plural`-Probe; try/catch um den Sink); `createMissingKeyCollector()`.
  - [x] Exporte in `src/lib/index.ts`.
  - [x] Vitest (`audit/translations.test.ts` + `audit/missing-key.test.ts`). `validatePackageTranslations`-Tests grün geblieben.
  - [x] Review (code-reviewer + silent-failure-hunter): 2× HIGH + 1× MEDIUM behoben, Fixes committet.
- [ ] **WP2 — Feature B Scanner-Kern** (`@urbicon-ui/i18n/audit`)
  - [ ] `package.json`: `exports['./audit']`, `optionalDependencies` typescript+svelte.
  - [ ] `scan/ts-source.ts` (TS-Compiler-API) + `scan/svelte-source.ts` (svelte/compiler `parse`), lazy geladen.
  - [ ] `scan/binding-tracker.ts` (B1), `scan/key-extractor.ts` (B2).
  - [ ] `unused.ts`: Reconciler (5 Layer + Tiers + used-but-undefined).
  - [ ] Vitest mit `__fixtures__/` (statisch, ternary, template-präfix, data-driven, opak).
  - [ ] Review (code-reviewer, type-design-analyzer), Fixes, Commit.
- [ ] **WP3 — Feature C Hardcoded** (`@urbicon-ui/i18n/audit`)
  - [ ] `hardcoded.ts` (AST + Skip-Heuristik + Marker). Vitest. Review, Fixes, Commit.
- [ ] **WP4 — urbicon-CLI**
  - [ ] `design/src/cli/commands/i18n.ts` (`runI18n`, dispatch), `index.ts` switch+HELP, dep `@urbicon-ui/i18n`, Config-Loader. Vitest (`i18n.test.ts`). Review, Fixes, Commit.
- [ ] **WP5 — CI + Dogfooding**
  - [ ] `templates/ci-github.yml` i18n-Step; `blocks/scripts/i18n-analyzer.js` entfernen; root `i18n:analyze`/`i18n:check` → `urbicon i18n`. Review, Fixes, Commit.
- [ ] **Abschluss:** As-built kondensieren; Version-Bump (minor — neue Features) **lokal** (Tag, nicht pushen — Push = npm-Publish/Buny, Felix' Schritt [[project_buny_deploy_ui]]).

## 6. Nebenfunde (während der Umsetzung)

Beiläufige Funde, die nicht direkt zu den WPs gehören, werden im gitignorierten Backlog `docs/internal/TODO.md` notiert (Abschnitt „i18n-Audit — Nebenfunde"), nicht hier.
