import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, classify, renderText, transcriptDirFor } from './wave-cost';

const T0 = Date.parse('2026-09-01T10:00:00.000Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();
/** A usage block as the transcript writes it. */
const usage = (output: number, cacheWrite: number, cacheRead: number, ttl: '5m' | '1h' = '5m') => ({
  output_tokens: output,
  input_tokens: 1,
  cache_creation_input_tokens: cacheWrite,
  cache_creation: {
    ephemeral_5m_input_tokens: ttl === '5m' ? cacheWrite : 0,
    ephemeral_1h_input_tokens: ttl === '1h' ? cacheWrite : 0
  },
  cache_read_input_tokens: cacheRead
});
const jsonl = (file: string, lines: unknown[]) =>
  writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);

/**
 * s1: one session with a reviewer, an implementer, an unnamed agent and a nested spawn. Messages span
 * several transcript lines the way Claude Code writes them: one line per content block, every line
 * repeating the request's cache figures, output as a running or final count.
 * s2: an older session outside a September range.
 * s3: a session opened late on 09-02 whose work happens on 09-03.
 */
const fixture = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'wave-cost-'));
  jsonl(join(dir, 's1.jsonl'), [
    { type: 'user', timestamp: at(0), message: { role: 'user', content: 'start the wave' } },
    {
      type: 'assistant',
      timestamp: at(0.9),
      message: {
        id: 'm1',
        model: 'claude-opus-5',
        usage: usage(100, 2_000_000, 500, '1h'),
        content: [{ type: 'thinking', thinking: '…' }]
      }
    },
    {
      type: 'assistant',
      timestamp: at(1),
      message: {
        id: 'm1',
        model: 'claude-opus-5',
        usage: usage(100, 2_000_000, 500, '1h'),
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'Agent',
            input: { description: 'PR A: review', prompt: 'x' }
          },
          {
            type: 'tool_use',
            id: 'tu2',
            name: 'Agent',
            input: { description: 'PR A: button fix', prompt: 'x' }
          }
        ]
      }
    },
    {
      type: 'user',
      timestamp: at(1.1),
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tu1',
            content: [
              {
                type: 'text',
                text: 'Async agent launched successfully.\nagentId: aaa111 (internal ID)'
              }
            ]
          },
          { type: 'tool_result', tool_use_id: 'tu2', content: 'launched\nagentId: bbb222' }
        ]
      }
    },
    {
      type: 'assistant',
      timestamp: at(2),
      message: { id: 'm2', model: 'claude-opus-5', usage: usage(200, 0, 700), content: [] }
    }
  ]);
  const subs = join(dir, 's1', 'subagents');
  mkdirSync(subs, { recursive: true });
  jsonl(join(subs, 'agent-aaa111.jsonl'), [
    {
      type: 'user',
      timestamp: at(1.5),
      message: { role: 'user', content: 'Du bist der adversariale Reviewer für PR 1' }
    },
    {
      type: 'assistant',
      timestamp: at(2),
      message: {
        id: 'r1',
        model: 'claude-opus-5',
        usage: usage(60, 1_500_000, 0),
        content: [
          {
            type: 'tool_use',
            id: 'tu9',
            name: 'Agent',
            input: { description: 'Nested: doc sweep', prompt: 'y' }
          }
        ]
      }
    },
    {
      type: 'user',
      timestamp: at(2.2),
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tu9', content: 'agentId: ddd444' }]
      }
    },
    // r2 spans two lines with a running output count (5, then 20): the message counts once, at 20
    {
      type: 'assistant',
      timestamp: at(3),
      message: {
        id: 'r2',
        model: 'claude-opus-5',
        usage: usage(5, 100, 30_000),
        content: [{ type: 'thinking', thinking: '…' }]
      }
    },
    {
      type: 'assistant',
      timestamp: at(3.01),
      message: {
        id: 'r2',
        model: 'claude-opus-5',
        usage: usage(20, 100, 30_000),
        content: [{ type: 'text', text: 'done' }]
      }
    }
  ]);
  jsonl(join(subs, 'agent-bbb222.jsonl'), [
    {
      type: 'user',
      timestamp: at(2),
      message: {
        role: 'user',
        content: 'Du bist Implementierungs-Agent für PR A. Der Review kommt später.'
      }
    },
    {
      type: 'assistant',
      timestamp: at(2.5),
      message: { id: 'i1', model: 'claude-opus-5', usage: usage(40, 25_000, 0) }
    },
    {
      type: 'assistant',
      timestamp: at(10),
      message: { id: 'i2', model: 'claude-opus-5', usage: usage(60, 400, 25_000) }
    }
  ]);
  jsonl(join(subs, 'agent-ccc333.jsonl'), [
    {
      type: 'user',
      timestamp: at(20),
      message: { role: 'user', content: 'Read the file and summarize it.' }
    },
    // a 400-character tool call recorded with 5 output tokens: the message never reached its final usage
    {
      type: 'assistant',
      timestamp: at(21),
      message: {
        id: 'c1',
        model: 'claude-haiku-4-5',
        usage: usage(5, 1000, 0),
        content: [
          { type: 'tool_use', id: 'tu5', name: 'Bash', input: { command: 'x'.repeat(400) } }
        ]
      }
    }
  ]);
  jsonl(join(subs, 'agent-ddd444.jsonl'), [
    {
      type: 'user',
      timestamp: at(2.3),
      message: { role: 'user', content: 'Sweep the docs for stale sentences.' }
    },
    {
      type: 'assistant',
      timestamp: at(2.4),
      message: { id: 'd1', model: 'claude-haiku-4-5', usage: usage(3, 500, 0) }
    }
  ]);
  jsonl(join(dir, 's2.jsonl'), [
    {
      type: 'user',
      timestamp: '2026-08-01T09:00:00.000Z',
      message: { role: 'user', content: 'older' }
    },
    {
      type: 'assistant',
      timestamp: '2026-08-01T09:01:00.000Z',
      message: { id: 'o1', model: 'claude-opus-5', usage: usage(7, 0, 0) }
    }
  ]);
  jsonl(join(dir, 's3.jsonl'), [
    {
      type: 'user',
      timestamp: '2026-09-02T23:30:00.000Z',
      message: { role: 'user', content: 'evening before the wave' }
    },
    {
      type: 'assistant',
      timestamp: '2026-09-03T00:30:00.000Z',
      message: { id: 'e1', model: 'claude-opus-5', usage: usage(9, 0, 0) }
    }
  ]);
  return dir;
};

