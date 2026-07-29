// Zeile 2 der Journey ist die niedrigere Fassung des Hero-Inventars und nutzt
// exakt dessen Build-time-Daten (Kataloge + Größen-Baseline) — eine Quelle,
// keine Kopie. Frischer Worktree: erst `bun run docs:gen:all`.
export { load } from '../landing-hero/+page.server';
