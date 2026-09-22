/**
 * wave-cost — what a PR wave cost in tokens, read from the local Claude Code
 * transcripts of this project (`~/.claude/projects/<slug>/`).
 *
 * The `pr-wave` skill records this at wave close; the procedure itself has no
 * other measurement. What it reports, per session and (with `--agents`) per
 * subagent:
 *
 *   - output tokens by role — orchestrator (the main conversation), implementer,
 *     reviewer, other. Output tokens include thinking, so an orchestrator on a
 *     high reasoning effort reads relatively heavier than its visible text.
 *   - cache reads and cache writes, split the same way. Reads are the volume
 *     driver: every turn re-reads the agent's whole context, so a long-lived
 *     agent costs by turns × context, not by what it writes.
 *   - the fresh-context cost of each subagent: the cache write of its first
 *     turn (CLAUDE.md, briefing, skill loads).
 *   - the TTL each cache write carried (five minutes or one hour) and the turns
 *     that started more than five minutes after the previous one — where a
 *     five-minute cache has expired and the prefix is written again.
 *   - `peakActive`: the most subagents that had a message in the same minute.
 *     A subagent's lifetime (first to last message) overstates concurrency,
 *     because an agent waiting for a SendMessage is alive and idle.
 *
 * The role comes from the Agent tool's `description` first, then from the head
 * of the briefing, by keyword (`ROLE_PATTERNS`); where both role words occur,
 * the earlier one wins, because a briefing names its role before it names the
 * other side ("you are the reviewer … the implementer's report"). A subagent spawned by the
 * Workflow tool has no description and is classified by its prompt alone. The
 * `--json` output carries the description and prompt head so a reader can
 * re-classify; the heuristic is a reading aid, not an oracle.
 *
 * A subagent maps to its description through the Agent tool result in the main
 * transcript (`agentId: <id>` in the result text) — the transcript records the
 * spawn, not the agent's own name.
 *
 * Run: `bun run wave:cost --since 2026-09-15 --agents`
 *   --since / --until YYYY-MM-DD   sessions whose first message falls in range
 *   --session <id-prefix>          one session
 *   --transcripts <dir>            the transcript directory (default: derived
 *                                  from the working directory, as Claude Code
 *                                  slugs it)
 *   --agents                       per-subagent rows
 *   --json                         machine-readable, everything
 *
 * It fails loud on a missing transcript directory and on an empty range:
 * a table of zeros would read as "the wave cost nothing".
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Role = 'orchestrator' | 'implementer' | 'reviewer' | 'other';

export interface Usage {
  turns: number;
  output: number;
  inputUncached: number;
  cacheWrite: number;
  /** The part of `cacheWrite` written with the five-minute TTL; the rest carried the one-hour TTL. */
  cacheWrite5m: number;
  cacheRead: number;
  /** Turns that started more than five minutes after the previous one — the pause a five-minute cache does not survive. */
  turnsAfterPause: number;
  /** The cache written on those turns: the price of the expired prefix. */
  cacheWriteAfterPause: number;
  /** The cache read on those turns: the prefix a five-minute cache would have had to write again. */
  cacheReadAfterPause: number;
}

export interface SubagentRow {
  id: string;
  session: string;
  role: Role;
  description: string;
  promptHead: string;
  model: string;
  start: string;
  end: string;
  activeMinutes: number;
  firstTurnCacheWrite: number;
  usage: Usage;
}

export interface SessionRow {
  session: string;
  start: string;
  model: string;
  orchestrator: Usage;
  subagents: SubagentRow[];
  peakActive: number;
  byRole: Record<Role, Usage>;
}

export interface Report {
  transcripts: string;
  sessions: SessionRow[];
  totals: Record<Role, Usage>;
  subagentCount: number;
}

export const ROLE_PATTERNS: Array<[Exclude<Role, 'orchestrator'>, RegExp]> = [
  ['reviewer', /adversarial|reviewer|\breview\b|verifizier|widerleg|zu fall zu bringen|refut/i],
  ['implementer', /implementier|implement/i]
];

const emptyUsage = (): Usage => ({
  turns: 0,
  output: 0,
  inputUncached: 0,
  cacheWrite: 0,
  cacheWrite5m: 0,
  cacheRead: 0,
  turnsAfterPause: 0,
  cacheWriteAfterPause: 0,
  cacheReadAfterPause: 0
});

