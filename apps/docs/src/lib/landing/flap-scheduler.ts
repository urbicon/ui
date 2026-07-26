/**
 * Geteilter Taktgeber für alle Fallblatt-Zellen.
 *
 * Die Zellen sind autonom — jede blättert auf ihren eigenen Wert, ohne zu
 * wissen, wo sie steht. Damit ist ihnen egal, ob die Tabelle sie verschiebt,
 * neu erzeugt oder stehen lässt; genau deshalb lässt sich die echte `Table`
 * darunter verwenden. Der Taktgeber existiert nur, weil 490 eigene
 * `requestAnimationFrame`-Schleifen Unsinn wären.
 *
 * Zwei Ebenen, bewusst getrennt (Herleitung in
 * prototypes/landing-board/BEFUNDE.md):
 *
 *   Bewegung  → eine Web-Animation je Zeichen (`transform: scaleY`), im
 *               Compositor, kostet den Main-Thread nichts.
 *   Zeichen   → dieser eine rAF-Loop, getimt auf die Minima der Klappbewegung.
 */

/** Solari-Zeichenvorrat. Das Board rollt nur vorwärts, wie ein echtes. */
const ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.—+kB';
const IDX = new Map([...ALPHABET].map((c, i) => [c, i]));
const N = ALPHABET.length;

/**
 * Der Zielkonflikt: Eine lange Startspanne senkt die Zahl gleichzeitiger
 * Animationen (Compositor-Last), verlängert aber die Gesamtdauer. Kalibriert
 * auf ~800 ms bei einer Spitze um 600.
 *
 * `row` trägt die Signatur: die Welle, die von oben nach unten durch die
 * Anzeige läuft. Kein Performance-Detail — ohne sie springt das Board als
 * Block um, statt zu laufen.
 */
export const TIMING = {
  tick: 8,
  row: 0.8,
  char: 0.5,
  base: 160,
  perStage: 78
} as const;

interface CharJob {
  el: HTMLElement;
  cur: string;
  target: string;
  dist: number;
  stages: number;
  startAt: number;
  dur: number;
  done: number;
  pending: boolean;
}

interface CellJob {
  /** Zellcontainer — nur zur Gruppierung nach Zeile. */
  host: HTMLElement;
  chars: CharJob[];
}

let batch: CellJob[] = [];
let flushQueued = false;
let running: CharJob[] = [];
let liveAnims: Animation[] = [];
let generation = 0;

const reduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Setzt ein Zeichen ohne Bewegung auf seinen Zielwert. */
function settle(job: CharJob): void {
  job.cur = job.target;
  job.pending = false;
  job.el.textContent = job.target === ' ' ? ' ' : job.target;
  // `classList` statt `className`: Ein Überschreiben würde Sveltes
  // Scoping-Klasse mitentfernen und das Styling der Zelle aushebeln.
  job.el.classList.toggle('blank', job.target === ' ');
  job.el.classList.remove('rolling');
}

/**
 * Bringt alles Laufende sofort auf seinen Zielwert und bricht ab.
 *
 * Nötig vor jeder neuen Welle und beim Verlassen des Tabs: Eine halb gerollte
 * Anzeige zeigt sonst die Family der einen und den Gzip-Wert der anderen
 * Sortierung — zeilenweise plausibel und komplett falsch. Die Animation ist
 * Dekoration über einem korrekten Zustand, nicht der Weg, auf dem er entsteht.
 */
export function finalizeAll(): void {
  generation++;
  for (const a of liveAnims) {
    try {
      a.cancel();
    } catch {
      /* bereits beendet */
    }
  }
  liveAnims = [];
  for (const job of running) if (job.pending) settle(job);
  running = [];
}

/**
 * Meldet eine Zelle zum Blättern an. Aufrufe innerhalb desselben Ticks werden
 * zu einer Welle gebündelt — nur so lässt sich die Staffelung über die Zeilen
 * legen, ohne dass die Zelle ihre eigene Position kennen muss.
 */
export function rollCell(host: HTMLElement, chars: HTMLElement[], target: string): void {
  const jobs: CharJob[] = chars.map((el, k) => {
    const cur = el.dataset.ch ?? ' ';
    const to = target[k] ?? ' ';
    return {
      el,
      cur,
      target: to,
      dist: (IDX.get(to)! - IDX.get(cur)! + N) % N || N,
      stages: 1,
      startAt: 0,
      dur: 0,
      done: 0,
      pending: cur !== to
    };
  });

  for (const j of jobs) j.el.dataset.ch = j.target;

  if (reduced()) {
    for (const j of jobs) if (j.pending) settle(j);
    return;
  }

  batch.push({ host, chars: jobs });
  if (!flushQueued) {
    flushQueued = true;
    // Microtask, nicht rAF: Alle Zellen, die im selben Durchlauf ihren Wert
    // bekommen, sollen in einer Welle landen — auch die, die erst später im
    // Baum liegen.
    queueMicrotask(flush);
  }
}

