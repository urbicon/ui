# Fallblatt-Board — Befunde (2026-07-26)

Prototyp beantwortet eine Frage: **Hält die Fallblatt-Animation 98 Zeilen beim
Umsortieren durch?**

Server: `bun -e '…'` auf `:5199`, oder `board.html` direkt öffnen.
`bun gen-data.ts` erzeugt `board-data.js` neu aus Katalog + Baseline.

## Antwort: ja — aber nicht mit der Mechanik, mit der ich angefangen habe

## 1. Der Fehler in meiner ersten Messung

Die erste Fassung trieb alle rollenden Zeichen aus einem zentralen
`requestAnimationFrame`-Loop und schrieb `textContent` **einmal pro
Alphabet-Schritt** — bis zu 69-mal je Zeichen. Ein synchroner Benchmark maß
0,9 ms Median pro Durchlauf und sah damit unbedenklich aus.

Der Benchmark maß aber nur die JS-Arbeit. Die eigentliche Rechnung — Repaint
für ~72 000 geänderte Textknoten — stand in der Methodenbeschreibung als
„nicht erfasst" und war genau der entscheidende Posten. In der Praxis (Safari,
Felix' Maschine) dauerte eine Sortierung **5–7 Sekunden** und wirkte defekt.

**Lehre:** Ein Benchmark, der den vermuteten Kostentreiber misst, bestätigt die
Vermutung. Er widerlegt sie nicht. Die subjektive Beobachtung im echten Browser
war die belastbarere Messung.

## 2. Die Mechanik, die trägt

Zwei Ebenen, bewusst getrennt:

| Ebene | Umsetzung | Läuft auf |
|---|---|---|
| Bewegung | eine Web-Animation je Zeichen, `transform: scaleY` | Compositor |
| Zeichenwechsel | ein zentraler rAF-Loop, getimt auf die Minima | Main-Thread |

`transform` wird vom Compositor animiert und belastet den Main-Thread nicht.
Der Main-Thread muss nur noch die Zeichen wechseln — und zwar 1–5 Mal je Flap
statt bis zu 69 Mal.

Die Schreibvorgänge fielen damit von 71 898 auf 6 192 (Faktor 11,6), die Dauer
von 5–7 s auf 840 ms.

Die Anzahl der Stufen hängt vom Weg durchs Alphabet ab (`stagesFor`): ein
Zeichen, das weit rollen muss, klappert länger als eines, das nur einen Schritt
macht. Damit bleibt das Solari-Gefühl erhalten, ohne den Weg wirklich
abzulaufen — ein echtes Fallblatt zeigt die Zwischenzeichen ohnehin nicht
scharf.

## 2b. Die zweite Korrektur: Gleichzeitigkeit statt Menge

Nach dem Umbau blieb ein Rest: „nur sichtbare" fühlte sich in Safari **deutlich
smoother** an als „alle Zeilen" — obwohl das HUD in beiden Fällen dieselbe Dauer
zeigte.

Die Dauer misst, wann das *letzte* Zeichen steht; sie hängt an der Staffelung,
nicht an der Menge. Die Last unterschied sich aber um das Dreifache. Und der
Grund dafür war ein Fehler in der Staffelung: Sie lief über Zeichen und Spalten,
**nicht über Zeilen** — alle 98 Zeilen starteten damit im selben Frame und der
Compositor bekam über 2 000 Transform-Animationen auf einen Schlag.

Genau diese Ebene war in allen bis dahin gemessenen Zahlen nicht enthalten. Die
subjektive Beobachtung im echten Browser hat sie geliefert. **Zum zweiten Mal.**

Eingeführt: eine Zeilenwelle (`TIMING.row`, relativ zum Sichtfeld) und
`peakConcurrent()` als HUD-Metrik — die Zahl gleichzeitig laufender Flaps im
dichtesten Moment. Damit ist der Effekt messbar statt nur spürbar.

| Zeilen | Umfang | Flaps | Schreibvorgänge | Spitze gleichzeitig | Dauer |
|---|---|---|---|---|---|
| **98** | **nur sichtbare** | 636 | 1 878 | **635** | **790 ms** |
| 400 | nur sichtbare | 660 | 1 818 | 647 | 776 ms |
| 98 | alle Zeilen | 1 314 | 3 902 | 1 030 | 1 067 ms |
| 400 | alle Zeilen | 5 664 | 16 826 | 1 359 | 2 511 ms |

Vor der Zeilenwelle lag die Spitze bei „alle Zeilen" über 2 000.

**Die wichtigste Zeile der Tabelle ist die zweite:** Bei „nur sichtbare" sind
Spitze und Dauer **unabhängig von der Zeilenzahl**. 400 Zeilen kosten dasselbe
wie 98. Die Kosten hängen am Sichtfeld, nicht am Datenbestand — das ist die
Eigenschaft, die ein Hero braucht, der beliebig viele Zeilen tragen soll.

Deshalb ist „nur sichtbare" jetzt der Default. Das ist kein Sparmodus: ein
Fallblatt, das niemand sieht, muss nicht klappern.

