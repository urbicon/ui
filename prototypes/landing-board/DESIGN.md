# Board — Typografie und Farbe (Vorschlag, 2026-07-26)

Im Prototyp umschaltbar: Livery und Flap-Schrift oben in der Reglerleiste.

## Typografie: zwei Stimmen, klar getrennt

| Rolle | Schrift | Warum |
|---|---|---|
| **Flaps** (das Board) | **Martian Mono**, `font-stretch: 100%`, 12 px | Feste Breite ist hier keine Stilfrage, sondern Bedingung — jede Position ist eine Klappe. Martian Mono ist technisch gezeichnet und liest sich als Anzeigesystem, nicht als Editor. |
| **Redaktion** (Claim, Fließtext) | **Archivo**, Variable 100–900 | Grotesk mit echtem Signage-Erbe (amerikanische Beschilderung), hohe x-Höhe, trägt bei 9 px genauso wie bei 50 px. |
| **Meta** (Spaltenköpfe, Labels) | Archivo 600, 9,5–11 px, `letter-spacing: .2em`, Versalien | Hinweisschild-Register: klein, gesperrt, zurückgenommen. |
| **Code** (CLI, Gate) | JetBrains Mono | Bleibt dem vorbehalten, was wirklich Code ist. |

**Warum nicht JetBrains Mono für die Flaps** (bisheriger Stand): Sie ist eine
Editor-Schrift und sagt „Terminal". Ein Abflugbrett ist kein Terminal.

**Warum nicht Archivo für die Flaps**, obwohl echte Solari-Boards proportionale
Grotesk verwenden: Bei `width: 1ch` je Zeichen werden breite Buchstaben
gequetscht — `ThemeSwitcher` und `TwoFactorManager` zeigen es deutlich. Ein
echtes Board löst das mit eigens gezeichneten schmalen Versalien; mit einer
Webfont-Grotesk müssten die Boxen so breit werden, dass `i` und `l` in Luft
schwimmen. Im Prototyp umschaltbar — der Unterschied ist sofort sichtbar.

`Anybody` liegt als dritte Option bei: extremere Width-Achse, futuristischer.
Eher zu viel Charakter für eine Fläche, die 98 Zeilen trägt.

**Einschränkung, die den Plan verändert hat:** Fontsource liefert Weight und
Width als getrennte Dateien; beide Achsen zusammen gibt es nicht. Der geplante
Kontrast „ultra-condensed Flaps ↔ expanded Headline aus einer Familie" ist damit
nicht umsetzbar. Der typografische Kontrast kommt jetzt aus **Größe und
Sperrung** statt aus Breite — was zum Signage-Register ohnehin besser passt: ein
Bahnhof arbeitet mit Größenstufen, nicht mit Breitengraden.

## Farbe: ein Objekt, kein Interface

```
--deck     #0d100f   hinter dem Board — dunkler als die Blätter
--flap     #1b1f1d   untere Flap-Hälfte
--flap-hi  #1f2321   obere Hälfte, fängt Licht
--seam     #151917   die Kante in der Mitte
--bone     #e7e3d7   Beschriftung
--dim      #8d918b   Sekundärtext (6,1:1 auf dem Deck)
```

### Der Naht-Befund

Die erste Fassung setzte die Naht auf `#070908` und die Hälften weit
auseinander. Das Ergebnis: Die Nähte aller Zellen einer Zeile verbanden sich zu
**einem durchgehenden schwarzen Band**, und jede Zeile zerfiel optisch in zwei
Streifen — die horizontale Gliederung des Boards überlagerte seine eigentliche,
zeilenweise. Werte deutlich zusammengezogen: Ein echter Flap hat eine Kante,
keine Fuge.

Kein Reinschwarz und kein Reinweiß. Ein Flap ist mattes Kunststoff mit
bedruckter Fläche; das Anthrazit trägt einen minimalen Grünstich, die Schrift
ist knochenfarben — bedruckte Blätter vergilben. Das Deck liegt dunkler als die
Blätter, damit sie darauf *aufliegen* statt in der Fläche zu verschwinden.

Der Flap-Verlauf (hell oben, Naht, dunkler unten) ist der ganze Unterschied
zwischen „Tabelle" und „Blatt" — drei Farbwerte statt eines Kastens.

Leere Positionen bleiben Blätter, nur unbeschriftet (`opacity: .55`). Ein Board
hat auch dort eine Klappe, wo nichts steht.

### Der Kontrast-Befund

`--dim` lag zuerst bei `#747873` — 4,3:1 und damit unter dem Minimum für
Fließtext. Auf `#8d918b` angehoben (6,1:1). Auf einer Seite, die von Sorgfalt
handelt, ist Kontrast keine Geschmacksfrage.

## Livery: die Farbe erscheint genau einmal

| Kanal | Wert | Herkunft |
|---|---|---|
| **Halle** | `#e8a33d` | Bernstein der Bahnhofshalle — die klassische Anzeigenfarbe |
| **Radar** | `#3fa9a0` | Petrol, Nachtflug und Radarschirm |
| **Linie** | `#9d7ae0` | Transit-Violett, wie es moderne Metro-Linien führen |

