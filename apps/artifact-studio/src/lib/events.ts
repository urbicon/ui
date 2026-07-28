/**
 * events.ts — was der Server während eines Turns über die Leitung schickt.
 *
 * Ein Turn ist nicht ein Request-Response, sondern eine Folge von Ereignissen:
 * das Modell recherchiert (CLI-Aufrufe), schreibt (Edits), wird geprüft (Lint),
 * das Ergebnis wird gebaut. Wer nur das Endergebnis sieht, wartet 40 Sekunden
 * vor einem leeren Bildschirm — deshalb geht jeder Schritt sofort raus.
 *
 * Transport ist NDJSON über einen `fetch`-Stream, nicht SSE: der Wunsch geht per
 * POST hin (`EventSource` kann nur GET), und ein Zeilen-JSON braucht kein
 * Protokoll drumherum.
 */

export interface LintFinding {
  ruleId: string;
  severity: string;
  message: string;
  fix: string;
  line?: number;
}

export interface LintReport {
  findings: LintFinding[];
  counts: { error: number; warning: number; info: number };
  scores: { correctness: number; slop: number };
}

/** Eine fertige Version — das, was der Player als Chip zeigt. */
export interface VersionInfo {
  n: number;
  /** Der Wunsch, der zu ihr geführt hat. */
  prompt: string;
  /** Das Sandbox-Dokument, absolute URL auf der zweiten Origin. */
  frameUrl: string;
  code: string;
  lint: LintReport;
  /** Wie lange Modell-Lauf und Build zusammen gedauert haben. */
  durationMs: number;
  buildMs: number;
  costUsd: number;
}

export type StudioEvent =
  /** Ein Turn beginnt. `kind: 'fix'` heißt: der Linter hat etwas beanstandet. */
  | { type: 'turn:start'; kind: 'user' | 'fix'; instruction: string }
  /** Modell-Prosa im Klartext, so wie sie ankommt. */
  | { type: 'text'; text: string }
  /** Das Modell hat die CLI befragt. */
  | { type: 'cli'; args: string[]; outputBytes: number; durationMs: number }
  /** Das Modell hat die Arbeitsdatei geändert. */
  | {
      type: 'edit';
      command: string;
      ok: boolean;
      oldBytes: number;
      newBytes: number;
      fileBytes: number;
      error?: string;
    }
  /** Der Linter hat den Stand nach dem Turn bewertet. */
  | { type: 'lint'; report: LintReport; compileError?: string }
  /** Der Vite-Build läuft — der Teil, der nach dem Modell noch dauert. */
  | { type: 'build:start' }
  /** Fertig: die Version steht und kann angezeigt werden. */
  | { type: 'version'; version: VersionInfo }
  /**
   * Der Turn ist zu Ende. `versions` ist der volle Stand danach — der Client
   * muss ihn nicht aus Einzelereignissen zusammensetzen.
   */
  | { type: 'done'; durationMs: number; costUsd: number }
  /** Abbruch mit Grund. Nichts wird stillschweigend verschluckt. */
  | { type: 'error'; message: string };

/** Der Zustand einer Sitzung, wie ihn der Client beim Laden bekommt. */
export interface SessionState {
  id: string;
  title: string;
  model: string;
  effort: string;
  createdAt: string;
  versions: VersionInfo[];
  /** Läuft gerade ein Turn? Ein zweiter parallel wäre ein Datenrennen. */
  busy: boolean;
}