describe('wave-cost', () => {
  test('derives the transcript directory the way Claude Code slugs a working directory', () => {
    expect(transcriptDirFor('/Users/felix/Workspace/ui', '/home/x')).toBe(
      '/home/x/.claude/projects/-Users-felix-Workspace-ui'
    );
  });

  test('classifies by the earliest role word, description before prompt, with the evidence', () => {
    expect(classify('', 'Du bist der adversariale Reviewer für PR 1')).toEqual({
      role: 'reviewer',
      evidence: '"adversarial"@12 in prompt'
    });
    expect(
      classify(
        'PR B: auth deps warning',
        'Du bist Implementierungs-Agent für PR2. Der Review kommt später.'
      ).role
    ).toBe('implementer');
    expect(classify('PR A: review', 'You implement the fix')).toEqual({
      role: 'reviewer',
      evidence: '"review"@6 in description'
    });
    expect(classify('', 'Read the file and summarize it.')).toEqual({
      role: 'other',
      evidence: 'none'
    });
  });

  test('a German implementation verb counts, wherever in the briefing it stands', () => {
    const hygiene = 'Worktree-Hygiene: nur Pfade unter dem Worktree. '.repeat(12);
    expect(hygiene.length).toBeGreaterThan(400);
    expect(classify('', `${hygiene}Du wirst #241 Passkey-Rename umsetzen.`).role).toBe(
      'implementer'
    );
    expect(
      classify(
        'Cache-Control-Befund umsetzen',
        'Der Befund stammt aus dem adversarialen Review von PR #388.'
      ).role
    ).toBe('implementer');
  });

  test('a negated role word and a compound that only contains one do not decide', () => {
    expect(
      classify('Change-Cost: neue Auth-Achse', 'Nur lesen. Nichts implementieren, nichts ändern.')
        .role
    ).toBe('other');
    expect(
      classify('Blind-Dossier', 'Schreibe ein implementierungsneutrales Anforderungsdossier.').role
    ).toBe('other');
    expect(classify('', 'This is not a review. Implement the change.').role).toBe('implementer');
    // a branch named as location is not a role: the sweep below is read-only
    expect(
      classify(
        'Sweep for width assumptions',
        'In the repo (branch fix/restwelle, do NOT change the branch, do NOT edit files) list every width assumption.'
      ).role
    ).toBe('other');
  });

  test('sums usage per message, maps subagents to their spawn description, counts peak concurrency', () => {
    const report = analyze(fixture(), { since: '2026-09-01', until: '2026-09-01' });
    expect(report.sessions.map((s) => s.session)).toEqual(['s1']);
    expect(report.subagentCount).toBe(4);
    const [s1] = report.sessions;
    // message m1 spans two transcript lines that repeat its figures: two turns in all, figures taken once
    expect(s1.orchestrator).toEqual({
      turns: 2,
      turnsWithFinalUsage: 2,
      output: 300,
      inputUncached: 2,
      cacheWrite: 2_000_000,
      cacheWrite5m: 0,
      cacheRead: 1200,
      turnsAfterPause: 0,
      cacheWriteAfterPause: 0,
      cacheReadAfterPause: 0
    });
    const byId = Object.fromEntries(s1.subagents.map((a) => [a.id, a]));
    expect(byId.aaa111.role).toBe('reviewer');
    expect(byId.aaa111.description).toBe('PR A: review');
    expect(byId.aaa111.roleEvidence).toBe('"review"@6 in description');
    expect(byId.aaa111.firstTurnCacheWrite).toBe(1_500_000);
    expect(byId.aaa111.activeMinutes).toBe(3);
    expect(byId.bbb222.role).toBe('implementer');
    expect(byId.bbb222.description).toBe('PR A: button fix');
    expect(byId.ccc333.role).toBe('other');
    expect(byId.ccc333.description).toBe('');
    // spawned by the reviewer, so its spawn record sits in the reviewer's transcript, not in s1.jsonl
    expect(byId.ddd444.description).toBe('Nested: doc sweep');
    expect(byId.ddd444.role).toBe('other');
    // r2's two lines count once, at the final 20, and its cache figures once
    expect(s1.byRole.reviewer).toEqual({
      turns: 2,
      turnsWithFinalUsage: 2,
      output: 80,
      inputUncached: 2,
      cacheWrite: 1_500_100,
      cacheWrite5m: 1_500_100,
      cacheRead: 30_000,
      turnsAfterPause: 0,
      cacheWriteAfterPause: 0,
      cacheReadAfterPause: 0
    });
    expect(s1.byRole.implementer.output).toBe(100);
    // the implementer's second turn came 7.5 minutes after its first: a five-minute cache had expired by then
    expect(s1.byRole.implementer.turnsAfterPause).toBe(1);
    expect(s1.byRole.implementer.cacheWriteAfterPause).toBe(400);
    expect(s1.byRole.implementer.cacheReadAfterPause).toBe(25_000);
    expect(s1.byRole.other.output).toBe(8);
    expect(s1.byRole.other.turns).toBe(2);
    // ccc333's only message shows 5 output tokens for a 400-character tool call
    expect(s1.byRole.other.turnsWithFinalUsage).toBe(1);
    // minute 2 after T0 holds a message of the reviewer, the implementer and the nested agent; nothing else overlaps
    expect(s1.peakActive).toBe(3);
    expect(report.totals.orchestrator.output).toBe(300);
    expect(report.totals.reviewer.cacheRead).toBe(30_000);
  });

  test('the range keeps every session whose activity overlaps it, and reports its first day', () => {
    const dir = fixture();
    const ids = (o: Parameters<typeof analyze>[1]) =>
      analyze(dir, o).sessions.map((s) => s.session);
    expect(ids({})).toEqual(['s1', 's2', 's3']);
    // s3 started on 09-02 and worked on 09-03: it belongs to a wave that starts on 09-03
    expect(ids({ since: '2026-09-03' })).toEqual(['s3']);
    expect(ids({ until: '2026-09-02' })).toEqual(['s1', 's2', 's3']);
    expect(ids({ until: '2026-08-31' })).toEqual(['s2']);
    expect(ids({ session: 's2' })).toEqual(['s2']);
    expect(analyze(dir, { since: '2026-09-03' }).sessions[0].start).toBe(
      '2026-09-02T23:30:00.000Z'
    );
  });

  test('fails loud instead of printing zeros or widening the range', () => {
    expect(() => analyze(join(tmpdir(), 'wave-cost-does-not-exist'))).toThrow(
      /no transcript directory/
    );
    expect(() => analyze(fixture(), { since: '2026-10-01' })).toThrow(/no sessions/);
    expect(() => analyze(fixture(), { until: '2026-9-15' })).toThrow(/--until must be YYYY-MM-DD/);
    expect(() => analyze(fixture(), { since: '20260901' })).toThrow(/--since must be YYYY-MM-DD/);
  });

  test('the text rendering carries every role total, the TTL split, the floor marks and the per-agent rows', () => {
    const text = renderText(analyze(fixture(), { since: '2026-09-01', until: '2026-09-01' }), true);
    const line = (role: string) => text.split('\n').find((l) => l.startsWith(role)) ?? '';
    expect(line('orchestrator')).toContain('turns=2');
    expect(line('orchestrator')).toContain('(5m 0.0M, 1h 2.0M)');
    expect(line('reviewer')).toContain('(5m 1.5M, 1h 0.0M)');
    expect(line('reviewer')).not.toContain('floor');
    expect(line('implementer')).toContain('after >5min pause: 1 turns');
    expect(line('other')).toContain('(floor: final usage on 1 of 2 turns)');
    expect(text).toContain('PR A: review');
    expect(text).toContain('first 1500k');
    expect(text).toContain('"review"@6 in description');
    expect(text).toContain('out 0k+');
    expect(text).toContain('subagents: 4  sessions: 1');
  });

  test('the CLI exits non-zero with the reason on a missing directory or a malformed date', () => {
    const root = join(import.meta.dir, '..');
    const missing = Bun.spawnSync(
      ['bun', 'scripts/wave-cost.ts', '--transcripts', join(tmpdir(), 'wave-cost-does-not-exist')],
      { cwd: root }
    );
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr.toString()).toContain('wave-cost: no transcript directory');
    const malformed = Bun.spawnSync(
      ['bun', 'scripts/wave-cost.ts', '--transcripts', fixture(), '--until', '2026-9-15'],
      { cwd: root }
    );
    expect(malformed.exitCode).toBe(1);
    expect(malformed.stderr.toString()).toContain('--until must be YYYY-MM-DD');
    const ok = Bun.spawnSync(
      ['bun', 'scripts/wave-cost.ts', '--transcripts', fixture(), '--json'],
      { cwd: root }
    );
    expect(ok.exitCode).toBe(0);
    expect(JSON.parse(ok.stdout.toString()).subagentCount).toBe(4);
  });
});