Drei Kanäle, die je eine Signage-Tradition zitieren statt drei hübsche Paletten
zu sein. Rot ist bewusst nicht dabei: Die Farbe steht auf einer Null, und eine
rote Null liest sich als Fehler.

**Die eigentliche Setzung:** Die Livery-Farbe erscheint im ganzen Board an
**genau einer Stelle** — auf den 98 Nullen der `DEPS`-Spalte. Eine Farbsäule,
98 Zeilen hoch. Alles andere ist knochenweiß und grau; auch `beta` und
`in progress` weichen nur in der Helligkeit ab, nicht in der Farbe.

Und dieselbe Farbe ist die `--color-primary` der echten Komponenten im
Specimen-Panel daneben. Ein Kanalwechsel färbt beides gemeinsam: **die Signatur
ist zugleich der Theming-Beweis.** Der Palette-Switcher aus der alten Landing
lebt damit weiter, aber nicht mehr als eigener Abschnitt — er sitzt im Hero und
tut dort etwas.

## Das Board scrollt in sich selbst

Feste Bauhöhe (`#rows-host`, `height: min(46vh, 560px)`), eigener Scroll, die
letzte Zeile läuft über einen Verlauf aus. Das Board ist ein Objekt mit fester
Größe, kein Dokument: Gescrollt wird *im* Board, nicht an ihm vorbei.

Praktischer Grund: Vorher musste man die Seite scrollen, um den Claim zu sehen —
er stand faktisch unter der Falz und damit außerhalb des Hero.

Nebeneffekt für die Animation: `firstVisibleRow()` liest jetzt `hostEl.scrollTop`
statt der Seitenposition. Das ist auch die sauberere Rechnung — der sichtbare
Ausschnitt ist damit exakt bestimmt, nicht geschätzt.

## Der Claim steht unter dem Board

> **Everything in it was made *in it*.**
> That is why the deps column reads zero, ninety-eight times. No supply chain,
> nothing to audit, nothing that can drift out from under you.

Erst der Beweis, dann der Satz. Die Spalte mit den Nullen hat ihn schon gesagt;
die Zeile benennt nur noch, was man gesehen hat. Deshalb ist sie
Bildunterschrift und nicht Überschrift — und deshalb steht above the fold
überhaupt keine Marketingzeile, sondern ein arbeitendes Board.

Das kursive `in it` trägt die Livery-Farbe — die einzige farbige Stelle
außerhalb der Null-Säule.

## Das Specimen-Panel

Rechts neben dem Board, gleiche Höhe, warmes Papierweiß (`#f4f2ed`) — dieselbe
Temperatur wie das Knochenweiß der Flaps, nur andersherum. Board = Objekt,
Panel = Software; der Kontrast zwischen beiden trägt die Komposition.

Aufbau: Name groß (Archivo 800), darunter die Metazeile aus dem Katalog
(`display · 14.6 kB · shipped`), dann die Bühne mit dem Specimen, darunter die
Import-Zeile in JetBrains Mono.

**Vorausgewählt ist Sankey.** Die Frage „ihr shipped WAS umsonst?" gehört in die
erste Sekunde, nicht auf Platz 40 einer alphabetischen Liste.

**Die Markierung hängt am Namen, nicht an der Bildschirmposition.** Nach einer
Sortierung steht an Position 5 eine andere Komponente — die Markierung wandert
mit ihrer Zeile mit. Verifiziert: Sankey rutscht beim Sortieren nach Größe auf
Index 49, die Markierung sitzt auf 49.

**Der Livery-Durchgriff ist verifiziert.** Null-Säule im Board, Specimen im Panel
und das hervorgehobene Wort im Claim tragen denselben berechneten Farbwert —
ein Kanalwechsel färbt alle drei gemeinsam.

### Einschränkung

Die Specimen sind **maßstabsgetreue Platzhalter, keine echten Komponenten** —
dieser Prototyp ist reines HTML ohne Svelte. Sie beantworten Proportion, Dichte
und Farbdurchgriff. Ob Sankey und Planner in Sekunde eins wirken, entscheidet
sich erst mit den echten Komponenten bei der Portierung.

Eine Lehre gilt trotzdem schon: **Die Familie allein reicht nicht zur Auswahl
des Specimens.** Sankey trägt im Katalog `display` und bekam deshalb zuerst die
Liniendiagramm-Skizze. Gerade die Schwergewichte müssen als sie selbst erkennbar
sein, sonst weckt das Panel falsche Erwartungen — es braucht eine Zuordnung je
Komponente, nicht je Familie.

## Offen
- **Die Signage-Kopfzeile über dem Board** (`URBICON UI · THE SET · 97 SHIPPED`)
  ist noch die Prototyp-Titelzeile.
- **Light Mode:** Vorschlag ist, dass das Board *immer dunkel* bleibt — es ist
  ein Objekt, kein Interface. Das Panel und der Rest der Seite schalten. Der
  Kontrast zwischen beiden ist dann Teil der Komposition: Hardware neben
  Software. Das ist eine Setzung, die bestätigt werden sollte.
- Ob `Anybody` als Flap-Schrift eine ernsthafte Alternative ist, entscheidet
  sich am besten im Vergleich am Bildschirm.
