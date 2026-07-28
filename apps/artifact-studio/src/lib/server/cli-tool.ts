/**
 * cli-tool.ts — der Consumer-Pfad als Werkzeug.
 *
 * Ein einziges Tool, das `urbicon <args…>` ausführt. Bewusst EIN generisches
 * Werkzeug statt eines pro Kommando: ein Agent in Claude Code hat auch nur eine
 * Shell und liest die Kommandoliste aus dem AGENTS.md-Block. Ein handgeschnittenes
 * Tool-Schema je Kommando wäre wieder eine Nachbildung — und genau die haben in
 * diesem Vorhaben dreimal zu schlechteren Ergebnissen geführt als das Original.
 *
 * Die CLI wird über ihren TypeScript-Entry gestartet (das Repo baut sie nicht für
 * jeden Lauf neu); für den Konsumenten ist es `bunx urbicon`.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { REPO_ROOT } from './paths';

const CLI = join(REPO_ROOT, 'packages/design/src/cli/index.ts');

/**
 * Was der Agent aufrufen darf.
 *
 * Lesend ist alles erlaubt. **`record-decision` ebenfalls** — seit die CLI mit
 * dem Sitzungsordner als cwd läuft, hat es dort einen echten Adressaten: das
 * Manifest der Sitzung. Ohne das war der Kreislauf halbiert, und das Modell lief
 * sichtbar dagegen (BEFUNDE §10: es versuchte `record-decision` von selbst und
 * wurde von dieser Liste gestoppt).
 *
 * Gesperrt bleiben `init` und `hook`: die schreiben in ein *Projekt* (AGENTS.md,
 * .claude/settings.json) und hätten in einer Sitzung nichts zu tun, das nicht
 * schon der Harness erledigt.
 */
const ALLOWED = new Set([
  'primer',
  'find',
  'get-component',
  'css-reference',
  'principles',
  'pattern',
  'recipe',
  'guide',
  'icons',
  'context',
  'verbs',
  'verb',
  'validate',
  'record-decision',
  'sync-manifest'
]);

export const URBICON_TOOL = {
  name: 'urbicon',
  description:
    'Run the urbicon CLI, the design-system knowledge and validation tool for this project. ' +
    'Pass the command and its flags as separate arguments, e.g. ["find", "date picker"], ' +
    '["get-component", "combobox"], ["css-reference", "surfaces"], ["validate", "-"] with the component in `stdin`. ' +
    'Run it with no arguments to see every available command.',
  input_schema: {
    type: 'object' as const,
    properties: {
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Arguments after `urbicon`, e.g. ["get-component", "combobox"].'
      },
      stdin: {
        type: 'string',
        description: 'Optional input piped to the command — used by `validate -`.'
      }
    },
    required: ['args']
  }
};

export interface CliCall {
  args: string[];
  exitCode: number;
  durationMs: number;
  outputBytes: number;
}

/**
 * Ein CLI-Aufruf. Gibt zurück, was der Agent als Tool-Ergebnis sieht.
 *
 * `cwd` ist nicht kosmetisch: `context`, `record-decision` und der
 * Token-Overrides-Teil von `validate` suchen `design.manifest.md` **relativ zum
 * Arbeitsverzeichnis**. Mit dem Repo-Root läse eine Sitzung das Manifest des
 * UI-Repos — falsch, denn ein Artefakt ist ein eigenes kleines Produkt. Der
 * Sitzungsordner gibt jeder Sitzung ihr eigenes Gedächtnis.
 */
export async function runUrbicon(
  args: string[],
  stdin?: string,
  cwd: string = REPO_ROOT
): Promise<{ text: string; call: CliCall }> {
  const t0 = performance.now();

  if (args.length > 0 && !ALLOWED.has(args[0])) {
    return {
      text: `\`${args[0]}\` is not available here. Read-only commands only: ${[...ALLOWED].join(', ')}.`,
      call: { args, exitCode: 2, durationMs: 0, outputBytes: 0 }
    };
  }

  const text = await new Promise<string>((done) => {
    const child = spawn('bun', [CLI, ...args], { cwd });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
    child.on('close', (code) => {
      // Sehr lange Ausgaben (etwa die volle Komponentenliste) würden das
      // Kontextfenster fluten. Der Schnitt wird ANGESAGT, damit das Modell
      // gezielter nachfragen kann statt zu raten, was fehlt.
      const cap = 12000;
      const body =
        out.length > cap
          ? `${out.slice(0, cap)}\n… [output truncated at ${cap} chars — narrow the query]`
          : out;
      done(code === 0 ? body : `${body}\n[exit ${code}]`);
    });
  });

  return {
    text,
    call: {
      args,
      exitCode: 0,
      durationMs: Math.round(performance.now() - t0),
      outputBytes: text.length
    }
  };
}