**Der Zielkonflikt, den `TIMING` austariert:** Eine lange Startspanne senkt die
Gleichzeitigkeit, verlängert aber die Gesamtdauer. Der erste Kalibrierversuch
drückte die Spitze auf 494, kostete aber 1 335 ms statt 790. Alle sechs
Parameter liegen jetzt in einer Konstante beieinander, damit die Abwägung an
einer Stelle sichtbar ist.

### Und dabei ist die Gestaltung mitgelöst worden

Die Zeilenwelle war als Maßnahme gegen die Compositor-Spitze gedacht. Sie hat
aber das Board erst richtig gemacht: Statt eines Blocks, der auf einen Schlag
umspringt, läuft jetzt **eine Bewegung von oben nach unten durch die Anzeige**,
über der die einzelnen Zeichen mechanisch klappern. Zwei Ebenen, die sich
überlagern — genau das tut ein echtes Solari-Board.

`TIMING.row` ist damit kein Performance-Parameter, sondern der Träger der
Signatur. Wer daran dreht, ändert nicht die Auslastung, sondern den Charakter
der Anzeige. Beim Portieren nach Svelte darf dieser Wert nicht als
Optimierungs-Detail wegrationalisiert werden.

## 3. Der Bug, der wichtiger war als die Perf

Beim Testen blieb das Board in einem Zustand stehen, in dem die Namensspalte
schon die neue Sortierung zeigte und Family/Gzip noch die alte — `Accordion`
stand neben `form` und `52,4 kB`, richtig sind `layout` und `7,9 kB`. Zeile für
Zeile plausibel, komplett falsch.

Ausgelöst hatte es der pausierte Tab, aber der Mechanismus ist allgemein: jede
Unterbrechung mitten im Rollen — Tab-Wechsel, zweiter Klick, langsames Gerät —
hinterlässt gemischte Spalten. Auf einer Seite, deren These „nichts driftet"
ist, wäre das der denkbar schlechteste Bug.

**Gelöst durch:** `finalizeAll()` — bricht alle Animationen ab und setzt jeden
offenen Flap sofort auf sein Ziel. Läuft vor jedem neuen `paint()` und bei
`visibilitychange` auf `hidden`. Ein `generation`-Zähler macht abgelöste Loops
sofort wirkungslos.

**Verifiziert:** drei Sortierungen in direkter Folge plus `finalizeAll()`,
danach alle 98 Zeilen gegen die Datenquelle geprüft — 0 Abweichungen.

Das Prinzip, das die echte Implementierung übernehmen muss: *Die Animation ist
Dekoration über einem Zustand, der auch ohne sie stimmt — nicht der Weg, auf dem
der Zustand entsteht.*

## 3b. `will-change` auf 5 000 Elementen — leere Fläche beim Scrollen

Beim Scrollen im Board erschien kurz leere Fläche, die erst danach gefüllt
wurde. Ursache war `will-change: transform` auf **jedem** `.ch` — also auf rund
5 300 Elementen gleichzeitig.

`will-change` ist eine Ankündigung an den Browser, für das Element eine eigene
Compositing-Ebene vorzubereiten. Auf tausenden Elementen dauerhaft gesetzt,
zwingt es ihn, all diese Ebenen zu halten und beim Scrollen neu zu rastern —
genau der beobachtete Effekt.

**Regel für die Portierung:** `will-change` gehört auf `.ch.rolling`, also nur
auf die Zeichen, die im nächsten Moment tatsächlich animiert werden. Es ist eine
Ankündigung, keine Dauerauszeichnung. Verifiziert: 0 von 5 292 Flaps tragen die
Eigenschaft im Ruhezustand.

## 3c. Unsichtbare Scrollbar durch konkurrierende Deklarationen

Das Board hatte keine Scroll-Affordance — auch beim Hovern nicht. Grund: Es
waren `scrollbar-width: thin` und `scrollbar-color` gesetzt **und** die
`::-webkit-scrollbar`-Pseudoelemente. Sobald die Standard-Eigenschaften greifen,
ignoriert WebKit die Pseudoelemente, und macOS zeigt eine Overlay-Leiste, die
nur während des Scrollens erscheint — also keine Affordance für jemanden, der
noch nicht scrollt.

Nur die Pseudoelemente behalten ergibt eine klassische, dauerhaft sichtbare
Leiste (verifiziert: 11 px Breite werden belegt). Zusätzlich begrenzt
`width: fit-content` das Board auf seine Spaltenbreite — sonst lief der
Scrollcontainer bis zum Fensterrand und die Leiste klebte dort statt am Kasten.

In der echten Implementierung läuft der Scroll über den Container der
`Table`-Komponente; der Fix ist dort neu zu treffen. Der Befund gilt trotzdem:
eine Anzeige ohne sichtbare Leiste sagt nicht, dass sie weitergeht.

## 4. Was noch offen ist

