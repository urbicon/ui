/**
 * session.ts — eine Artefakt-Sitzung: beschreiben, sehen, weiterreden.
 *
 * Der Loop selbst ist der aus `prototypes/artifact-frame/recorder/record.ts`,
 * aber an einer Stelle grundsätzlich anders geschnitten: dort läuft er einmal
 * mit allen Wünschen von der Kommandozeile durch und schreibt am Ende ein
 * Fixture. Hier lebt er zwischen den Wünschen weiter — jemand sitzt davor und
 * entscheidet den nächsten erst, wenn er den vorigen gesehen hat. Das ist die
 * Feedback-Schleife aus ARTEFAKTE §4.3, und sie ist der ganze Punkt von Strang 1.
 *
 * Zwei Dinge folgen daraus:
 *
 *  - **Der Turn ist ein Ereignisstrom, kein Rückgabewert.** 40 Sekunden vor
 *    einem leeren Bildschirm sind kein Produkt; CLI-Aufrufe, Edits und der Lint
 *    gehen sofort raus (`StudioEvent`).
 *  - **Der Zustand liegt auf der Platte.** Der Dev-Server startet bei jeder
 *    Codeänderung neu — eine Sitzung, die das nicht überlebt, wäre beim Bauen
 *    an ihr selbst unbenutzbar.
 *
 * Der Patch-Modus ist hier nicht optional, sondern der einzige Modus: 37 s je
 * Wunsch gegen 87 s im Volltext-Pfad (BEFUNDE §19/§20). Für ein Fixture ist das
 * gleichgültig, für eine Oberfläche ist es der Unterschied.
 */

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { lintDesign } from '@urbicon-ui/design-engine/linter';
import { compile } from 'svelte/compiler';
import type { LintReport, SessionState, StudioEvent, VersionInfo } from '../events';
import type { BuildResult } from './build-version';
import { runUrbicon, URBICON_TOOL } from './cli-tool';
import { costOf, type TurnUsage } from './cost';
import { ArtifactFile, EDITOR_TOOL } from './editor-tool';
import { buildSystemPrompt } from './grounding';
import {
  ARTIFACT_FILENAME,
  ARTIFACTS_DIR,
  absoluteArtifactPath,
  REPO_ROOT,
  sessionDir
} from './paths';

/**
 * Sonnet 5 auf `high` ist der gemessene Sweet Spot (BEFUNDE §14/§16), nicht eine
 * Sparentscheidung: gegenüber Opus 5 halber Preis, zwei Drittel der Zeit,
 * dieselben Lint-Werte — und bei der Iteration, die die Artefakt-Erfahrung
 * ausmacht, **87 s gegen 186 s**. Opus' Mehrwert ist Fülle (mehr Detail, mehr
 * Erfundenes), und die ist hier eher Last.
 */
const DEFAULT_MODEL = 'claude-sonnet-5';
const DEFAULT_EFFORT = 'high';
const MAX_FIX_ROUNDS = 2;
/**
 * Backstop gegen Endlosschleifen, nicht die inhaltliche Grenze. Er lag einmal
 * bei 20 und griff mitten in einem legitimen ersten Wurf: 34 CLI-Aufrufe zur
 * Recherche, dann Editor- und Validierungsrunden obendrauf.
 */
const MAX_TOOL_ROUNDS = 45;

/** Die Sandbox-Origin — zweite Origin, wie SEP-1865 sie verlangt. */
export const SANDBOX_ORIGIN = 'http://127.0.0.1:5211';

// ── API-Key ─────────────────────────────────────────────────────────────────
/**
 * Der Key kommt aus einer lokalen `.env`, nie aus einer Umgebung, die irgendwo
 * deployt wird. Zwei Orte, weil `apps/chat-demo/.env` in diesem Repo bereits
 * existiert und niemand ihn zweimal pflegen soll.
 */
function loadApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const candidates = [
    join(REPO_ROOT, 'apps/artifact-studio/.env'),
    join(REPO_ROOT, 'apps/chat-demo/.env')
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const match = readFileSync(path, 'utf8').match(/^ANTHROPIC_API_KEY\s*=\s*(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(
    `Kein ANTHROPIC_API_KEY — weder in der Umgebung noch in ${candidates.join(' oder ')}.`
  );
}

// ── Persistierter Zustand ───────────────────────────────────────────────────
/**
 * Was eine Sitzung überlebt.
 *
 * `messages` und `primer` stehen mit drin, nicht nur die Versionen: ohne die
 * Historie wäre eine wiederhergestellte Sitzung eine neue, und der nächste
 * Wunsch ginge ins Leere („mach die Karte auffälliger" — welche Karte?). Ohne
 * den Primer wäre der System-Prompt nach dem Neustart ein anderer und der
 * Cache-Prefix damit entwertet.
 */
interface PersistedSession {
  id: string;
  title: string;
  model: string;
  effort: string;
  createdAt: string;
  primer: string;
  versions: VersionInfo[];
  messages: Anthropic.MessageParam[];
}

function statePath(id: string): string {
  return join(sessionDir(id), 'session.json');
}

// ── Die Sitzung ─────────────────────────────────────────────────────────────

export class StudioSession {
  readonly id: string;
  readonly title: string;
  readonly model: string;
  readonly effort: string;
  readonly createdAt: string;

  #primer: string;
  #messages: Anthropic.MessageParam[];
  #versions: VersionInfo[];
  #artifact: ArtifactFile;
  #client: Anthropic;
  /** Ein zweiter Turn parallel wäre ein Datenrennen auf der Arbeitsdatei. */
  #busy = false;

  private constructor(p: PersistedSession) {
    this.id = p.id;
    this.title = p.title;
    this.model = p.model;
    this.effort = p.effort;
    this.createdAt = p.createdAt;
    this.#primer = p.primer;
    this.#messages = p.messages;
    this.#versions = p.versions;
    this.#artifact = new ArtifactFile(ARTIFACT_FILENAME, absoluteArtifactPath(p.id));
    if (existsSync(absoluteArtifactPath(p.id))) {
      this.#artifact.seed(readFileSync(absoluteArtifactPath(p.id), 'utf8'));
    }
    this.#client = new Anthropic({ apiKey: loadApiKey() });
  }

  get busy(): boolean {
    return this.#busy;
  }

  get state(): SessionState {
    return {
      id: this.id,
      title: this.title,
      model: this.model,
      effort: this.effort,
      createdAt: this.createdAt,
      versions: this.#versions,
      busy: this.#busy
    };
  }

  /**
   * Eine neue Sitzung anlegen.
   *
   * Der Primer wird hier EINMAL aus der echten CLI geholt — nicht je Turn. Er
   * geht danach in jedem Request mit (die Messages API ist zustandslos), aber
   * gecacht: ein Write, danach Reads.
   */
  static async create(opts: {
    title: string;
    model?: string;
    effort?: string;
  }): Promise<StudioSession> {
    // Die ID ist eine Pfadkomponente (`sessionDir`) und damit die einzige Hürde
    // zwischen einer fremden Sitzung und dem, der sie errät — `Math.random()`
    // wäre aus ein paar bekannten IDs vorhersagbar. Das Datum vorn bleibt, weil
    // es den Ordner für einen Menschen sortierbar macht.
    const id = `${new Date().toISOString().slice(0, 10)}-${randomBytes(6).toString('hex')}`;
    mkdirSync(join(sessionDir(id), 'versions'), { recursive: true });

    const { text, call } = await runUrbicon(['primer']);
    if (call.exitCode !== 0 || text.includes('[exit ')) {
      throw new Error(`urbicon primer schlug fehl:\n${text}`);
    }

    const persisted: PersistedSession = {
      id,
      title: opts.title,
      model: opts.model ?? DEFAULT_MODEL,
      effort: opts.effort ?? DEFAULT_EFFORT,
      createdAt: new Date().toISOString(),
      primer: text,
      versions: [],
      messages: []
    };
    writeFileSync(statePath(id), `${JSON.stringify(persisted, null, 2)}\n`);
    return new StudioSession(persisted);
  }

  /** Eine Sitzung von der Platte holen. `null`, wenn es sie nicht gibt. */
  static load(id: string): StudioSession | null {
    const path = statePath(id);
    if (!existsSync(path)) return null;
    return new StudioSession(JSON.parse(readFileSync(path, 'utf8')) as PersistedSession);
  }

  /** Alle Sitzungen, neueste zuerst — für die Auswahlliste. */
  static list(): { id: string; title: string; createdAt: string; versions: number }[] {
    if (!existsSync(ARTIFACTS_DIR)) return [];
    return readdirSync(ARTIFACTS_DIR)
      .filter((d) => existsSync(statePath(d)))
      .map((d) => JSON.parse(readFileSync(statePath(d), 'utf8')) as PersistedSession)
      .map((p) => ({
        id: p.id,
        title: p.title,
        createdAt: p.createdAt,
        versions: p.versions.length
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  #persist(): void {
    const p: PersistedSession = {
      id: this.id,
      title: this.title,
      model: this.model,
      effort: this.effort,
      createdAt: this.createdAt,
      primer: this.#primer,
      versions: this.#versions,
      messages: this.#messages
    };
    writeFileSync(statePath(this.id), `${JSON.stringify(p, null, 2)}\n`);
  }

  /**
   * Den rollenden Cache-Breakpoint auf das Ende der Historie setzen.
   *
   * Das ist der Hebel, dessen Fehlen einen Lauf 1,46 M Input-Token kostete
   * (BEFUNDE §11): bei 35 Werkzeug-Runden in einem Turn ging die wachsende
   * Historie 36-mal neu über die Leitung und wurde 36-mal voll berechnet. Mit
   * einem Marker am Ende jeder Runde ist der Prefix der nächsten Runde
   * byte-identisch mit dem eben Gecachten — gemessen 81–92 % Cache-Quote.
   *
   * **Der alte Marker muss weg, bevor der neue kommt.** Ein Request nimmt
   * höchstens vier; einfach anzuhängen würde ab der fünften Runde hart
   * fehlschlagen. Bereits geschriebene Cache-Einträge bleiben lesbar, auch wenn
   * ihr Marker weiterwandert.
   */
  #moveCacheBreakpoint(): void {
    for (const message of this.#messages) {
      if (typeof message.content === 'string') continue;
      for (const block of message.content) {
        if ('cache_control' in block) delete block.cache_control;
      }
    }
    const last = this.#messages.at(-1);
    if (!last) return;
    if (typeof last.content === 'string') last.content = [{ type: 'text', text: last.content }];
    const block = last.content.at(-1);
    // Nur Blocktypen mit `cache_control` im Schema; ein Marker auf einem anderen
    // wäre ein stiller No-Op, den erst die Rechnung verrät.
    if (block && ('text' in block || 'content' in block || 'source' in block)) {
      (block as { cache_control?: Anthropic.CacheControlEphemeral }).cache_control = {
        type: 'ephemeral'
      };
    }
  }

  /**
   * Ein Wunsch, von der Eingabe bis zur fertigen Version.
   *
   * Der Generator ist die API dieser Klasse: er gibt Ereignisse ab, sobald sie
   * anfallen, und der Endpunkt reicht sie unverändert an den Browser weiter.
   */
  async *run(instruction: string): AsyncGenerator<StudioEvent> {
    if (this.#busy) {
      yield { type: 'error', message: 'Es läuft bereits ein Turn in dieser Sitzung.' };
      return;
    }
    this.#busy = true;
    const t0 = performance.now();
    let cost = 0;

    try {
      let pending = instruction;
      let kind: 'user' | 'fix' = 'user';

      for (let round = 0; round <= MAX_FIX_ROUNDS; round++) {
        yield { type: 'turn:start', kind, instruction: pending };

        let report: LintReport | undefined;
        let compileErr: string | null = null;
        for await (const ev of this.#turn(pending)) {
          if (ev.type === 'lint') {
            report = ev.report;
            compileErr = ev.compileError ?? null;
          }
          if (ev.type === 'done') cost += ev.costUsd;
          if (ev.type === 'error') {
            yield ev;
            return;
          }
          // Das `done` des inneren Turns ist nicht das der Sitzung — es fällt
          // je Fix-Runde an und würde den Client zu früh entlasten.
          if (ev.type !== 'done') yield ev;
        }
        if (!report) {
          yield { type: 'error', message: 'Turn ohne Lint-Ergebnis — das ist ein Fehler im Loop.' };
          return;
        }

        // Ein Syntaxfehler löst eine Fix-Runde aus wie ein Lint-Fehler: beides
        // sind Zustände, in denen das Artefakt nicht auslieferbar ist.
        const broken = report.counts.error > 0 || compileErr !== null;
        if (!broken || round === MAX_FIX_ROUNDS) {
          // Auch ein Artefakt mit offenen Befunden wird gebaut und gezeigt. Ein
          // Lauf, der das Gate nicht besteht, ist ein ehrlicher Befund — ihn zu
          // verstecken hieße, die Oberfläche gegen ihre eigene Messung zu
          // schönen.
          yield* this.#buildVersion(instruction, report, performance.now() - t0, cost);
          break;
        }

        pending = fixInstruction(report, compileErr, this.#artifact.relPath);
        kind = 'fix';
      }

      yield { type: 'done', durationMs: Math.round(performance.now() - t0), costUsd: cost };
    } catch (e) {
      yield { type: 'error', message: e instanceof Error ? e.message : String(e) };
    } finally {
      this.#busy = false;
      this.#persist();
    }
  }

  /**
   * Ein Modell-Turn — potenziell viele API-Runden.
   *
   * Das Modell ruft die CLI, liest das Ergebnis, ruft ggf. erneut, editiert die
   * Datei, validiert sich selbst und antwortet erst dann. Genau so arbeitet ein
   * Agent im Consumer-Projekt.
   */
  async *#turn(instruction: string): AsyncGenerator<StudioEvent> {
    this.#messages.push({ role: 'user', content: instruction });
    const t0 = performance.now();
    const usage: TurnUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0
    };

    const system: Anthropic.TextBlockParam[] = [
      {
        type: 'text',
        text: buildSystemPrompt(this.#artifact.relPath, this.#primer),
        // Ein Marker auf dem letzten System-Block cacht `tools` UND `system`
        // zusammen — die Renderreihenfolge ist tools → system → messages, und
        // ein Breakpoint deckt alles vor sich ab.
        cache_control: { type: 'ephemeral' }
      }
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      this.#moveCacheBreakpoint();

      const stream = this.#client.messages.stream({
        model: this.model,
        max_tokens: 32000,
        system,
        output_config: { effort: this.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max' },
        messages: this.#messages,
        tools: [URBICON_TOOL, EDITOR_TOOL]
      });

      // Der Textstrom wird gepuffert und nach `finalMessage()` ausgegeben statt
      // aus dem Callback heraus: ein Generator kann aus einem fremden Callback
      // nichts abgeben, und die Alternative (eine Queue mit Weckern) wäre für
      // die paar Sätze Prosa je Runde deutlich mehr Maschinerie als Nutzen.
      const textParts: string[] = [];
      stream.on('text', (delta) => textParts.push(delta));

      const message = await stream.finalMessage();
      usage.inputTokens += message.usage.input_tokens;
      usage.outputTokens += message.usage.output_tokens;
      usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheCreationTokens += message.usage.cache_creation_input_tokens ?? 0;

      if (textParts.length) yield { type: 'text', text: textParts.join('') };

      if (message.stop_reason === 'refusal') {
        yield {
          type: 'error',
          message: `Modell hat abgelehnt (${message.stop_details?.category ?? 'ohne Kategorie'}).`
        };
        return;
      }
      if (message.stop_reason === 'max_tokens') {
        yield {
          type: 'error',
          message: 'Antwort lief in max_tokens — der Stand ist unvollständig.'
        };
        return;
      }

      if (message.stop_reason === 'tool_use') {
        this.#messages.push({ role: 'assistant', content: message.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of message.content) {
          if (block.type !== 'tool_use') continue;

          // Das Editor-Tool ist Anthropic-definiert und kommt als ganz normaler
          // tool_use-Block — unterschieden wird am Namen, nicht am Typ.
          if (block.name === EDITOR_TOOL.name) {
            const { text, isError, call } = this.#artifact.apply(
              block.input,
              Math.round(performance.now() - t0)
            );
            yield {
              type: 'edit',
              command: call.command,
              ok: call.ok,
              oldBytes: call.oldBytes,
              newBytes: call.newBytes,
              fileBytes: call.fileBytes,
              ...(call.error ? { error: call.error } : {})
            };
            results.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: text,
              ...(isError ? { is_error: true } : {})
            });
            continue;
          }

          const input = block.input as { args?: string[]; stdin?: string };
          // Der Sitzungsordner ist das Arbeitsverzeichnis: dort liegt die
          // Arbeitsdatei, die `validate` liest, und dort entsteht das Manifest,
          // das `context` und `record-decision` pflegen. Jede Sitzung ist damit
          // ein eigenes kleines Projekt mit eigenem Gedächtnis.
          const { text, call } = await runUrbicon(
            input.args ?? [],
            input.stdin,
            sessionDir(this.id)
          );
          yield {
            type: 'cli',
            args: call.args,
            outputBytes: call.outputBytes,
            durationMs: call.durationMs
          };
          results.push({ type: 'tool_result', tool_use_id: block.id, content: text });
        }
        this.#messages.push({ role: 'user', content: results });
        continue;
      }

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      // Die API lehnt leere Textblöcke ab, und ein reiner Edit-Turn kann ohne
      // Schlusssatz enden. Der Platzhalter ist Transport, kein Inhalt.
      this.#messages.push({ role: 'assistant', content: text.trim() || '(edits applied)' });

      if (!this.#artifact.exists) {
        yield {
          type: 'error',
          message: `Der Turn endete, ohne dass ${this.#artifact.relPath} geschrieben wurde.`
        };
        return;
      }

      const code = this.#artifact.content;
      const report = lint(code, this.id);
      const compileErr = compileError(code);
      yield { type: 'lint', report, ...(compileErr ? { compileError: compileErr } : {}) };
      yield {
        type: 'done',
        durationMs: Math.round(performance.now() - t0),
        costUsd: costOf(usage, this.model)
      };
      return;
    }
    yield {
      type: 'error',
      message: `${MAX_TOOL_ROUNDS} Werkzeug-Runden ohne Antwort — abgebrochen.`
    };
  }

  /** Den Stand einfrieren, bauen und als Version verbuchen. */
  async *#buildVersion(
    prompt: string,
    report: LintReport,
    durationMs: number,
    costUsd: number
  ): AsyncGenerator<StudioEvent> {
    const n = this.#versions.length + 1;
    const code = this.#artifact.content;
    // Der Quelltext der Version wird eingefroren, bevor gebaut wird: die
    // Arbeitsdatei läuft weiter, eine Version ist ein Stand.
    mkdirSync(join(sessionDir(this.id), 'versions'), { recursive: true });
    writeFileSync(join(sessionDir(this.id), 'versions', `v${n}.svelte`), `${code}\n`);

    yield { type: 'build:start' };
    const buildStart = performance.now();
    const result = await runBuild(this.id, n);
    const buildMs = Math.round(performance.now() - buildStart);

    const version: VersionInfo = {
      n,
      prompt,
      frameUrl: `${SANDBOX_ORIGIN}/${this.id}/dist/${result.frame}`,
      code,
      lint: report,
      durationMs: Math.round(durationMs),
      buildMs,
      costUsd
    };
    this.#versions.push(version);
    // Der Stylesheet-Hash kann sich geändert haben, und dann zeigen die alten
    // Frame-Dokumente inzwischen auf eine andere Datei. Die URLs bleiben gleich
    // (der Dateiname ist versions-, nicht hash-basiert) — aber ein Cache-Bust
    // gehört trotzdem dran, sonst zeigt der Browser den alten Frame.
    this.#persist();
    yield { type: 'version', version };
  }
}

