# Artifact Studio

Beschreiben, sehen, weiterreden — die Artefakt-Erfahrung an unserem eigenen Stack.
Ein Wunsch geht an ein Modell, das die echte `urbicon`-CLI als einziges Werkzeug hat;
das Ergebnis wird gelintet, gebaut und in einer Sandbox auf eigener Origin angezeigt.
Jeder weitere Wunsch ändert dieselbe Datei und legt eine neue Version an.

**Rein lokal.** Kein Deploy-Target, kein öffentlicher Zugang. Das Studio führt Modellcode
im Browser aus und verbraucht Inferenz — beides gehört hinter keine öffentliche URL
(ARTEFAKTE-2026-07.md, E1). Der Präzedenzfall im Repo ist `apps/chat-demo`.

## Starten

```sh
bun --filter='@urbicon-ui/artifact-studio' run dev     # → http://localhost:5210
```

Voraussetzungen:

- **Gebautes `@urbicon-ui/blocks`** (`bun run build:packages` im Repo-Wurzelverzeichnis).
  Die Artefakte werden gegen `packages/blocks/dist` kompiliert; ohne das scheitert der Build
  jeder Version.
- **`ANTHROPIC_API_KEY`** — aus der Umgebung, aus `apps/artifact-studio/.env` oder aus
  `apps/chat-demo/.env` (in dieser Reihenfolge). Fehlt er, scheitert das Anlegen einer
  Sitzung laut und sichtbar in der Oberfläche.

## Zwei Origins, und warum

`vite dev` liefert den Host auf `localhost:5210`. Daneben läuft ein zweiter Server auf
`127.0.0.1:5211`, der ausschließlich die gebauten Artefakte ausliefert. Beide startet
`scripts/dev.ts`, damit `bun run dev` ein Befehl bleibt — der Wrapper hält den
Sandbox-Server **über** Vite, nicht darin. Als Vite-Plugin starb er bei jeder Änderung an
der Config: Vite lädt sich neu, `server.close()` wartet auf die offene
HMR-WebSocket-Verbindung, und der neue Anlauf greift nach dem Port, bevor der alte ihn
hergibt. Ein statischer Dateiserver hat mit Vites Lebenszyklus nichts zu tun.

Der Unterschied ist nicht kosmetisch. SEP-1865 verlangt normativ getrennte Origins, und
der Grund ist konkret: das Frame-Dokument braucht `sandbox="allow-scripts allow-same-origin"`,
sonst ist seine Origin opak und die CSP-Quelle `'self'` matcht nichts mehr — der Browser
blockt dann das eigene Artefakt-Modul. Auf einer **fremden** Origin gewährt
`allow-same-origin` dem Frame nur Zugriff auf sich selbst, nie auf den Host.

Beide Ports sind fest (`strictPort`). Ein wanderndes Gegenstück würde die
Zwei-Origin-Bedingung unbemerkt aushebeln.

Dass die Richtlinie wirklich greift, ist nachgeprüft und nachprüfbar:

```sh
bun --filter='@urbicon-ui/artifact-studio' run csp:check              # muss grün sein
bun --filter='@urbicon-ui/artifact-studio' run csp:check --without-csp  # Gegenprobe
```

Der Lauf baut die echte Konstellation — Host auf `localhost:5212`, Sandbox auf
`127.0.0.1:5211`, `sandbox="allow-scripts allow-same-origin"` — und lässt ein
Artefakt acht verbotene Dinge versuchen: `fetch`, WebSocket, `sendBeacon`,
fremdes Script, Inline-Script, `eval`, externes Bild, Zugriff aufs Host-DOM.
Alle acht scheitern; der Host sieht keine einzige Anfrage.

**Gemessen wird am Empfänger, nicht am Artefakt.** `navigator.sendBeacon` gibt
`true` zurück, sobald der Browser den Request eingereiht hat, und blockt ihn
erst danach — die Sonde meldete „durchgekommen", während die Konsole den
Verstoß protokollierte. Nur der Host weiß, ob etwas ankam.