const PAUSE_MS = 5 * 60_000;

const addUsage = (into: Usage, from: Usage): void => {
  into.turns += from.turns;
  into.output += from.output;
  into.inputUncached += from.inputUncached;
  into.cacheWrite += from.cacheWrite;
  into.cacheWrite5m += from.cacheWrite5m;
  into.cacheRead += from.cacheRead;
  into.turnsAfterPause += from.turnsAfterPause;
  into.cacheWriteAfterPause += from.cacheWriteAfterPause;
  into.cacheReadAfterPause += from.cacheReadAfterPause;
};

/** Claude Code names the project directory after the working directory, every non-alphanumeric byte as `-`. */
export const transcriptDirFor = (workingDirectory: string, home = homedir()): string =>
  join(home, '.claude', 'projects', workingDirectory.replace(/[^a-zA-Z0-9]/g, '-'));

export const classify = (
  description: string,
  promptHead: string
): Exclude<Role, 'orchestrator'> => {
  for (const source of [description, promptHead]) {
    if (!source) continue;
    let best: { role: Exclude<Role, 'orchestrator'>; at: number } | undefined;
    for (const [role, pattern] of ROLE_PATTERNS) {
      const at = source.search(pattern);
      if (at >= 0 && (!best || at < best.at)) best = { role, at };
    }
    if (best) return best.role;
  }
  return 'other';
};

interface Line {
  type?: string;
  timestamp?: string;
  agentId?: string;
  message?: {
    model?: string;
    content?: unknown;
    usage?: {
      output_tokens?: number;
      input_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
      cache_read_input_tokens?: number;
    };
  };
}

const readLines = (file: string): Line[] => {
  const lines: Line[] = [];
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (!raw) continue;
    try {
      lines.push(JSON.parse(raw) as Line);
    } catch {
      // a transcript line that is not JSON is a write in progress, not data
    }
  }
  return lines;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface Scan {
  usage: Usage;
  first: string;
  last: string;
  model: string;
  promptHead: string;
  firstTurnCacheWrite: number;
  minutes: Set<number>;
}

const scanTranscript = (file: string): Scan => {
  const usage = emptyUsage();
  const models = new Map<string, number>();
  const minutes = new Set<number>();
  let first = '';
  let last = '';
  let promptHead = '';
  let firstTurnCacheWrite = -1;
  let previousTurnAt = 0;
  for (const line of readLines(file)) {
    if (line.timestamp) {
      if (!first) first = line.timestamp;
      last = line.timestamp;
      minutes.add(Math.floor(Date.parse(line.timestamp) / 60_000));
    }
    if (!promptHead && line.type === 'user' && typeof line.message?.content === 'string') {
      promptHead = line.message.content.slice(0, 400);
    }
    const u = line.type === 'assistant' ? line.message?.usage : undefined;
    if (!u) continue;
    const written = u.cache_creation_input_tokens ?? 0;
    const turnAt = line.timestamp ? Date.parse(line.timestamp) : 0;
    usage.turns += 1;
    usage.output += u.output_tokens ?? 0;
    usage.inputUncached += u.input_tokens ?? 0;
    usage.cacheWrite += written;
    usage.cacheWrite5m += u.cache_creation?.ephemeral_5m_input_tokens ?? 0;
    usage.cacheRead += u.cache_read_input_tokens ?? 0;
    if (previousTurnAt && turnAt - previousTurnAt > PAUSE_MS) {
      usage.turnsAfterPause += 1;
      usage.cacheWriteAfterPause += written;
      usage.cacheReadAfterPause += u.cache_read_input_tokens ?? 0;
    }
    if (turnAt) previousTurnAt = turnAt;
    if (firstTurnCacheWrite < 0) firstTurnCacheWrite = u.cache_creation_input_tokens ?? 0;
    const model = line.message?.model ?? '?';
    models.set(model, (models.get(model) ?? 0) + 1);
  }
  const model = [...models.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '?';
  return {
    usage,
    first,
    last,
    model,
    promptHead,
    firstTurnCacheWrite: Math.max(firstTurnCacheWrite, 0),
    minutes
  };
};

/** agentId → the `description` the Agent tool call was given; read from the spawn's tool result. */
const agentDescriptions = (mainTranscript: string): Map<string, string> => {
  const byToolUse = new Map<string, string>();
  const byAgent = new Map<string, string>();
  for (const line of readLines(mainTranscript)) {
    const content = line.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!isRecord(block)) continue;
      if (block.type === 'tool_use' && block.name === 'Agent' && typeof block.id === 'string') {
        const input = isRecord(block.input) ? block.input : {};
        byToolUse.set(block.id, typeof input.description === 'string' ? input.description : '');
      }
      if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        const description = byToolUse.get(block.tool_use_id);
        if (description === undefined) continue;
        const text = Array.isArray(block.content)
          ? block.content
              .map((c) => (isRecord(c) && typeof c.text === 'string' ? c.text : ''))
              .join('\n')
          : typeof block.content === 'string'
            ? block.content
            : '';
        const id = /agentId:\s*([0-9a-f]+)/.exec(text)?.[1];
        if (id) byAgent.set(id, description);
      }
    }
  }
  return byAgent;
};

