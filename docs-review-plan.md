# Docs Review Plan — Repo public schalten — 2026-07-31

Baseline: **v6** (aktuell 6.45.0). Zielbild: Ein neuer Dev landet im Repo, versteht in
15 Minuten, was hier gebaut wird, wie die Pakete zusammenhängen und wo er weiterliest —
ohne über tote Links, „private repo"-Aussagen oder v4-Migrationsanleitungen zu stolpern.

## Zusammenfassung

- **74 getrackte Docs** im Scope (ohne `.claude/skills`, ohne Test-Fixtures)
- **Mechanisch vollständig geprüft:** Link-Integrität aller 74, Marker-Scan, Zahlen-Faktencheck
- **Volltext gelesen:** ARCHITECTURE, README, docs/README, CONTRIBUTING, DOCS-SURFACES,
  COMPONENT-API-CONVENTIONS, COMPONENT-FAMILIES, ComponentStructureStandard,
  SVELTE5-PATTERNS, TailwindCaveats, VERSIONING, MIGRATION-v5, ResponsiveGuidelines,
  ICON-ROADMAP
- **Nur strukturell/gescannt:** DocsPageGuide, ICON-DESIGN, DECISION-MATRICES, GUIDE,
  A2UI, STICKY-PINNING, AUTH, design-system/*, die meisten Package-READMEs — alle mit
  sauberer, nummerierter Gliederung, kein Handlungsbedarf erkennbar
- Aktionen: **1 restructure (groß)** · **9 update** · **1 split+archive** · **2 neu** · 0 delete

Git-Branch-Vorschlag: `docs/review-2026-07-31` (aktuell `main`, Baum sauber).

---

## Der Hauptbefund: ARCHITECTURE.md

491 Zeilen, **21 gleichrangige Top-Level-Abschnitte**, keine Gliederung, kein Einstieg,
kein Diagramm. Die Kritik trifft zu und lässt sich präzisieren:

**1. Es fehlt der Anfang.** Das Dokument startet bei „Design Token System". Nirgends steht,
welche Pakete es gibt, wie sie voneinander abhängen, in welcher Reihenfolge gebaut wird
oder wo man den Einstiegspunkt einer Komponente findet. Genau das braucht ein neuer Dev
zuerst — und es steht in keinem Doc des Repos, auch nicht im Root-README (das hat nur
einen Verzeichnisbaum ohne Beziehungen).

**2. Die Gewichtung ist verrutscht.** `Color Rooms Theme (docs-only)` belegt **88 Zeilen
(18 % des Dokuments)** — ein reines Theme der Doku-Website. `Auth Package` bekommt 23,
`Table Package` 27. Vier weitere Abschnitte (UI Recipes, Theme Builder, Showcase, Figma
Token Export) beschreiben ebenfalls Features der Doku-Site, nicht die Architektur der
Bibliothek. Zusammen sind das **~130 Zeilen Doku-Site in einem Monorepo-Architekturdoku**.

**3. Der rote Faden ist zerrissen.** Wie aus einem Token eine gerenderte Komponente wird,
verteilt sich über fünf nicht benachbarte Abschnitte (Design Token System → Component
Styling → Internal Core Layer → Preset System → dazwischen Tier System, Mint, Overlay).

**4. Es enthält einen echten Faktenfehler.** `Table Package → Remote Data Architecture
(planned)` beschreibt einen „empfohlenen Ansatz" für ein Feature, das **implementiert
ist**: `packages/table/src/lib/stores/concerns/useRemoteData.svelte.ts`,
`mode?: 'client' | 'server'` (`core/table/index.ts:407`), `TableQuery` in `tableTypes.ts`,
Test-Abdeckung in `tableQuery.parity.test.ts`. Ein neuer Dev baut das nach, was längst da ist.

**5. Der Strategie-Block ist zwei Jahre Versionen alt.** Zeile 5: *„Current focus is
consolidation for v1.0 ('harden before extend')"* — bei Version 6.45.0.

**6. Zum Vergleich:** GUIDE.md, STICKY-PINNING.md, ICON-DESIGN.md, A2UI.md und
DECISION-MATRICES.md haben alle nummerierte, thematisch geordnete Gliederungen.
ARCHITECTURE.md ist der Ausreißer im Repo, nicht die Norm.

### Vorschlag: Neuschnitt in drei Dateien

| Datei | Inhalt | Umfang |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` (neu geschnitten) | Der Einstieg. Schrittweise, mit Diagrammen. | ~330 Z. |
| `apps/docs/README.md` (**neu**) | Alles Doku-Site-Spezifische: Color Rooms, Recipes, Theme Builder, Showcase, Figma-Export | ~130 Z. |
| `docs/DECISIONS.md` (**neu**, optional) | „Conscious Trade-offs" als eigenes Doc | ~40 Z. |

Neue Gliederung von `ARCHITECTURE.md`:

```
# Architecture
   Kurzer Einstieg: was das ist, für wen, wie man dieses Doc liest

## 1 · Das Monorepo auf einen Blick          ← NEU
   1.1 Paketkarte            (Mermaid-Graph: Abhängigkeiten der 12 Pakete)
   1.2 Was liegt wo          (Tabelle: Paket → Aufgabe → Einstiegsdatei)
   1.3 Build-Reihenfolge     (Mermaid: shared-types → i18n → blocks → table/auth → docs)

## 2 · Von Token zu Markup — der rote Faden   ← NEU zusammengeführt
   Mermaid-Fluss: foundation.css → semantic.css → interaction.css → tv() → Slot → DOM
   2.1 Die drei Token-Schichten          (aus „Design Token System")
   2.2 Das Tier-System                   (aus „Tier System")
   2.3 Die tv()-Variantenengine          (aus „Component Styling" + „tv() engine")
   2.4 Die Override-Kaskade              (aus „Preset System", als Diagramm)
   2.5 Die interne Core-Schicht          (aus „Internal Core Layer")

## 3 · Querschnittssysteme
   3.1 Formularfeld-Verdrahtung   3.2 Mint   3.3 Overlay-Motion   3.4 i18n

## 4 · Die Pakete im Profil                    ← NEU als Profile
   blocks · table · auth · i18n · docs-gen · design/-content/-engine · sveltekit-utils
   je 4–6 Zeilen + Link auf das Paket-README (das jeweils die Wahrheit ist)

## 5 · Werkzeuge & Pipelines
   docs-gen-Pipeline (Diagramm) · die Lint-Gates · Bundle-Size · Versionierung

## 6 · Bewusste Kompromisse
   (unverändert übernommen)
```

**Diagramme:** Mermaid, weil GitHub es nativ rendert (und die Doku-Site ebenfalls).
Vier Stück: Paketgraph, Build-Reihenfolge, Token→Markup-Fluss, docs-gen-Pipeline.

---

## Der zweite Befund: MIGRATION-v5.md ist kein reines Altlast-Dokument

Erster Eindruck (Titel „v4 → v5", Baseline ist v6) trügt. Zwei Dinge stecken drin:

**(a) Echte Migrationsanleitung v4→v5** — bei Baseline v6 tatsächlich Ballast.

**(b) Der Varianten-Kontrakt** — und der wird **aus dem Quellcode heraus referenziert**:

```
packages/table/src/lib/variants/table.variants.ts:3    „see docs/MIGRATION-v5.md §3"
packages/table/src/lib/variants/table.variants.ts:327  „Variant contract (see …§3)"
packages/table/src/lib/core/table/index.ts:125         „see docs/MIGRATION-v5.md §3"
packages/blocks/src/lib/primitives/Accordion/accordion.variants.ts:30  „…§2"
packages/blocks/src/lib/primitives/Alert/alert.variants.ts:22          „…§2"
packages/blocks/src/lib/style/semantic.css:78          „MIGRATION-v5 'New tokens'"
```

Dazu wurde das Dokument bis **v6.41** weitergepflegt: Abschnitt „3b. Table state snippets
renamed (v6.41)" ist eine v6-Änderung in einem v4→v5-Dokument, und §2/§3 tragen
Klammernotizen zu v6.30/v6.32-Umbenennungen. Es ist faktisch zum Breaking-Changes-Sammler
mutiert, ohne umbenannt zu werden.

**Verdrahtung** (Löschen wäre ein Code-Change, kein Doc-Change):

- `packages/blocks/package.json` → `files`-Feld (Tarball-Auslieferung)
- `packages/docs-gen/src/cli/CLI.ts:51` → `PACKAGE_GUIDES` slug `migration-v5`
- `packages/docs-gen/src/schema/ConfigurationBuilder.ts:381` → guides-Config
- 2 Tests: `design-content/src/content-loader.test.ts:57`, `docs-gen/tests/GuideInjection.test.ts:20`
- Kanäle: `urbicon guide migration-v5`, MCP-Resource, `static/blocks/MIGRATION-v5.md`, scope-`llms.txt`

**Empfehlung — trennen statt löschen:**

1. `packages/blocks/docs/VARIANT-CONTRACT.md` (**neu**) — der bleibende Teil: was
   `quiet`/`outlined`/`elevated`/`floating` auf Card bedeuten, `Alert.inline`,
   `Accordion.card`, Tables `flush`/`surface`/`framed`, die Border-Token-Migration, die
   neuen Tokens. Die sechs Quellcode-Kommentare zeigen künftig hierauf.
2. `docs/archive/2026-07/MIGRATION-v5.md` — die reine v4→v5-Anleitung wandert ins Archiv.
3. Guide-Slug `migration-v5` → `variant-contract` umziehen (CLI.ts, ConfigurationBuilder,
   2 Tests, `package.json` files, Root-Symlink).

**Alternative, falls dir das zu viel Bewegung ist:** Datei bleibt liegen, wird aber zu
`UPGRADING.md` umbenannt und v6-first sortiert (v6-Änderungen oben, v4→v5 als
zusammengeklappter historischer Anhang unten). Weniger sauber, ein Drittel des Aufwands.

→ **Diese Entscheidung brauche ich von dir** (siehe „Offene Entscheidungen" unten).

---

## Querschnittsbefunde

### Q1 · Zehn tote Links — alle zeigen auf gitignorte Ziele

`docs/internal/` und `docs/archive/` sind gitignored. Im privaten Repo funktionierten die
Links lokal; nach dem Public-Schalten sind sie für jeden Besucher tot.

| Datei | Link | Schwere |
| --- | --- | --- |
| `packages/design/README.md` | `../../docs/internal/DESIGN-MCP-V2.md` | **hoch** — npm-Tarball |
| `packages/design-engine/README.md` | `../../docs/internal/DESIGN-MCP.md` | **hoch** — npm-Tarball |
| `packages/design-engine/README.md` | `../../docs/internal/DESIGN-MCP-V2.md` | **hoch** — npm-Tarball |
| `docs/ARCHITECTURE.md` | `archive/2026-06/I18N-ARCHITECTURE-ROADMAP.md` | mittel |
| `docs/COMPONENT-FAMILIES.md` | `archive/2026-05/LIGHTER-CONSOLIDATION.md` (3×) | mittel |
| `docs/COMPONENT-DECISION-MATRICES.md` | `archive/2026-05/V1-HARDENING-AUDIT.md` | mittel |
| `docs/SVELTE5-PATTERNS.md` | `archive/2026-05/REVIEW-2026-05.md` | mittel |
| `docs/technical-debt.md` | `internal/DEBT-DECISIONS-2026-07-24.md` | niedrig |

Die drei Tarball-Fälle sind die schlimmsten: Wer `@urbicon-ui/design` installiert, liest
im README einen Verweis auf ein Dokument, das es öffentlich nirgends gibt.

**Fix:** Bei allen die Aussage inline auflösen (ein Satz statt Link) — die Links dienen
durchweg als „historische Begründung", nicht als notwendige Fortsetzung.

### Q2 · Zwei Stellen behaupten, das Repo sei privat

`docs/DOCS-SURFACES.md:12` — *„npm consumers could not reach `docs/` at all — the repo is
private and README links into it were dead"*
`docs/DOCS-SURFACES.md:56` — *„relative links 404 on npmjs against the private repo"*

Beides wird mit dem Public-Schalten falsch. Zeile 12 ist historische Begründung
(umformulieren ins Präteritum), Zeile 56 ist eine **aktive Regel**, deren Begründung
wegfällt — die Regel selbst (absolute Deep-Links für die npmjs-Ansicht) bleibt aber
richtig, weil npmjs relative Links generell nicht in Repo-Pfade auflöst. Begründung
korrigieren, Regel behalten.

### Q3 · Zahlen-Drift

| Doc | Aussage | Ist | Quelle |
| --- | --- | --- | --- |
| `README.md:37` | „36 primitives + 19 components" | **40 / 27** | `find … -name index.ts` |
| `docs/ARCHITECTURE.md:284` | „20 production-ready UI recipes" | **23** | `routes/recipes/*/` |
| `docs/COMPONENT-FAMILIES.md:11` | „~35 primitives" | **40** | s.o. |
| `docs/ICON-ROADMAP.md:3` | „156 → 315 icons" | **318** | `icons/*.svelte` |
| `AGENTS.md` (Icons-Abschnitt) | „alle 315 icons" | **318** | s.o. |

Kein Drama einzeln, aber in Summe der Eindruck „hier zählt keiner mehr nach". Für ein
Repo, das gerade public geht, sind das die ersten Zahlen, die jemand nachprüft.

### Q4 · Sechs oder sieben Familien?

`docs/COMPONENT-FAMILIES.md` dokumentiert unter „## The seven families" **sieben**
(inkl. `Conversation`: Chat, PromptInput, StreamingMarkdown, A2UIView …).

`AGENTS.md` und `docs/README.md:20` sagen beide *„six-family taxonomy (Action / Form /
Navigation / Container / Feedback / Identity)"* — die Conversation-Familie fehlt in beiden
Indizes. Sie ist die jüngste (AI-Kit) und wurde beim Nachziehen der Indizes vergessen.

**Fix:** Beide Indizes auf sieben korrigieren.

### Q5 · VERSIONING.md widerspricht dem eigenen Debt-Log

`docs/VERSIONING.md:32`: *„The tag on HEAD is critical — it triggers the CI publish pipeline."*

`.github/workflows/release.yml` sagt im Kopfkommentar das Gegenteil:
*„PUBLISHING IS DELIBERATELY OFF HERE (decided 2026-07-31 …). The effective npm publisher
is the Buny deploy on the deploy host."* — und `docs/technical-debt.md:17` führt genau das
als Eintrag („The effective npm publisher is the Buny deploy, not `release.yml`").

Der Satz ist nicht komplett falsch (der Tag triggert beides), aber er schickt einen neuen
Dev in die falsche Datei. **Fix:** Einen Satz präzisieren — Tag triggert das CI-*Gate*,
publiziert wird vom Deploy-Host.

### Q6 · Interne Marker in öffentlichen Docs

Das eigene Prinzip 4 in `DOCS-SURFACES.md` verbietet interne Review-IDs in öffentlichen
Docs. Verstöße (alle in repo-only-Docs, nicht im Tarball — daher niedrige Priorität):

- `XC-3 / XC-6 / XC-7 / XC-9 / XC-10 / XC-11 / XC-12 / XC-13 / XC-14` — in ARCHITECTURE,
  COMPONENT-FAMILIES, DocsPageGuide, DECISION-MATRICES. Lösen für Außenstehende nichts auf.
- `BDG-1` in `COMPONENT-FAMILIES.md:203` („tracked as BDG-1") — verweist auf ein Ticket,
  das es öffentlich nicht gibt.
- `WP2` in `SVELTE5-PATTERNS.md` (2×) und `packages/i18n/README.md:321` — **letzteres ist
  im Tarball**.

**Fix:** In Überschriften ersatzlos streichen (`## Listbox item rhythm (XC-9)` →
`## Listbox item rhythm`); im Fließtext, wo der Marker eine Änderung datiert, durch die
Version ersetzen („seit v6.19" statt „XC-10"). `BDG-1` → „nicht geplant" oder Debt-Eintrag.

### Q7 · Kein Einstiegspfad für neue Devs

`README.md` verlinkt sieben Docs in einer flachen Tabelle; `docs/README.md` ist ebenfalls
eine Linkliste; `CONTRIBUTING.md` nennt drei „entry points". Keine der drei sagt, **in
welcher Reihenfolge** man liest. Nach dem ARCHITECTURE-Umbau löst sich das größtenteils —
`ARCHITECTURE.md §1` wird der Einstieg. `docs/README.md` bekommt zusätzlich einen
Drei-Zeilen-Lesepfad an den Kopf („Neu hier? → ARCHITECTURE §1 → COMPONENT-FAMILIES →
ComponentStructureStandard").

---

## Aktionen pro Datei

### `docs/ARCHITECTURE.md`
- **Aktion:** restructure + update
- **Änderungen:**
  - Neugliederung in 6 nummerierte Kapitel (Schema oben)
  - **Neu:** §1 Monorepo-Überblick mit Paketgraph + Build-Reihenfolge (2 Mermaid)
  - **Neu:** §2 Einleitungs-Diagramm Token → Markup (Mermaid)
  - **Neu:** §5 docs-gen-Pipeline als Diagramm (ersetzt die Prosa-Aufzählung)
  - **Auslagern** nach `apps/docs/README.md`: Color Rooms (Z. 404–491), UI Recipes
    (282–297), Theme Builder (299–301), Showcase (303–305), Figma Token Export (278–280)
  - **Auslagern** nach `docs/DECISIONS.md`: „Conscious Trade-offs" (369–387)
  - **Faktenkorrektur** Z. 347–361: „Remote Data Architecture (planned)" → beschreibt den
    ausgelieferten Server-Mode, Link auf `packages/table/README.md`
  - **Streichen** Z. 5: Strategie-Block „consolidation for v1.0" (v6.45 ist die Baseline)
  - Z. 284: „20 recipes" → nach `apps/docs/README.md`, dort ohne feste Zahl
    (die Navigation ist die Wahrheit)
  - Z. 247: toter Archiv-Link → Aussage inline
  - XC-Marker aus Überschriften (Z. 186, 204) und Fließtext (62, 114) entfernen
- **Konfidenz:** hoch bei Faktenkorrekturen und Auslagerung; **mittel** bei der
  Gliederungstiefe (Geschmacksfrage — sag Bescheid, wenn du flacher willst)

### `apps/docs/README.md` — **neu**
- **Aktion:** create
- **Inhalt:** Doku-Site-spezifisches aus ARCHITECTURE (Color Rooms komplett, Recipes,
  Theme Builder, Showcase, Figma-Export) + Kurz-Anleitung „Site lokal starten"
- **Begründung:** `apps/docs` hat als einziger Workspace kein README; die 130 Zeilen
  gehören zu ihm, nicht ins Monorepo-Architekturdoku
- **Konfidenz:** hoch

### `docs/DECISIONS.md` — **neu**
- **Aktion:** create (Inhalt aus ARCHITECTURE §Conscious Trade-offs)
- **Konfidenz:** mittel — kann auch in ARCHITECTURE §6 bleiben. Ich würde auslagern:
  Die Liste wächst, und „warum haben wir X *nicht* gemacht" ist eine eigene Leserfrage.
  Sag Bescheid, wenn es drin bleiben soll.

### `packages/blocks/docs/VARIANT-CONTRACT.md` — **neu** *(nur bei Variante 1)*
- **Aktion:** merge-then-archive (Quelle: MIGRATION-v5.md §1–§3b + Border-Token + New tokens)
- **Folgeänderungen im Code:** 6 Kommentar-Referenzen, `CLI.ts`, `ConfigurationBuilder.ts`,
  2 Tests, `package.json:files`, Root-Symlink
- **Archivziel:** `docs/archive/2026-07/MIGRATION-v5.md`
- **Konfidenz:** hoch für die Trennung; die Slug-Umbenennung ist der riskanteste Teil
  (berührt Guide-Kanäle) — läuft mit `bun run docs:gen:all` + den 2 Tests als Gate

### `README.md`
- **Aktion:** update
- **Änderungen:** Z. 37 Zahlen korrigieren (40/27); Z. 52 `docs/`-Beschreibung
  („Architecture docs, conventions, roadmap" → „roadmap" gibt es dort nicht);
  Doku-Tabelle (82–91) um COMPONENT-FAMILIES + SVELTE5-PATTERNS ergänzen,
  Reihenfolge als Lesepfad
- **Konfidenz:** hoch

### `docs/README.md`
- **Aktion:** update
- **Änderungen:** Lesepfad-Block an den Kopf; Z. 20 „six-family" → „seven-family";
  Migration-Abschnitt (34–36) je nach Entscheidung ersetzen; Z. 9 ARCHITECTURE-Beschreibung
  an die neue Gliederung anpassen; Verweis auf neues `apps/docs/README.md`
- **Konfidenz:** hoch

### `AGENTS.md` (= `CLAUDE.md`, Symlink)
- **Aktion:** update
- **Änderungen:** „six-family taxonomy" → seven; „315 icons" → 318 (2 Stellen prüfen);
  MIGRATION-v5-Verweis je nach Entscheidung; ARCHITECTURE-Verweise auf neue Kapitel
- **Konfidenz:** hoch
- **Hinweis:** Symlink — `git add AGENTS.md`, nicht `CLAUDE.md`

### `docs/DOCS-SURFACES.md`
- **Aktion:** update
- **Änderungen:** Z. 12 „the repo is private" → Präteritum („was private at the time");
  Z. 56 Begründung von „private repo" auf „npmjs löst relative Links nicht auf" umstellen
- **Konfidenz:** hoch

### `docs/COMPONENT-FAMILIES.md`
- **Aktion:** update
- **Änderungen:** Z. 11 „~35 primitives" → 40; 3 tote Archiv-Links (Z. 55, 164, 253)
  inline auflösen; Z. 203 `BDG-1` entfernen; Z. 207 Überschrift-Marker `(XC-9)` streichen;
  Z. 248 deutsche Überschrift „Querverweise" → „Cross-references" (Rest des Docs ist Englisch)
- **Konfidenz:** hoch

### `docs/VERSIONING.md`
- **Aktion:** update
- **Änderungen:** Z. 32 Publish-Satz präzisieren (Tag triggert das CI-Gate; publiziert
  wird vom Deploy-Host — mit Verweis auf den Debt-Eintrag)
- **Konfidenz:** hoch

### `docs/SVELTE5-PATTERNS.md` · `docs/COMPONENT-DECISION-MATRICES.md` · `docs/technical-debt.md`
- **Aktion:** update (nur Link-Reparatur)
- **Änderungen:** je 1–2 tote Archiv-/Internal-Links inline auflösen; `WP2` → „vor v6.x"
- **Konfidenz:** hoch

### `packages/design/README.md` · `packages/design-engine/README.md`
- **Aktion:** update
- **Änderungen:** 3 Links auf `docs/internal/DESIGN-MCP*.md` entfernen, Aussage inline
- **Konfidenz:** hoch — **das ist der dringendste Fix**, weil im Tarball ausgeliefert

### `packages/i18n/README.md`
- **Aktion:** update
- **Änderungen:** Z. 321 `WP2` → Versionsangabe (Tarball-Doc, interner Marker)
- **Konfidenz:** hoch

### `docs/ICON-ROADMAP.md`
- **Aktion:** update (nicht archivieren)
- **Änderungen:** Z. 3 „156 → 315" → 318; Titel/Intro klarstellen, dass die Wellen
  abgeschlossen sind und nur der Polish-Backlog offen ist
- **Konfidenz:** mittel — Alternative wäre Archivierung, aber der Polish-Backlog (Z. 57–65)
  ist noch offen und `docs/README.md` listet die Datei aktiv. Ich würde sie behalten.

### Unverändert (keine Befunde)
`docs/COMPONENT-API-CONVENTIONS.md`¹ · `ComponentStructureStandard.md`¹ ·
`TailwindCaveats.md` · `ResponsiveGuidelines.md` · `DocsPageGuide.md`² · `ICON-DESIGN.md` ·
`GUIDE.md` · `A2UI.md` · `STICKY-PINNING.md` · `AUTH.md` · `design-system/*` ·
`CONTRIBUTING.md` · `SECURITY.md` · `CODE_OF_CONDUCT.md` · übrige Package-READMEs

¹ bekommen nur Anker-Updates, wenn ARCHITECTURE-Überschriften sich ändern (siehe Link-Reparatur)
² enthält `XC-6`/`XC-4` — Marker-Fix optional, geringe Priorität

---

## Entscheidungen (getroffen 2026-07-31)

**E1 · MIGRATION-v5 → Variante (1) „Trennen".**
Varianten-Kontrakt nach `packages/blocks/docs/VARIANT-CONTRACT.md` (bleibt im Tarball),
v4→v5-Anleitung nach `docs/archive/2026-07/`. Guide-Slug `migration-v5` → `variant-contract`.

**E2 · `docs/DECISIONS.md` wird ausgelagert.** (eigene Leserfrage, Liste wächst)

**E3 · Gliederungstiefe:** zwei Ebenen wie oben skizziert.

**E4 · `technical-debt.md`-Auslagerung: separate Runde**, nicht Teil dieses Reviews.

---

## Nicht im Scope (nur zur Kenntnis)

- **`docs/technical-debt.md` (1943 Zeilen)** enthält ~19 erledigte Einträge (durchgestrichen
  bzw. „resolved"). Nach deiner eigenen Regel („erledigte Historie auslagern statt kürzen")
  wäre eine Auslagerung nach `docs/archive/` fällig. Das ist eine eigene Runde — sag
  Bescheid, ob ich das anhänge.
- **`experiment/`, `prototypes/`, `docs/internal/`, `docs/archive/`** sind gitignored und
  werden nicht public. Unangetastet.
- **`CHANGELOG.md`** wird von git-cliff generiert — nicht angefasst.

---

## Ausführungsreihenfolge

1. Inhalte zusammenführen (VARIANT-CONTRACT, apps/docs/README, DECISIONS)
2. Updates an bestehenden Docs (Fakten, Zahlen, Formulierungen)
3. ARCHITECTURE.md neu schneiden
4. Link-Reparatur (inkl. der Anker, die sich durch 3 verschieben)
5. Archivierung (MIGRATION-v5 → `docs/archive/2026-07/`, dieser Plan dazu)
6. Verifikation: Link-Check erneut, `bun run docs:gen:all`, `registry:lint`,
   die 2 Guide-Tests

**Commits:** git-cliff generiert den Changelog aus Commits — viele `docs:`-Commits blähen
den nächsten Release-Eintrag auf. Ich schlage **drei** vor:
`docs: restructure architecture overview` · `docs: align docs with v6 baseline` ·
`docs: repair links for the public repo`. Sag Bescheid, wenn du einen einzigen willst.
