/**
 * sandbox.ts — der zweite Server, die zweite Origin.
 *
 * SEP-1865 verlangt normativ, dass Host und Sandbox **verschiedene Origins**
 * haben. Ein `<iframe sandbox>` allein genügt nicht: ohne `allow-same-origin`
 * ist die Origin des Frames opak, und dagegen matcht die CSP-Quelle `'self'`
 * nicht mehr — der Browser blockt dann das eigene Artefakt-Modul (BEFUNDE §3,
 * teuer gelernt). Mit `allow-same-origin` auf einer FREMDEN Origin gewährt das
 * Attribut dem Frame nur Zugriff auf sich selbst, nie auf den Host. Genau
 * deshalb sind die getrennten Origins die Bedingung, unter der es unbedenklich
 * ist.
 *
 * Lokal genügt dafür der Unterschied zwischen `localhost` und `127.0.0.1`:
 * gleiche Maschine, verschiedene Origins nach der Same-Origin-Policy. In
 * Produktion wäre es eine zweite Subdomain — und das ist Infrastruktur, keine
 * Komponenten-Eigenschaft (ARTEFAKTE §5a, Strang 3).
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { ARTIFACTS_DIR } from './paths';

export const SANDBOX_PORT = 5211;
export const SANDBOX_HOST = '127.0.0.1';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

/**
 * Den Sandbox-Server starten.
 *
 * Ausgeliefert wird ausschließlich aus `.artifacts/` — also nur, was ein Build
 * dort erzeugt hat. Die Arbeitsdatei und `session.json` liegen zwar im selben
 * Baum, sind aber nur über einen Pfad erreichbar, den niemand rät; entscheidend
 * ist der Traversal-Guard, damit von hier aus nicht ins Repo gelangt werden kann.
 *
 * **Gestartet wird er von `scripts/dev.ts`, nicht von einem Vite-Plugin.** Der
 * erste Versuch war ein Plugin — und starb bei der ersten Änderung an dieser
 * Datei: Vite lädt seine Config neu, `server.close()` wartet aber auf die offene
 * HMR-WebSocket-Verbindung, und der neue Prozess greift nach dem Port, bevor der
 * alte ihn hergibt. Der Fehler war nicht der Aufräum-Handler, sondern die
 * Kopplung: dieser Server liefert statische Dateien und hat mit Vites
 * Lebenszyklus nichts zu tun.
 */
export function startSandboxServer(): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${SANDBOX_HOST}:${SANDBOX_PORT}`);
    // normalize() + Präfix-Prüfung: kein `../`-Ausbruch aus dem Artefakt-Ordner.
    const file = normalize(join(ARTIFACTS_DIR, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ARTIFACTS_DIR) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }

    // Die Frame-Dokumente heißen versions-, nicht hash-basiert: dieselbe URL
    // kann nach einem Rebuild auf ein anderes Stylesheet zeigen. `no-store`
    // darauf, `immutable` auf die gehashten Assets — sonst zeigt der Browser
    // nach einer Änderung hartnäckig den alten Stand.
    const hashed = /-[0-9a-f]{8}\.css$/.test(file) || /\/v\d+\/.+\.js$/.test(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-store'
    });
    createReadStream(file).pipe(res);
  });

  // Erst auflösen, wenn der Port wirklich hört. Fail-loud, aber als abgelehntes
  // Promise statt als Wurf aus einem Event-Handler: ein stiller Fehlstart hieße,
  // dass jedes Artefakt als leerer Frame erscheint und die Ursache nirgends steht
  // — ein uncaughtException wiederum begräbt die Meldung unter einem Stacktrace.
  return new Promise((resolve, reject) => {
    server.once('listening', () => resolve(server));
    server.once('error', (e: NodeJS.ErrnoException) => {
      reject(
        e.code === 'EADDRINUSE'
          ? new Error(
              `Sandbox-Port ${SANDBOX_PORT} ist belegt. Läuft noch ein Studio oder ` +
                `prototypes/artifact-frame/serve.ts? (lsof -ti:${SANDBOX_PORT})`
            )
          : e
      );
    });
    server.listen(SANDBOX_PORT, SANDBOX_HOST);
  });
}