const peakActive = (subagents: SubagentRow[], minutesById: Map<string, Set<number>>): number => {
  const perMinute = new Map<number, number>();
  for (const s of subagents) {
    for (const m of minutesById.get(s.id) ?? []) perMinute.set(m, (perMinute.get(m) ?? 0) + 1);
  }
  return Math.max(0, ...perMinute.values());
};

export interface AnalyzeOptions {
  since?: string;
  until?: string;
  session?: string;
}

export const analyze = (transcripts: string, options: AnalyzeOptions = {}): Report => {
  if (!existsSync(transcripts)) {
    throw new Error(
      `no transcript directory at ${transcripts} — pass --transcripts <dir> if this project lives elsewhere`
    );
  }
  const sessions: SessionRow[] = [];
  const totals: Record<Role, Usage> = {
    orchestrator: emptyUsage(),
    implementer: emptyUsage(),
    reviewer: emptyUsage(),
    other: emptyUsage()
  };
  const files = readdirSync(transcripts)
    .filter((f) => f.endsWith('.jsonl'))
    .sort();
  for (const file of files) {
    const session = file.slice(0, -'.jsonl'.length);
    if (options.session && !session.startsWith(options.session)) continue;
    const main = scanTranscript(join(transcripts, file));
    if (!main.first) continue;
    const day = main.first.slice(0, 10);
    if (options.since && day < options.since) continue;
    if (options.until && day > options.until) continue;
    const descriptions = agentDescriptions(join(transcripts, file));
    const subDir = join(transcripts, session, 'subagents');
    const subagents: SubagentRow[] = [];
    const minutesById = new Map<string, Set<number>>();
    if (existsSync(subDir)) {
      for (const sub of readdirSync(subDir)
        .filter((f) => f.endsWith('.jsonl'))
        .sort()) {
        const scan = scanTranscript(join(subDir, sub));
        if (!scan.usage.turns) continue;
        const id = sub.replace(/^agent-/, '').slice(0, -'.jsonl'.length);
        const description = descriptions.get(id) ?? '';
        minutesById.set(id, scan.minutes);
        subagents.push({
          id,
          session,
          role: classify(description, scan.promptHead),
          description,
          promptHead: scan.promptHead.slice(0, 160),
          model: scan.model,
          start: scan.first,
          end: scan.last,
          activeMinutes: scan.minutes.size,
          firstTurnCacheWrite: scan.firstTurnCacheWrite,
          usage: scan.usage
        });
      }
    }
    subagents.sort((a, b) => a.start.localeCompare(b.start));
    const byRole: Record<Role, Usage> = {
      orchestrator: main.usage,
      implementer: emptyUsage(),
      reviewer: emptyUsage(),
      other: emptyUsage()
    };
    for (const s of subagents) addUsage(byRole[s.role], s.usage);
    for (const role of Object.keys(totals) as Role[]) addUsage(totals[role], byRole[role]);
    sessions.push({
      session,
      start: main.first,
      model: main.model,
      orchestrator: main.usage,
      subagents,
      peakActive: peakActive(subagents, minutesById),
      byRole
    });
  }
  if (!sessions.length) {
    throw new Error(
      `no sessions in ${transcripts} match the range — check --since/--until/--session`
    );
  }
  return {
    transcripts,
    sessions,
    totals,
    subagentCount: sessions.reduce((n, s) => n + s.subagents.length, 0)
  };
};

