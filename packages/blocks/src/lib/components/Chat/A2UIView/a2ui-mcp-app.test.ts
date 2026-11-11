import { describe, expect, it } from 'vitest';
import { healedPrefix } from './__fixtures__/healed-json';
import { exButton } from './__fixtures__/spec/ex_button';
import { exChildlist } from './__fixtures__/spec/ex_childlist';
import { exIncremental } from './__fixtures__/spec/ex_incremental';
import { exLogin } from './__fixtures__/spec/ex_login';
import { exSimpleText } from './__fixtures__/spec/ex_simple_text';
import type { A2uiActionEvent, A2uiValidationIssue } from './a2ui.types';
import { A2uiToolInputStabilizer, a2uiMcpAppTransportSection } from './a2ui-mcp-app';
import { a2uiActionMessage, a2uiErrorMessage } from './a2ui-stream';

const V = 'v0.9.1';
const SPEC = { exButton, exChildlist, exIncremental, exLogin, exSimpleText };

/** The `{ messages }` arguments of a `render_ui`-shaped tool, as the model writes them. */
function argumentsText(messages: readonly unknown[]): string {
  return JSON.stringify({ messages });
}

/**
 * Every prefix of the arguments text, healed. Cut at every character: a fixed
 * step would skip exactly the cut that lands inside a short value.
 */
function healedSnapshots(text: string): unknown[] {
  const out: unknown[] = [];
  for (let end = 1; end < text.length; end++) out.push(healedPrefix(text, end));
  return out;
}

describe('A2uiToolInputStabilizer — over every healed prefix of the spec examples', () => {
  for (const [name, fixture] of Object.entries(SPEC)) {
    const text = argumentsText(fixture.messages);
    const snapshots = healedSnapshots(text);

    // The hazard has to be in the population, or the assertions below hold for
    // any implementation. Fed raw, consecutive snapshots never share an
    // envelope object, and some snapshot ends in a cut-short envelope.
    it(`${name}: the raw snapshots carry both hazards`, () => {
      const lists = snapshots.map((s) => (s as { messages?: unknown[] }).messages ?? []);
      const shared = lists.some(
        (list, i) => i > 0 && list.length > 0 && list[0] === lists[i - 1][0]
      );
      expect(shared).toBe(false);
      const cutShort = lists.some((list) => {
        const last = list.length - 1;
        return last >= 0 && JSON.stringify(list[last]) !== JSON.stringify(fixture.messages[last]);
      });
      expect(cutShort).toBe(true);
    });

    it(`${name}: passes on only finished envelopes, each one object for good`, () => {
      const stabilizer = new A2uiToolInputStabilizer();
      let previous: unknown[] = [];
      for (const snapshot of snapshots) {
        const payload = stabilizer.partial(snapshot);
        for (let i = 0; i < previous.length; i++) expect(payload[i]).toBe(previous[i]);
        for (let i = 0; i < payload.length; i++) expect(payload[i]).toEqual(fixture.messages[i]);
        previous = payload;
      }
      const final = stabilizer.complete(JSON.parse(text)) as unknown[];
      for (let i = 0; i < previous.length; i++) expect(final[i]).toBe(previous[i]);
      expect(final).toEqual(fixture.messages);
    });
  }
});

