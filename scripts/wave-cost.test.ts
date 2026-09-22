import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, classify, renderText, transcriptDirFor } from './wave-cost';

const T0 = Date.parse('2026-09-01T10:00:00.000Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();
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

/** One session with three subagents, plus an older session outside the range. */
const fixture = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'wave-cost-'));
  jsonl(join(dir, 's1.jsonl'), [
    { type: 'user', timestamp: at(0), message: { role: 'user', content: 'start the wave' } },
    {
      type: 'assistant',
      timestamp: at(1),
      message: {
        model: 'claude-opus-5',
        usage: usage(100, 50, 500, '1h'),
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
      message: { model: 'claude-opus-5', usage: usage(200, 0, 700), content: [] }
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
      message: { model: 'claude-opus-5', usage: usage(10, 30_000, 0) }
    },
    {
      type: 'assistant',
      timestamp: at(3),
      message: { model: 'claude-opus-5', usage: usage(20, 100, 30_000) }
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
      message: { model: 'claude-opus-5', usage: usage(40, 25_000, 0) }
    },
    {
      type: 'assistant',
      timestamp: at(10),
      message: { model: 'claude-opus-5', usage: usage(60, 400, 25_000) }
    }
  ]);
  jsonl(join(subs, 'agent-ccc333.jsonl'), [
    {
      type: 'user',
      timestamp: at(20),
      message: { role: 'user', content: 'Read the file and summarize it.' }
    },
    {
      type: 'assistant',
      timestamp: at(21),
      message: { model: 'claude-haiku-4-5', usage: usage(5, 1000, 0) }
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
      message: { model: 'claude-opus-5', usage: usage(7, 0, 0) }
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

  test('classifies by the earliest role word, description before prompt', () => {
    expect(classify('', 'Du bist der adversariale Reviewer für PR 1')).toBe('reviewer');
    expect(
      classify(
        'PR B: auth deps warning',
        'Du bist Implementierungs-Agent für PR2. Der Review kommt später.'
      )
    ).toBe('implementer');
    expect(classify('PR A: review', 'You implement the fix')).toBe('reviewer');
    expect(classify('', 'Read the file and summarize it.')).toBe('other');
  });

  test('sums usage per role, maps subagents to their spawn description, counts peak concurrency', () => {
    const report = analyze(fixture(), { since: '2026-09-01' });
    expect(report.sessions.map((s) => s.session)).toEqual(['s1']);
    expect(report.subagentCount).toBe(3);
    const [s1] = report.sessions;
    expect(s1.orchestrator).toEqual({
      turns: 2,
      output: 300,
      inputUncached: 2,
      cacheWrite: 50,
      cacheWrite5m: 0,
      cacheRead: 1200,
      turnsAfterPause: 0,
      cacheWriteAfterPause: 0,
      cacheReadAfterPause: 0
    });
    const byId = Object.fromEntries(s1.subagents.map((a) => [a.id, a]));
    expect(byId.aaa111.role).toBe('reviewer');
    expect(byId.aaa111.description).toBe('PR A: review');
    expect(byId.aaa111.firstTurnCacheWrite).toBe(30_000);
    expect(byId.aaa111.activeMinutes).toBe(3);
    expect(byId.bbb222.role).toBe('implementer');
    expect(byId.bbb222.description).toBe('PR A: button fix');
    expect(byId.ccc333.role).toBe('other');
    expect(byId.ccc333.description).toBe('');
    expect(s1.byRole.reviewer).toEqual({
      turns: 2,
      output: 30,
      inputUncached: 2,
      cacheWrite: 30_100,
      cacheWrite5m: 30_100,
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
    expect(s1.byRole.other.output).toBe(5);
    // minute 2 after T0 holds a message of the reviewer and of the implementer; nothing else overlaps
    expect(s1.peakActive).toBe(2);
    expect(report.totals.orchestrator.output).toBe(300);
    expect(report.totals.reviewer.cacheRead).toBe(30_000);
  });

  test('the range filter reads the first message of a session', () => {
    const dir = fixture();
    expect(analyze(dir).sessions.map((s) => s.session)).toEqual(['s1', 's2']);
    expect(analyze(dir, { until: '2026-08-31' }).sessions.map((s) => s.session)).toEqual(['s2']);
    expect(analyze(dir, { session: 's2' }).sessions.map((s) => s.session)).toEqual(['s2']);
  });

  test('fails loud instead of printing zeros', () => {
    expect(() => analyze(join(tmpdir(), 'wave-cost-does-not-exist'))).toThrow(
      /no transcript directory/
    );
    expect(() => analyze(fixture(), { since: '2026-10-01' })).toThrow(/no sessions/);
  });

  test('the text rendering carries every role total and the per-agent rows', () => {
    const text = renderText(analyze(fixture(), { since: '2026-09-01' }), true);
    expect(text).toContain('orchestrator turns=2');
    expect(text).toContain('(5m 0.0M, 1h 0.0M)');
    expect(text).toContain('after >5min pause: 1 turns');
    expect(text).toContain('PR A: review');
    expect(text).toContain('first 30k');
    expect(text).toContain('subagents: 3  sessions: 1');
  });

  test('the CLI exits non-zero with the reason on a missing directory', () => {
    const run = Bun.spawnSync(
      ['bun', 'scripts/wave-cost.ts', '--transcripts', join(tmpdir(), 'wave-cost-does-not-exist')],
      { cwd: join(import.meta.dir, '..') }
    );
    expect(run.exitCode).toBe(1);
    expect(run.stderr.toString()).toContain('wave-cost: no transcript directory');
    const ok = Bun.spawnSync(
      ['bun', 'scripts/wave-cost.ts', '--transcripts', fixture(), '--json'],
      {
        cwd: join(import.meta.dir, '..')
      }
    );
    expect(ok.exitCode).toBe(0);
    expect(JSON.parse(ok.stdout.toString()).subagentCount).toBe(3);
  });
});
