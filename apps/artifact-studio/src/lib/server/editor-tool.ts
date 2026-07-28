/**
 * editor-tool.ts — die Datei bearbeiten statt sie neu zu schreiben.
 *
 * Der Volltext-Pfad (eine ```svelte-Fence je Turn) hat einen gemessenen Preis:
 * bei einer Iteration sind **45 % des Output-Volumens wörtliche Wiederholung**
 * (BEFUNDE §19 — 5 555 von 12 243 Token, 96 % der Zeilen unverändert), und weil
 * die Ausgaberate mit ~158 Tok/s konstant ist, kostet jede weitere kB Datei
 * ~2,6 s je Wunsch — unabhängig davon, wie klein der Wunsch ist. Für ein
 * Schaufenster-Fixture ist das gleichgültig; für eine Oberfläche, an der jemand
 * sitzt und wartet, ist es der Unterschied zwischen 37 s und 87 s je Wunsch.
 *
 * Hier liegt deshalb das Anthropic-definierte Text-Editor-Tool. Bewusst das
 * eingebaute statt eines eigenen Schemas: das Modell kennt seine Semantik aus dem
 * Training, und ein handgeschnittenes Tool wäre wieder ein Nachbau — dieselbe
 * Klasse Fehler, die in diesem Vorhaben schon dreimal schlechter abgeschnitten hat
 * als das Original.
 *
 * **Die Datei liegt wirklich auf der Platte, und das ist keine Bequemlichkeit.**
 * Der erste Versuch hielt sie nur im Speicher — worauf das Modell folgerichtig
 * `urbicon validate <pfad>` rief, ein `cannot read` bekam und in eine
 * view→validate-Schleife lief, bis die Rundengrenze griff. Beim Consumer liegt
 * die Datei im Projekt und die CLI liest sie; eine Datei, die nur der Loop sieht,
 * ist wieder ein Nachbau der Produktoberfläche statt der Oberfläche selbst.
 *
 * Der Pfad ist **je Instanz** gesetzt, nicht global: das Studio fährt mehrere
 * Sitzungen nebeneinander, und jede braucht ihre eigene Arbeitsdatei. Ein
 * Modul-globaler Pfad würde zwei parallele Sitzungen still übereinander
 * schreiben lassen.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Ein Editor-Aufruf, auf das reduziert, was die Auswertung braucht. */
export interface EditCall {
  /** Millisekunden seit Beginn des Turns — die Zeitachse der Änderung. */
  atMs: number;
  command: string;
  /** Bytes, die der Aufruf ersetzt hat (`old_str`), bzw. 0 bei create/insert/view. */
  oldBytes: number;
  /** Bytes, die er geschrieben hat (`new_str` / `file_text` / `insert_text`). */
  newBytes: number;
  /** Dateigröße nach dem Aufruf. */
  fileBytes: number;
  ok: boolean;
  /** Nur bei `ok: false` — was schiefging, wortgleich zum Tool-Ergebnis. */
  error?: string;
}

/**
 * Schema-los und versioniert — `type` und `name` sind ein Paar, das nicht
 * gemischt werden darf. Kein `input_schema`: das Tool ist Anthropic-definiert,
 * seine Eingabeform steckt im Modell.
 */
export const EDITOR_TOOL = {
  type: 'text_editor_20250728' as const,
  name: 'str_replace_based_edit_tool' as const
};

interface EditorInput {
  command?: string;
  path?: string;
  old_str?: string;
  new_str?: string;
  file_text?: string;
  insert_line?: number;
  insert_text?: string;
  view_range?: [number, number];
}

/**
 * Der Dateizustand einer Sitzung.
 *
 * Bewusst eine Klasse mit Zustand statt einer reinen Funktion: die Datei IST der
 * Unterschied zum Volltext-Pfad — sie überlebt den Turn, und der Code eines Turns
 * ist ihr Inhalt danach, nicht das, was das Modell gesagt hat.
 */
export class ArtifactFile {
  #content = '';
  #exists = false;

  /**
   * @param relPath  repo-relativ — das ist der Pfad, den das Modell im
   *                 System-Prompt sieht und der `urbicon validate` erreicht.
   * @param absPath  wohin `relPath` tatsächlich zeigt.
   */
  constructor(
    readonly relPath: string,
    private readonly absPath: string
  ) {}

  get content(): string {
    return this.#content;
  }

  get exists(): boolean {
    return this.#exists;
  }

  /**
   * Tolerant lesen: das Modell schreibt den Pfad gelegentlich mit `./` davor oder
   * absolut aus, und rät bei absoluten Pfaden gelegentlich eine falsche
   * Projektwurzel (`/repo/…`), weil es seine echte nicht kennt. Das sind
   * plausible Annahmen, keine Tippfehler — sie abzulehnen kostet nur eine Runde.
   * Ein falscher DATEINAME scheitert weiterhin, und darum geht es dem Guard.
   */
  #isArtifactPath(p: string | undefined): boolean {
    if (!p) return false;
    const norm = p.replace(/^\.\//, '');
    return norm === this.absPath || norm === this.relPath || norm.endsWith(`/${this.relPath}`);
  }

  /**
   * Den Speicherstand auf die Platte spiegeln.
   *
   * Nach JEDER Änderung, nicht am Turn-Ende: das Modell validiert innerhalb des
   * Turns (`urbicon validate <pfad>`), und was es dann liest, muss der Stand von
   * eben sein — sonst prüft es eine Datei, die es gerade geändert hat.
   */
  #flush(): void {
    mkdirSync(dirname(this.absPath), { recursive: true });
    writeFileSync(this.absPath, this.#content);
  }

