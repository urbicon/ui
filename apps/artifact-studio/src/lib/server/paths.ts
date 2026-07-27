/**
 * paths.ts — wo das Repo liegt und wo eine Sitzung arbeitet.
 *
 * Die Wurzel wird gesucht, nicht gerechnet: ein relativer Sprung von
 * `import.meta.url` aus stimmt im Dev-Server und bricht still, sobald derselbe
 * Code gebündelt woanders liegt. Die Aufwärtssuche nach einem Marker, den nur
 * dieses Repo hat, hält in beiden Fällen — und scheitert laut, wenn sie ihn
 * nicht findet, statt auf `/` zu zeigen.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function findRepoRoot(): string {
  const marker = join('packages', 'design', 'src', 'cli', 'index.ts');
  const starts = [dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let up = 0; up < 8; up++) {
      if (existsSync(join(dir, marker))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error(
    `Repo-Wurzel nicht gefunden (gesucht wurde ${marker} aufwärts von ` +
      `${starts.join(' und ')}). Das Studio läuft nur im urbicon-ui-Monorepo.`
  );
}

export const REPO_ROOT = findRepoRoot();

/** Der Arbeitsordner der App — Sitzungen, Arbeitsdateien, Build-Ausgaben. */
export const ARTIFACTS_DIR = join(REPO_ROOT, 'apps/artifact-studio/.artifacts');

/**
 * Der Pfad der Arbeitsdatei, **relativ zum Sitzungsordner**.
 *
 * Die CLI läuft mit dem Sitzungsordner als cwd (damit `context` und
 * `record-decision` das Manifest *dieser* Sitzung finden), also ist der Pfad,
 * den das Modell im System-Prompt sieht und an `urbicon validate` übergibt,
 * schlicht der Dateiname. Kein Repo-Pfad im Prompt heißt nebenbei: kein
 * Benutzername der Maschine im Prompt.
 */
export const ARTIFACT_FILENAME = 'artifact.svelte';

/** Wohin `ARTIFACT_FILENAME` innerhalb einer Sitzung tatsächlich zeigt. */
export function absoluteArtifactPath(sessionId: string): string {
  return join(sessionDir(sessionId), ARTIFACT_FILENAME);
}

/** Der Ordner einer Sitzung: Arbeitsdatei, Zustand, gebaute Versionen. */
export function sessionDir(sessionId: string): string {
  return join(ARTIFACTS_DIR, sessionId);
}
