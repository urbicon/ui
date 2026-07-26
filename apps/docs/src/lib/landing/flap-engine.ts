/**
 * Die Fallblatt-Mechanik des Landing-Boards.
 *
 * Bewusst imperativ und außerhalb der Reaktivität: Ein Board hat rund 5 000
 * Zeichenfelder, und jedes davon als eigenen `$state` zu führen wäre um
 * Größenordnungen teurer als `textContent` direkt zu setzen. Svelte rendert die
 * Struktur einmal; diese Klasse bespielt sie.
 *
 * Zwei Ebenen, bewusst getrennt (siehe prototypes/landing-board/BEFUNDE.md):
 *
 *   Bewegung  → eine Web-Animation je Zeichen (`transform: scaleY`).
 *               Läuft im Compositor, kostet den Main-Thread nichts.
 *   Zeichen   → ein einziger rAF-Loop, der die Wechsel an den Minima der
 *               Klappbewegung timet.
 *
 * Eine frühere Fassung schrieb `textContent` einmal pro Alphabet-Schritt — bis
 * zu 69-mal je Zeichen — und brauchte 5–7 Sekunden statt 800 ms.
 */

/** Solari-Zeichenvorrat. Das Board rollt nur vorwärts, wie ein echtes. */
const ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.—+kB';
const IDX = new Map([...ALPHABET].map((c, i) => [c, i]));
const N = ALPHABET.length;

/**
 * Der Zielkonflikt: Eine lange Startspanne senkt die Zahl gleichzeitiger
 * Animationen (Compositor-Last), verlängert aber die Gesamtdauer. Kalibriert
 * auf ~800 ms im Sichtfeld bei einer Spitze um 600 — darüber wurde es zäh.
 *
 * `row` trägt die Signatur des Boards: die Welle, die von oben nach unten durch
 * die Anzeige läuft. Kein Performance-Detail — ohne sie springt das Board als
 * Block um, statt zu laufen.
 */
export const TIMING = {
  tick: 8,
  row: 0.8,
  char: 0.5,
  col: 1.5,
  base: 160,
  perStage: 78,
  cellBase: 330
} as const;

export type FlapMode = 'flap' | 'cell' | 'off';

interface CharState {
  el: HTMLElement;
  cur: string;
  target: string;
  pending: boolean;
  dist: number;
  delay: number;
  stages: number;
  startAt: number;
  dur: number;
  done: number;
}

export interface FlapColumn<T> {
  key: string;
  label: string;
  width: number;
  align: 'l' | 'r';
  format?: (row: T) => string;
}

export class FlapEngine<T> {
  #chars = new Map<string, CharState>();
  #rolling: CharState[] = [];
  #liveAnims: Animation[] = [];
  #generation = 0;
  #rows: T[] = [];
  #columns: FlapColumn<T>[] = [];
  #mode: FlapMode = 'flap';
  #reduced = false;
  /** Zeilenfenster, das animiert wird — außerhalb wird sofort gesetzt. */
  #visible: [number, number] = [0, Number.POSITIVE_INFINITY];

  constructor(columns: FlapColumn<T>[]) {
    this.#columns = columns;
    if (typeof matchMedia === 'function') {
      this.#reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  /** Wird von `{@attach}` je Zeichenfeld aufgerufen. */
  register(row: number, col: number, index: number, el: HTMLElement): () => void {
    const key = `${row}:${col}:${index}`;
    this.#chars.set(key, {
      el,
      cur: ' ',
      target: ' ',
      pending: false,
      dist: 0,
      delay: 0,
      stages: 1,
      startAt: 0,
      dur: 0,
      done: 0
    });
    return () => this.#chars.delete(key);
  }

  setMode(mode: FlapMode): void {
    this.#mode = mode;
  }

  setVisibleRange(from: number, to: number): void {
    this.#visible = [from, to];
  }

