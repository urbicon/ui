/**
 * grounding.ts — baut den System-Prompt für eine Studio-Sitzung.
 *
 * Es ist exakt das, was `urbicon init` einem Agenten mitgibt: die Datei, die in
 * der AGENTS.md eines echten Projekts landet, plus die echte CLI als Werkzeug.
 * Kein nachgebautes Grounding — was hier fehlt, fehlt dem Consumer auch; was hier
 * steht, steht bei ihm. Genau deshalb sagt ein Lauf hier etwas über das Produkt
 * und nicht über Prompt-Bastelei.
 *
 * Die Messung dahinter (BEFUNDE §10/§13): gegen ein von Hand zusammengestelltes
 * 21-kB-Grounding lieferte dieser Pfad **26 statt 14 Komponenten** und
 * validierte sich selbst innerhalb des Turns. Wer ein Grounding von Hand baut,
 * baut auch dessen Löcher — der reproduzierbare `hardcoded-z-index`-Fehler der
 * injizierten Läufe war eine Lücke im handgebauten Kontext, nicht in der
 * CSS-Referenz.
 *
 * Ergänzt wird nur der Ausgabe-Kontrakt. Der ist Transport, kein Design-Wissen:
 * ein Agent in Claude Code schreibt in Dateien, hier ist die eine Arbeitsdatei
 * der Sitzung das Ziel.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './paths';

/**
 * Der `urbicon init`-Block, wie ihn ein Consumer in seiner AGENTS.md hätte.
 *
 * Der Primer wird beim Sitzungsstart EINMAL aus der echten CLI geholt und hier
 * eingehängt — nicht als kopierte Tabelle, sondern als Ausgabe der installierten
 * Version. Das Template trägt bewusst keinen Primer-Schritt (den fügt erst
 * `urbicon init --with-primer` hinzu, für Agenten, die ihren System-Prompt nicht
 * erreichen können); hier ist er schon da, also gibt es nichts zu holen.
 *
 * Zur Klarstellung, weil die Intuition anders läuft: der Primer geht damit NICHT
 * nur in den ersten Request. Die Messages API ist zustandslos — jeder Request
 * trägt System + Tools + volle Historie erneut. Gespart wird nicht das Senden,
 * sondern das Berechnen: einmal Cache-Write (1,25×), danach Reads (0,1×).
 */
export function buildSystemPrompt(artifactPath: string, primer?: string): string {
  const raw = readFileSync(join(REPO_ROOT, 'packages/design/templates/AGENTS.md'), 'utf8');
  // Die urbicon:start/end-Marker sind Werkzeug für `init`, nicht Inhalt.
  const block = raw
    .replace(/<!--\s*urbicon:start[\s\S]*?-->/, '')
    .replace(/<!--\s*urbicon:end\s*-->/, '')
    .trim();

  const knowledge = primer ? `\n---\n\n${primer.trim()}\n` : '';

  return `${block}
${knowledge}
---

## This task

You are building a single self-contained Svelte 5 component. Import only from '@urbicon-ui/blocks'. No external assets, no network calls.

The component lives at \`${artifactPath}\`. Write and change it with the \`str_replace_based_edit_tool\`. **Never put the code in your reply** — the file is the deliverable, prose about it is not.

- \`create\` writes the whole file from \`file_text\`. Use it for the first version, and for a rewrite that touches most of the file.
- \`str_replace\` changes one part: \`old_str\` copied verbatim from the file, indentation included, matching exactly once. Add a line or two of surrounding context if a snippet occurs more than once. One call per edit, as many calls as the change needs.
- **Choosing between them:** \`str_replace\` costs about twice the region you touch; \`create\` costs the whole file. Patch unless you are rewriting more than roughly half of it.
- \`view\` shows the current contents. \`urbicon validate ${artifactPath}\` reads it straight from disk — no need to pipe it in.
- When you are done, reply with one short sentence saying what you did.`;
}