  /** Den ersten Wurf setzen (der kommt als Fence, es gibt nichts zu patchen). */
  seed(code: string): void {
    this.#content = code;
    this.#exists = true;
    this.#flush();
  }

  /**
   * Die Arbeitsdatei entfernen.
   *
   * Eine Sitzung hinterlässt keinen Stand, den eine spätere versehentlich erbt —
   * eine liegengebliebene Datei würde einen Fehlstart still überdecken (das
   * Modell fände eine Datei vor, die es nie erzeugt hat).
   */
  reset(): void {
    rmSync(this.absPath, { force: true });
    this.#content = '';
    this.#exists = false;
  }

  /**
   * Einen Editor-Aufruf anwenden.
   *
   * Gibt zurück, was das Modell als Tool-Ergebnis sieht. Fehler werden als
   * `is_error`-Ergebnis zurückgegeben, nicht geworfen: ein danebengegangener
   * `str_replace` ist für das Modell eine korrigierbare Situation — und wie oft
   * das passiert, ist eine der Messfragen dieses Modus.
   */
  apply(raw: unknown, atMs: number): { text: string; isError: boolean; call: EditCall } {
    const input = (raw ?? {}) as EditorInput;
    const command = input.command ?? '(fehlt)';
    const fail = (error: string): { text: string; isError: boolean; call: EditCall } => ({
      text: error,
      isError: true,
      call: {
        atMs,
        command,
        oldBytes: 0,
        newBytes: 0,
        fileBytes: this.#content.length,
        ok: false,
        error
      }
    });

    // Der Guard hält den Editor auf der einen Arbeitsdatei fest — er liegt hier
    // NICHT, weil nichts auf der Platte wäre, sondern gerade weil etwas dort liegt.
    if (!this.#isArtifactPath(input.path)) {
      return fail(
        `Error: the only editable file is ${this.relPath} (got ${input.path ?? 'nothing'}).`
      );
    }

    switch (command) {
      case 'view': {
        if (!this.#exists) return fail(`Error: ${this.relPath} does not exist yet.`);
        const lines = this.#content.split('\n');
        const [from, to] = input.view_range ?? [1, lines.length];
        const slice = lines.slice(Math.max(0, from - 1), to === -1 ? lines.length : to);
        const numbered = slice.map((l, i) => `${from + i}\t${l}`).join('\n');
        return {
          text: numbered,
          isError: false,
          call: {
            atMs,
            command,
            oldBytes: 0,
            newBytes: 0,
            fileBytes: this.#content.length,
            ok: true
          }
        };
      }

      case 'create': {
        const text = input.file_text ?? '';
        this.#content = text;
        this.#exists = true;
        this.#flush();
        return {
          text: `File ${this.relPath} written (${text.length} bytes).`,
          isError: false,
          call: {
            atMs,
            command,
            oldBytes: 0,
            newBytes: text.length,
            fileBytes: text.length,
            ok: true
          }
        };
      }

      case 'str_replace': {
        if (!this.#exists) {
          return fail(`Error: ${this.relPath} does not exist yet — use \`create\` first.`);
        }
        const oldStr = input.old_str;
        const newStr = input.new_str ?? '';
        if (oldStr === undefined) return fail('Error: `old_str` is required for str_replace.');

        // Der eigentliche Guard des Verfahrens: genau ein Treffer. Bei 0 hat das
        // Modell den Anker falsch abgeschrieben, bei >1 wäre die Änderung
        // mehrdeutig — beides muss laut scheitern, sonst patcht der Lauf still
        // an der falschen Stelle und der Lint bemerkt es womöglich nicht.
        const count = oldStr === '' ? 0 : this.#content.split(oldStr).length - 1;
        if (count === 0) {
          return fail(
            'Error: `old_str` was not found in the file. Copy it verbatim, including indentation.'
          );
        }
        if (count > 1) {
          return fail(
            `Error: \`old_str\` matched ${count} times — include more surrounding context to make it unique.`
          );
        }

        // Replacer-FUNKTION, nicht der String: `String.replace` deutet `$&`,
        // `` $` `` und `$'` im Ersatz auch bei String-Suche als Muster. Svelte-Code
        // ist voller `$` (`$state`, `$derived`, `$props`), also ist das hier kein
        // Randfall — es hat in diesem Repo schon einmal still falschen Text
        // erzeugt. Die Funktionsform setzt den Ersatz wortgetreu ein.
        this.#content = this.#content.replace(oldStr, () => newStr);
        this.#flush();
        return {
          text: `Replaced ${oldStr.length} bytes with ${newStr.length} bytes in ${this.relPath}.`,
          isError: false,
          call: {
            atMs,
            command,
            oldBytes: oldStr.length,
            newBytes: newStr.length,
            fileBytes: this.#content.length,
            ok: true
          }
        };
      }

      case 'insert': {
        if (!this.#exists) {
          return fail(`Error: ${this.relPath} does not exist yet — use \`create\` first.`);
        }
        const at = input.insert_line;
        const text = input.insert_text ?? '';
        if (at === undefined) return fail('Error: `insert_line` is required for insert.');
        const lines = this.#content.split('\n');
        if (at < 0 || at > lines.length) {
          return fail(`Error: \`insert_line\` ${at} is outside the file (0…${lines.length}).`);
        }
        lines.splice(at, 0, ...text.split('\n'));
        this.#content = lines.join('\n');
        this.#flush();
        return {
          text: `Inserted ${text.length} bytes after line ${at} in ${this.relPath}.`,
          isError: false,
          call: {
            atMs,
            command,
            oldBytes: 0,
            newBytes: text.length,
            fileBytes: this.#content.length,
            ok: true
          }
        };
      }

      default:
        return fail(
          `Error: unsupported command "${command}". Use view, create, str_replace or insert.`
        );
    }
  }
}
