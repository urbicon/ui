#!/usr/bin/env bun
/**
 * dev.ts — beide Origins mit einem Befehl.
 *
 * Der Host ist `vite dev` auf `localhost:5210`, die Sandbox ein eigener Server
 * auf `127.0.0.1:5211`. Zwei Origins sind keine Kür, sondern die Bedingung
 * dafür, dass `sandbox="allow-scripts allow-same-origin"` unbedenklich ist
 * (SEP-1865) — siehe `src/lib/server/sandbox.ts`.
 *
 * **Warum ein Wrapper und kein Vite-Plugin:** als Plugin lief der Sandbox-Server
 * in Vites Prozess und damit an Vites Lebenszyklus. Bei jeder Änderung an der
 * Config oder am Sandbox-Code lädt Vite sich neu, `server.close()` wartet dabei
 * auf die offene HMR-WebSocket-Verbindung, und der neue Anlauf scheitert mit
 * EADDRINUSE, bevor der alte Port frei ist. Ein statischer Dateiserver hat mit
 * Vites Neustarts nichts zu tun; hier lebt er darüber.
 */
import { spawn } from 'node:child_process';
import { SANDBOX_HOST, SANDBOX_PORT, startSandboxServer } from '../src/lib/server/sandbox';

const sandbox = await startSandboxServer().catch((e: Error) => {
  console.error(`\n${e.message}\n`);
  process.exit(1);
});
console.log(`▸ Sandbox-Origin   http://${SANDBOX_HOST}:${SANDBOX_PORT}  (Artefakte)`);

const vite = spawn('bunx', ['--bun', 'vite', 'dev'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url).pathname
});

// Beide gehen zusammen. Im Terminal bekommt Vite das SIGINT ohnehin über die
// Prozessgruppe; der Handler ist für den Fall, dass dieser Prozess anders
// beendet wird — ein zurückbleibender Sandbox-Server wäre genau das EADDRINUSE,
// gegen das der Wrapper gebaut ist.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    sandbox.close();
    vite.kill(signal);
    process.exit(0);
  });
}
vite.on('exit', (code) => {
  sandbox.close();
  process.exit(code ?? 0);
});