Die Gegenprobe (`--without-csp`) ist Teil der Aussage: dieselben Sonden kommen
ohne Richtlinie durch (der Host sieht alle fünf Pfade), **außer dem Zugriff aufs
Host-DOM** — der bleibt blockiert, weil dahinter die Origin-Trennung steht und
nicht die CSP. Genau diese Zeile zeigt, was welche Maßnahme beiträgt.

## Was wo liegt

| Teil | Datei |
| --- | --- |
| Loop (Modell, Werkzeuge, Lint, Fix-Runden) | `src/lib/server/session.ts` |
| Der `urbicon init`-Block als System-Prompt | `src/lib/server/grounding.ts` |
| Die CLI als Werkzeug | `src/lib/server/cli-tool.ts` |
| Der Editor (patchen statt neu schreiben) | `src/lib/server/editor-tool.ts` |
| Vite-Build je Version (eigener Prozess) | `src/lib/server/build-version.ts` |
| Sandbox-Server (zweite Origin) | `src/lib/server/sandbox.ts` |
| CSP-Negativtest (acht Sonden + Gegenprobe) | `scripts/csp-check.ts` |
| Ereignisstrom-Kontrakt | `src/lib/events.ts` |
| Oberfläche | `src/lib/Studio.svelte` |

`cli-tool.ts` und `editor-tool.ts` sind zugleich die Quelle für den Fixture-Recorder unter
`prototypes/artifact-frame/recorder/` — der importiert sie von hier, statt eine zweite
Fassung zu pflegen.

Sitzungen liegen unter `.artifacts/<id>/` (git-ignoriert): die Arbeitsdatei, `session.json`
mit Historie und Versionen, `versions/v<n>.svelte` als eingefrorene Stände, `dist/` mit dem
Gebauten — und `design.manifest.md`, sobald der Agent eine Entscheidung festhält.

## Jede Sitzung ist ein eigenes kleines Projekt

Die CLI läuft mit dem **Sitzungsordner als Arbeitsverzeichnis**. Das ist keine Kosmetik:
`context`, `record-decision` und der Token-Overrides-Teil von `validate` suchen
`design.manifest.md` relativ zum cwd. Mit dem Repo-Root läse eine Sitzung das Manifest des
UI-Repos — falsch, denn ein Artefakt ist ein eigenes Produkt mit eigener Absicht.

Damit läuft der Design-Kreislauf hier in **beide** Richtungen: der Agent liest `context` als
Erstes und schreibt mit `record-decision` zurück, was er als produktweite Vorgabe verstanden
hat. Verifiziert an einem echten Lauf — die Nebenbemerkung „Karten sollen luftig sein" wurde
als ADR festgehalten und im Folge-Turn befolgt.

Gesperrt bleiben `init` und `hook`: die schreiben in ein *Projekt* (AGENTS.md,
`.claude/settings.json`) und hätten in einer Sitzung nichts zu tun.

## Entscheidungen, die nicht offensichtlich sind

- **Patch-Modus, nicht Volltext.** Änderungen laufen über das Editor-Tool. Gemessen 37 s
  gegen 87 s je Wunsch — bei einem Fixture gleichgültig, an einer Oberfläche der Unterschied.
- **Sonnet 5 auf `high`.** Gegenüber Opus 5 halber Preis, zwei Drittel der Zeit, dieselben
  Lint-Werte, und bei der Iteration 87 s gegen 186 s.
- **Der Zustand liegt auf der Platte.** Der Dev-Server startet bei jeder Codeänderung neu;
  eine Sitzung, die das nicht überlebt, wäre beim Bauen an ihr selbst unbenutzbar.
- **Ein Stylesheet je Sitzung**, content-gehasht, statt eines pro Version. Das CSS ist zu
  98,5 % Token-Layer und damit für jede Version fast identisch.
- **Kein `inlineDynamicImports` im Artefakt-Build** — es hebt den lazy Mint-Registry-Import
  aus seiner Reihenfolge, und das Artefakt stirbt beim Start.
- **Auch ein Artefakt mit offenen Lint-Befunden wird gebaut und gezeigt.** Ein Lauf, der das
  Gate nicht besteht, ist ein ehrlicher Befund; ihn zu verstecken hieße, die Oberfläche
  gegen ihre eigene Messung zu schönen.
