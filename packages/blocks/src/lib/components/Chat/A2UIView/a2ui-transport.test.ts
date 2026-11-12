import { describe, expect, it } from 'vitest';
import type { A2uiActionEvent, A2uiValidationIssue } from './a2ui.types';
import {
  A2UI_FENCE_TAG,
  A2uiStreamSplitter,
  a2uiActionMessage,
  a2uiErrorMessage,
  a2uiFencedTransportSection
} from './a2ui-stream';

/**
 * The transport section and the splitter are one contract. These tests assert
 * the contract holds from BOTH ends: what the prompt tells the agent to write is
 * what the splitter reads back.
 */
describe('a2uiFencedTransportSection', () => {
  const section = a2uiFencedTransportSection();

  it('names the very fence tag the splitter accepts', () => {
    expect(section).toContain(`\`\`\`${A2UI_FENCE_TAG}`);
  });

  it('describes a format the splitter actually reads', () => {
    // Follow the section's own instructions to the letter — open with the tag it
    // names, one compact envelope per line, close with a bare fence — and check
    // the parser accepts the result. The prompt's printed example is deliberately
    // illustrative (it carries `…` placeholders), so the contract is tested with
    // real envelopes rather than by re-parsing the sample.
    const open = section.split('\n').find((line) => line.trim() === `\`\`\`${A2UI_FENCE_TAG}`);
    expect(open, 'the section must show an exact opening fence line').toBeDefined();

    const splitter = new A2uiStreamSplitter();
    splitter.push('Here you go:\n');
    splitter.push(`${open}\n`);
    splitter.push('{"version":"v0.9.1","createSurface":{"surfaceId":"s","catalogId":"c"}}\n');
    splitter.push(
      '{"version":"v0.9.1","updateComponents":{"surfaceId":"s","components":[{"id":"root","component":"Text","text":"hi"}]}}\n'
    );
    splitter.push('```\nAnything else?');
    splitter.end();

    const ui = splitter.snapshot().find((part) => part.type === 'a2ui');
    expect(ui?.payload).toHaveLength(2);
    expect(splitter.issues).toEqual([]);
  });

  it('documents the cross-message patch path and sendDataModel', () => {
    expect(section).toContain('surfaceId (no');
    expect(section).toContain('sendDataModel');
  });

  // These hold only because the router delivers a later turn's envelopes into
  // the message that owns the surface, so they live here and not in
  // a2uiSystemPrompt().
  it('carries the lifecycle rules that need a later turn to reach the surface', () => {
    expect(section.toLowerCase()).toContain('one json envelope per line');
    expect(section).toContain('it updates in place, keeping what the user');
    expect(section).toContain('Never createSurface twice for one id');
    expect(section).toContain('deleteSurface when a surface has served its purpose.');
    expect(section).toContain('patch a short message next to the offending field');
  });

  it('keeps them when the round channel is off', () => {
    const bare = a2uiFencedTransportSection({ actionPrefix: false, errorPrefix: false });
    expect(bare).toContain('Never createSurface twice for one id');
    expect(bare).toContain('patch a short message next to the offending field');
  });

  describe('round-channel', () => {
    it('uses the default prefixes', () => {
      expect(section).toContain('`[ui-action] `');
      expect(section).toContain('`[ui-error] `');
    });

    it('takes custom prefixes', () => {
      const custom = a2uiFencedTransportSection({
        actionPrefix: '>>act',
        errorPrefix: '>>err'
      });

      expect(custom).toContain('`>>act `');
      expect(custom).toContain('`>>err `');
      expect(custom).not.toContain('[ui-action]');
    });

    it('omits the channel entirely when both are off', () => {
      const bare = a2uiFencedTransportSection({ actionPrefix: false, errorPrefix: false });

      expect(bare).not.toContain('## Interaction round-channel');
      // …but the fence contract itself is never optional.
      expect(bare).toContain(`\`\`\`${A2UI_FENCE_TAG}`);
    });

    it('keeps the error half when only actions are off', () => {
      const errorsOnly = a2uiFencedTransportSection({ actionPrefix: false });

      expect(errorsOnly).toContain('## Interaction round-channel');
      expect(errorsOnly).toContain('`[ui-error] `');
      expect(errorsOnly).not.toContain('[ui-action]');
    });
  });
});

describe('a2uiActionMessage / a2uiErrorMessage', () => {
  const event: A2uiActionEvent = {
    name: 'book',
    surfaceId: 's',
    sourceComponentId: 'go',
    timestamp: '2026-11-11T00:00:00.000Z',
    context: { guests: 2 }
  };
  const issues: A2uiValidationIssue[] = [
    { severity: 'error', code: 'MISSING_ROOT', surfaceId: 's', message: 'No root' }
  ];

  it('writes the turn the section describes: the prefix, a space, compact JSON', () => {
    for (const options of [undefined, { actionPrefix: '>>act', errorPrefix: '>>err' }]) {
      const text = a2uiFencedTransportSection(options);
      const action = a2uiActionMessage(event, options);
      const error = a2uiErrorMessage(issues, options);
      const actionPrefix = action.slice(0, action.indexOf(' ') + 1);
      const errorPrefix = error.slice(0, error.indexOf(' ') + 1);

      expect(text).toContain(`\`${actionPrefix}\``);
      expect(text).toContain(`\`${errorPrefix}\``);
      expect(action).toBe(`${actionPrefix}${JSON.stringify(event)}`);
      expect(error).toBe(`${errorPrefix}${JSON.stringify(issues)}`);
    }
  });

  it('refuses a prefix the options turned off — no prompt describes that message', () => {
    expect(() => a2uiActionMessage(event, { actionPrefix: false })).toThrow(TypeError);
    expect(() => a2uiErrorMessage(issues, { errorPrefix: false })).toThrow(TypeError);
  });
});