describe('A2uiToolInputStabilizer — contract', () => {
  const create = { version: V, createSurface: { surfaceId: 's', catalogId: 'x' } };
  const text = (value: string) => ({
    version: V,
    updateComponents: {
      surfaceId: 's',
      components: [{ id: 'root', component: 'Text', text: value }]
    }
  });

  it('holds the last envelope back until another appears behind it', () => {
    const stabilizer = new A2uiToolInputStabilizer();
    expect(stabilizer.partial({ messages: [create] })).toEqual([]);
    const first = stabilizer.partial({ messages: [create, text('Hel')] });
    expect(first).toEqual([create]);
    expect(stabilizer.partial({ messages: [create, text('Hello')] })).toBe(first);
  });

  it('returns the same payload object while nothing new is finished', () => {
    const stabilizer = new A2uiToolInputStabilizer();
    const a = stabilizer.partial({ messages: [create, text('a')] });
    const b = stabilizer.partial({ messages: [structuredClone(create), text('ab')] });
    expect(b).toBe(a);
  });

  it('keeps what it passed on when a later partial shows less of it', () => {
    const stabilizer = new A2uiToolInputStabilizer();
    const before = stabilizer.partial({ messages: [create, text('x'), text('y')] });
    expect(stabilizer.partial({ messages: [create] })).toBe(before);
  });

  it('rebuilds, with new objects, when an envelope already passed on changes', () => {
    const stabilizer = new A2uiToolInputStabilizer();
    const before = stabilizer.partial({ messages: [create, text('one'), text('…')] });
    const changed = { version: V, createSurface: { surfaceId: 'other', catalogId: 'x' } };
    const after = stabilizer.partial({ messages: [changed, text('one'), text('…')] });
    expect(after).not.toBe(before);
    expect(after[0]).not.toBe(before[0]);
    expect(after).toEqual([changed, text('one')]);
  });

  it('rebuilds when the final arguments drop an envelope it passed on', () => {
    const stabilizer = new A2uiToolInputStabilizer();
    stabilizer.partial({ messages: [create, text('one'), text('two')] });
    expect(stabilizer.complete({ messages: [create] })).toEqual([create]);
  });

  it('reads every payload form normalizeA2uiPayload reads', () => {
    const asArray = new A2uiToolInputStabilizer();
    expect(asArray.partial([create, text('a')])).toEqual([create]);
    expect(asArray.complete([create, text('a')])).toEqual([create, text('a')]);

    const single = new A2uiToolInputStabilizer();
    expect(single.partial(create)).toEqual([]);
    expect(single.complete(create)).toEqual([create]);
  });

  it('hands unreadable final arguments to the view unchanged, and ignores an unreadable partial', () => {
    const stabilizer = new A2uiToolInputStabilizer();
    const before = stabilizer.partial({ messages: [create, text('a')] });
    expect(stabilizer.partial(null)).toBe(before);
    expect(stabilizer.complete('not a payload')).toBe('not a payload');
  });
});

describe('a2uiMcpAppTransportSection', () => {
  const section = a2uiMcpAppTransportSection();

  it('asks for one complete surface per call and never a patch', () => {
    expect(section).toContain('"messages" argument');
    expect(section).toContain('One call is one complete, self-contained surface');
    expect(section).toContain('A view you already showed can never be changed');
    expect(section).toContain('call again with the COMPLETE');
    expect(section).not.toContain('patch');
    expect(section).not.toContain('```');
  });

  it('describes the action and error messages the formatters write', () => {
    const event: A2uiActionEvent = {
      name: 'book',
      surfaceId: 's',
      sourceComponentId: 'go',
      timestamp: '2026-11-11T00:00:00.000Z',
      context: {}
    };
    const issues: A2uiValidationIssue[] = [{ severity: 'error', code: 'X', message: 'm' }];
    for (const options of [undefined, { actionPrefix: '>>act', errorPrefix: '>>err' }]) {
      const text = a2uiMcpAppTransportSection(options);
      const action = a2uiActionMessage(event, options);
      const error = a2uiErrorMessage(issues, options);
      const actionPrefix = action.slice(0, action.indexOf(' ') + 1);
      const errorPrefix = error.slice(0, error.indexOf(' ') + 1);
      expect(text).toContain(`\`${actionPrefix}\``);
      expect(text).toContain(`\`${errorPrefix}\``);
      expect(JSON.parse(action.slice(actionPrefix.length))).toEqual(event);
      expect(JSON.parse(error.slice(errorPrefix.length))).toEqual(issues);
    }
  });

  it('omits the round channel when both prefixes are off', () => {
    const bare = a2uiMcpAppTransportSection({ actionPrefix: false, errorPrefix: false });
    expect(bare).not.toContain('## Interaction round-channel');
    expect(bare).toContain('"messages" argument');
  });
});