  /**
   * Setzt die Daten und spielt den Übergang. `instant` überspringt die
   * Animation — für den ersten Aufbau und für alles, was der Nutzer nicht als
   * Bewegung sehen soll.
   */
  update(rows: T[], instant = false): void {
    // Erst alles Laufende sauber abschließen, sonst schreibt ein alter Lauf
    // noch in Zellen, die längst zur neuen Sortierung gehören.
    this.finalize();
    this.#rows = rows;

    const [visFrom, visTo] = this.#visible;
    const skip = instant || this.#mode === 'off' || this.#reduced;

    for (let r = 0; r < rows.length; r++) {
      const inView = r >= visFrom && r < visTo;
      for (let ci = 0; ci < this.#columns.length; ci++) {
        const col = this.#columns[ci];
        const text = this.#cellText(rows[r], col);
        for (let k = 0; k < col.width; k++) {
          const st = this.#chars.get(`${r}:${ci}:${k}`);
          if (!st) continue;
          const target = text[k] ?? ' ';
          if (st.cur === target) continue;

          if (skip || !inView) {
            this.#set(st, target);
            continue;
          }

          st.target = target;
          st.pending = true;
          const rowDelay = (r - visFrom) * TIMING.row;
          if (this.#mode === 'cell') {
            st.dist = 1;
            st.delay = rowDelay + ci * TIMING.col;
          } else {
            const from = IDX.get(st.cur) ?? 0;
            const to = IDX.get(target) ?? 0;
            st.dist = (to - from + N) % N || N;
            st.delay = rowDelay + k * TIMING.char + ci * TIMING.col;
          }
          this.#rolling.push(st);
        }
      }
    }

    if (this.#rolling.length && !skip) this.#start();
  }

  /**
   * Bringt das Board sofort in seinen Zielzustand und bricht alles Laufende ab.
   *
   * Muss vor jedem neuen `update()` und beim Verlassen des Tabs laufen: Eine
   * halb gerollte Zeile zeigt sonst die Family der einen und den Gzip-Wert der
   * anderen Sortierung — zeilenweise plausibel und komplett falsch. Die
   * Animation ist Dekoration über einem korrekten Zustand, nicht der Weg, auf
   * dem er entsteht.
   */
  finalize(): void {
    this.#generation++;
    for (const a of this.#liveAnims) {
      try {
        a.cancel();
      } catch {
        /* bereits beendet */
      }
    }
    this.#liveAnims = [];
    for (const st of this.#rolling) if (st.pending) this.#set(st, st.target);
    this.#rolling = [];
  }

  destroy(): void {
    this.finalize();
    this.#chars.clear();
  }

  #cellText(row: T, col: FlapColumn<T>): string {
    const raw = col.format ? col.format(row) : String((row as Record<string, unknown>)[col.key]);
    return col.align === 'r' ? raw.padStart(col.width) : raw.padEnd(col.width);
  }

  // `classList` statt `className`: Ein direktes Überschreiben würde Sveltes
  // Scoping-Klasse (`svelte-xxxxx`) mitentfernen und das komplette Styling der
  // Zelle aushebeln.
  #set(st: CharState, target: string): void {
    st.cur = target;
    st.pending = false;
    st.el.textContent = target;
    st.el.classList.toggle('blank', target === ' ');
    st.el.classList.remove('rolling');
  }

  /** Wie viele Zwischenzeichen ein Flap zeigt — weite Wege klappern länger. */
  #stagesFor(st: CharState): number {
    if (this.#mode === 'cell') return 1;
    return Math.max(1, Math.min(5, Math.round(st.dist / 12)));
  }

  #start(): void {
    const gen = ++this.#generation;
    const active = this.#rolling;

    for (const st of active) {
      st.stages = this.#stagesFor(st);
      st.startAt = st.delay * TIMING.tick;
      st.dur =
        (this.#mode === 'cell' ? TIMING.cellBase : TIMING.base) + st.stages * TIMING.perStage;
      st.done = 0;

      // Ein Klappern je Stufe: voll → flach (dort wechselt das Zeichen) → voll.
      const kf: Keyframe[] = [{ transform: 'scaleY(1)', offset: 0 }];
      for (let s = 0; s < st.stages; s++) {
        kf.push({ transform: 'scaleY(0.06)', offset: (2 * s + 1) / (2 * st.stages) });
        kf.push({ transform: 'scaleY(1)', offset: (2 * s + 2) / (2 * st.stages) });
      }
      this.#liveAnims.push(
        st.el.animate(kf, { duration: st.dur, delay: st.startAt, easing: 'ease-in-out' })
      );
      // `.rolling` trägt `will-change` — und NUR hier: Stünde es dauerhaft auf
      // allen ~5 000 Feldern, hielte der Browser für jedes eine eigene
      // Compositing-Ebene und müsste sie beim Scrollen neu rastern, sichtbar
      // als kurz leere Fläche.
      st.el.classList.add('rolling');
    }

    const t0 = performance.now();
    const tick = (now: number): void => {
      if (gen !== this.#generation) return; // abgelöst — dieser Lauf ist tot
      const t = now - t0;
      let alive = 0;

      for (const st of active) {
        if (!st.pending) continue;
        const local = t - st.startAt;
        if (local < 0) {
          alive++;
          continue;
        }
        // Alle fälligen Stufen nachholen: Auch wenn Frames ausgefallen sind,
        // landet das Zeichen dadurch nie zu spät auf seinem Ziel.
        while (st.done < st.stages && local >= (st.dur * (2 * st.done + 1)) / (2 * st.stages)) {
          st.done++;
          if (st.done >= st.stages) {
            this.#set(st, st.target);
          } else {
            const from = IDX.get(st.cur) ?? 0;
            const jump = Math.max(1, Math.round(st.dist / st.stages));
            st.cur = ALPHABET[(from + jump) % N];
            st.el.textContent = st.cur;
          }
        }
        if (st.pending) alive++;
      }

      if (alive > 0) requestAnimationFrame(tick);
      else {
        this.#rolling = [];
        this.#liveAnims = [];
      }
    };
    requestAnimationFrame(tick);
  }
}