- **Bildrate im Vordergrund messen.** `requestAnimationFrame` ruht in
  nicht-sichtbaren Tabs; über CDP steht der Tab auf `hidden`. Das HUD oben rechts
  misst echte Frames, längsten Frame und Budget-Überschreitungen — aber nur, wenn
  die Seite tatsächlich vorne liegt. Zwei Anläufe liefen deshalb in CDP-Timeouts.
- **Compositing im GPU-Prozess** ist in keiner Zahl hier enthalten. 2 084
  gleichzeitige Transform-Animationen sind für den Compositor nicht gratis; auf
  schwachen Geräten ist der Modus „pro Zelle" (eine Stufe je Zelle) der Fallback.
- **Animationsstart an Sichtbarkeit koppeln**, nicht an `load` — sonst steht die
  Eingangssequenz, wenn der Tab im Hintergrund geöffnet wurde.

## 7. Portierung nach Svelte — offener Bug

Der HTML-Prototyp ist konsistent (0 Abweichungen über drei Sortierungen). Die
Svelte-Fassung (`apps/docs/src/lib/landing/FlapBoard.svelte`) hat einen Fehler,
den der Prototyp nicht hatte:

**Die Engine läuft der Anzeige genau einen Schritt hinterher.** Nach einem Klick
auf eine Spaltenüberschrift tragen `aria-label` und `data-status` sofort die
neue Reihenfolge; die Flaps zeigen den Stand, den die Labels *vor* dem Klick
hatten. Messung an derselben Zelle über einen Klick hinweg:

| Zeitpunkt | `aria-label` | Flaps |
|---|---|---|
| vor dem Klick | ConfirmDialog | Button |
| direkt danach | ConfirmDialog | Button |
| +300 ms | **A2UIView** | **ConfirmDialog** |
| +2 300 ms | A2UIView | ConfirmDialog |

Reproduktion: `/test-fixtures/landing-board`, eine Spalte sortieren, dann
`aria-label` jeder `[role="gridcell"]` gegen den zusammengesetzten Text ihrer
Kinder vergleichen. Achtung beim Nachmessen: Die Felder starten mit `&nbsp;`
(U+00A0), das erzeugt ~57 Schein-Abweichungen — vor dem Vergleich
normalisieren, sonst misst man das eigene Prüfverfahren.

**Kein Timing-Problem:** Auch nach 3 Sekunden und bei einer einzelnen
Sortierung bleibt der Versatz.

Bereits ausgeschlossen:

1. *Der Effect läuft nicht.* Widerlegt — instrumentiert, er läuft je Klick genau
   einmal.
2. *`engine.destroy()` im Effect-Cleanup leert die Registrierung der
   Zeichenfelder.* War tatsächlich falsch (`{@attach}` meldet sie nicht neu an,
   weil die Elemente bestehen bleiben) und ist behoben — der Versatz blieb.
3. *Der `onselect`-Effect schreibt Parent-State während der Effect-Phase und
   stört deren Reihenfolge.* Umgebaut auf einen direkten Aufruf aus dem
   Click-Handler — der Versatz blieb.
4. *Das `sorted`-Derived ist im Effect veraltet.* Der Effect rechnet die
   Sortierung inzwischen selbst aus `sortKey`/`sortDir` — der Versatz blieb.

Nächster Verdacht, noch ungeprüft: die Reihenfolge von `{@attach}` gegenüber
`$effect`. Registrieren sich die Zeichenfelder nach dem Effect-Durchlauf neu,
greift `update()` ins Leere und der sichtbare Stand bleibt der vorherige. Zu
prüfen mit einem Zähler in `register()`.

## 5. Datenlücken für die echte Seite

1. **Die `STATUS`-Spalte hat keine Quelle.** Der docs-gen-Katalog führt kein
   `stability`-Feld; der Prototyp rät über eine Namensliste (`BETA` in
   `gen-data.ts`). Ohne JSDoc-Tag → docs-gen ist die Roadmap-in-der-Statusspalte
   handgepflegt und driftet — auf einer Seite, die mit Nicht-Driften wirbt.

2. **Die `GZIP`-Spalte deckt nur `blocks` ab.** 25 von 98 Zeilen zeigen „—",
   weil `bundle-size.baseline.json` `table` und `auth` nicht kennt. Entweder
   Baselines für die anderen Pakete erzeugen oder die Spalte anders schneiden.

3. **`A2UIView` steht mit 93,8 kB als größter Wert im Board**, sobald nach Größe
   sortiert wird. Der Wert stimmt (der Katalog zieht viele Komponenten statisch
   ein), ist aber auf einem Board, das Leichtigkeit verkauft, ein Kontrapunkt in
   Zeile 1. Entweder erklären oder die Spalte anders schneiden.

## 6. Erledigt seit dem ersten Durchgang

- Spaltenbreiten kommen aus den Daten statt geraten zu sein — „ReasoningDisclosu"
  war abgeschnitten, ein Board, das Namen kürzt, lügt.
- Überschriften rechtsbündiger Spalten stehen über ihren Werten.
- `.ch.rolling` trägt kein eigenes `transform` mehr: neben der Web-Animation
  hätte es nach deren Ende einen Rücksprung erzeugt.