const k = (n: number): string => `${Math.round(n / 1000)}k`;
const m = (n: number): string => `${(n / 1_000_000).toFixed(1)}M`;
const pad = (s: string, width: number): string => s.padEnd(width).slice(0, width);

export const renderText = (report: Report, agents: boolean): string => {
  const out: string[] = [];
  out.push(`transcripts: ${report.transcripts}`);
  out.push('');
  out.push(
    [
      pad('date', 10),
      pad('session', 8),
      pad('subs', 4),
      pad('impl', 4),
      pad('rev', 4),
      pad('oth', 4),
      pad('peak', 4),
      pad('orch out', 9),
      pad('impl out', 9),
      pad('rev out', 9),
      pad('oth out', 9),
      pad('orch read', 10),
      pad('subs read', 10),
      pad('subs write', 10),
      'model'
    ].join('  ')
  );
  for (const s of report.sessions) {
    const count = (role: Role) => s.subagents.filter((x) => x.role === role).length;
    const subsRead = s.subagents.reduce((n, x) => n + x.usage.cacheRead, 0);
    const subsWrite = s.subagents.reduce((n, x) => n + x.usage.cacheWrite, 0);
    out.push(
      [
        pad(s.start.slice(0, 10), 10),
        pad(s.session.slice(0, 8), 8),
        pad(String(s.subagents.length), 4),
        pad(String(count('implementer')), 4),
        pad(String(count('reviewer')), 4),
        pad(String(count('other')), 4),
        pad(String(s.peakActive), 4),
        pad(k(s.orchestrator.output), 9),
        pad(k(s.byRole.implementer.output), 9),
        pad(k(s.byRole.reviewer.output), 9),
        pad(k(s.byRole.other.output), 9),
        pad(m(s.orchestrator.cacheRead), 10),
        pad(m(subsRead), 10),
        pad(m(subsWrite), 10),
        s.model
      ].join('  ')
    );
    if (!agents) continue;
    for (const a of s.subagents) {
      out.push(
        [
          '   ',
          pad(a.start.slice(11, 16), 5),
          pad(a.role, 11),
          pad(a.description || a.promptHead.replace(/\s+/g, ' '), 48),
          pad(`${a.usage.turns} turns`, 10),
          pad(`out ${k(a.usage.output)}`, 10),
          pad(`read ${m(a.usage.cacheRead)}`, 12),
          pad(`write ${k(a.usage.cacheWrite)}`, 11),
          pad(`first ${k(a.firstTurnCacheWrite)}`, 11),
          pad(`${a.activeMinutes} min`, 8),
          a.model
        ].join(' ')
      );
    }
  }
  out.push('');
  out.push(`subagents: ${report.subagentCount}  sessions: ${report.sessions.length}`);
  for (const [role, u] of Object.entries(report.totals)) {
    out.push(
      `${pad(role, 12)} turns=${u.turns}  out=${m(u.output)}  cache read=${m(u.cacheRead)}  cache write=${m(u.cacheWrite)} (5m ${m(u.cacheWrite5m)}, 1h ${m(u.cacheWrite - u.cacheWrite5m)})  after >5min pause: ${u.turnsAfterPause} turns, write ${m(u.cacheWriteAfterPause)}, read ${m(u.cacheReadAfterPause)}  uncached in=${m(u.inputUncached)}`
    );
  }
  return out.join('\n');
};

const parseArgs = (argv: string[]) => {
  const opts: AnalyzeOptions & { transcripts?: string; agents: boolean; json: boolean } = {
    agents: false,
    json: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    if (arg === '--since') opts.since = next();
    else if (arg === '--until') opts.until = next();
    else if (arg === '--session') opts.session = next();
    else if (arg === '--transcripts') opts.transcripts = next();
    else if (arg === '--agents') opts.agents = true;
    else if (arg === '--json') opts.json = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return opts;
};

if (import.meta.main) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const report = analyze(opts.transcripts ?? transcriptDirFor(process.cwd()), opts);
    console.log(opts.json ? JSON.stringify(report, null, 2) : renderText(report, opts.agents));
  } catch (error) {
    console.error(`wave-cost: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