// ── Hilfen ──────────────────────────────────────────────────────────────────

/**
 * Kompiliert der Code überhaupt?
 *
 * Der Design-Linter prüft Tokens und Komposition, nicht Syntax — ein Patch, der
 * eine Klammer zerreißt, käme mit 100/100 durch und fiele erst Wünsche später
 * auf. Deshalb dieselbe Behandlung wie ein Lint-Fehler.
 */
function compileError(code: string): string | null {
  try {
    compile(code, { name: 'Artifact', generate: 'client' });
    return null;
  } catch (e) {
    const err = e as { message?: string; start?: { line: number; column: number } };
    const at = err.start ? ` (line ${err.start.line}, column ${err.start.column})` : '';
    return `${err.message ?? String(e)}${at}`;
  }
}

function lint(code: string, id: string): LintReport {
  const report = lintDesign(code, { filename: `${id}.svelte` });
  return {
    findings: report.findings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      message: f.message,
      fix: f.fix,
      ...(f.line !== undefined ? { line: f.line } : {})
    })),
    counts: report.counts,
    scores: report.scores as LintReport['scores']
  };
}

/** Die Befunde so formulieren, wie der Loop sie dem Modell zurückgibt. */
function fixInstruction(report: LintReport, compileErr: string | null, path: string): string {
  // Syntax schlägt Design: an einer Datei, die nicht kompiliert, ist eine
  // Token-Beanstandung gegenstandslos.
  if (compileErr) {
    return `The component at ${path} does not compile:

${compileErr}

Fix it with the editor tool. Fix only the syntax error — do not restructure or add features.`;
  }
  const list = report.findings
    .map(
      (f) =>
        `- ${f.ruleId} (${f.severity})${f.line ? `, line ${f.line}` : ''}: ${f.message}\n  Fix: ${f.fix}`
    )
    .join('\n');
  return `The design linter rejected ${path}:

${list}

Fix it with the editor tool. Fix only what the linter flagged — do not restructure or add features.`;
}

/**
 * Den Build als eigenen Prozess fahren.
 *
 * stdout trägt ausschließlich das JSON-Ergebnis, stderr die Vite-Meldungen —
 * scheitert der Build, steht der Grund im Fehler und wird nicht verschluckt.
 */
function runBuild(sessionId: string, version: number): Promise<BuildResult> {
  const script = join(REPO_ROOT, 'apps/artifact-studio/src/lib/server/build-version.ts');
  return new Promise((resolve, reject) => {
    const child = spawn('bun', [script, '--session', sessionId, '--version', String(version)], {
      cwd: join(REPO_ROOT, 'apps/artifact-studio')
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Build von v${version} schlug fehl (exit ${code}):\n${err.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(out) as BuildResult);
      } catch {
        reject(new Error(`Build lieferte kein JSON:\n${out.slice(0, 500)}\n${err.slice(0, 500)}`));
      }
    });
  });
}
