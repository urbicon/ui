import { describe, expect, it } from 'vitest';
import { A2UI_FENCE_TAG, A2uiStreamSplitter, a2uiFencedTransportSection } from './a2ui-stream';

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