function flush(): void {
  flushQueued = false;
  const wave = batch;
  batch = [];
  if (!wave.length) return;

  finalizeAll();
  const gen = ++generation;

  // Zeilenstaffelung, ohne dass die Zelle ihre Position kennt: Zellen melden
  // sich in DOM-Reihenfolge an, also ist die Reihenfolge der erstmals
  // gesehenen Zeilen die Zeilenreihenfolge.
  const rowIndex = new Map<Element, number>();
  const active: CharJob[] = [];

  for (const cell of wave) {
    const row = cell.host.closest('tr') ?? cell.host.parentElement ?? cell.host;
    if (!rowIndex.has(row)) rowIndex.set(row, rowIndex.size);
    const rowDelay = rowIndex.get(row)! * TIMING.row;

    for (let k = 0; k < cell.chars.length; k++) {
      const job = cell.chars[k];
      if (!job.pending) continue;
      // Wie viele Zwischenzeichen: weite Wege klappern länger.
      job.stages = Math.max(1, Math.min(5, Math.round(job.dist / 12)));
      job.startAt = (rowDelay + k * TIMING.char) * TIMING.tick;
      job.dur = TIMING.base + job.stages * TIMING.perStage;
      job.done = 0;

      // Ein Klappern je Stufe: voll → flach (dort wechselt das Zeichen) → voll.
      const kf: Keyframe[] = [{ transform: 'scaleY(1)', offset: 0 }];
      for (let s = 0; s < job.stages; s++) {
        kf.push({ transform: 'scaleY(0.06)', offset: (2 * s + 1) / (2 * job.stages) });
        kf.push({ transform: 'scaleY(1)', offset: (2 * s + 2) / (2 * job.stages) });
      }
      liveAnims.push(
        job.el.animate(kf, { duration: job.dur, delay: job.startAt, easing: 'ease-in-out' })
      );
      // `.rolling` trägt `will-change` — und nur solange wirklich animiert
      // wird. Dauerhaft auf tausenden Feldern hielte der Browser für jedes eine
      // eigene Compositing-Ebene und müsste sie beim Scrollen neu rastern,
      // sichtbar als kurz leere Fläche.
      job.el.classList.add('rolling');
      active.push(job);
    }
  }

  if (!active.length) return;

  // Ist der Tab schon unsichtbar, wenn die Welle startet, feuert kein
  // `visibilitychange` mehr — und `requestAnimationFrame` ruht. Ohne diesen
  // Zweig bliebe die Anzeige auf der vorherigen Sortierung stehen, während die
  // Beschriftungen bereits die neue tragen: zeilenweise plausibel und
  // vollständig falsch. Also gar nicht erst animieren, sondern sofort stellen.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    for (const job of active) settle(job);
    return;
  }

  running = active;

  const t0 = performance.now();
  const tick = (now: number): void => {
    if (gen !== generation) return; // abgelöst — diese Welle ist tot
    const t = now - t0;
    let alive = 0;

    for (const job of active) {
      if (!job.pending) continue;
      const local = t - job.startAt;
      if (local < 0) {
        alive++;
        continue;
      }
      // Alle fälligen Stufen nachholen: Auch bei ausgefallenen Frames landet
      // das Zeichen nie zu spät auf seinem Ziel.
      while (job.done < job.stages && local >= (job.dur * (2 * job.done + 1)) / (2 * job.stages)) {
        job.done++;
        if (job.done >= job.stages) {
          settle(job);
        } else {
          const from = IDX.get(job.cur) ?? 0;
          const jump = Math.max(1, Math.round(job.dist / job.stages));
          job.cur = ALPHABET[(from + jump) % N];
          job.el.textContent = job.cur === ' ' ? ' ' : job.cur;
        }
      }
      if (job.pending) alive++;
    }

    if (alive > 0) requestAnimationFrame(tick);
    else {
      running = [];
      liveAnims = [];
    }
  };
  requestAnimationFrame(tick);
}

// rAF und Web-Animationen ruhen in unsichtbaren Tabs, aber nicht synchron.
// Statt eine halb gerollte Anzeige zurückzulassen: sofort finalisieren.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finalizeAll();
  });
}
