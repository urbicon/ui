import { describe, expect, it } from 'vitest';
import {
  a2uiErrorMessage,
  a2uiFencedTransportSection,
  a2uiSystemPrompt,
  urbiconA2uiCatalogSpec,
  validateA2uiPayload
} from './index';

// The server's whole path through the engine, in the node environment: no
// `document`, no component mounted, nothing imported but this entry. That the
// entry also loads without the Svelte compiler is asked of plain Bun and Node
// against the packed tarball (scripts/consumer-css-check.test.ts) — vitest
// compiles `.svelte` on import, so it cannot tell.
describe('@urbicon-ui/blocks/a2ui without a DOM', () => {
  it('runs in an environment without a document', () => {
    expect(typeof document).toBe('undefined');
  });

  it('builds a prompt and validates a payload', () => {
    const prompt = [
      a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }),
      a2uiFencedTransportSection()
    ].join('\n\n');
    expect(prompt).toContain('```a2ui');

    const args = {
      messages: [
        { version: 'v0.9.1', createSurface: { surfaceId: 's', catalogId: 'x' } },
        {
          version: 'v0.9.1',
          updateComponents: {
            surfaceId: 's',
            components: [{ id: 'title', component: 'Text', text: 'No root yet' }]
          }
        }
      ]
    };
    const errors = validateA2uiPayload(args).filter((issue) => issue.severity === 'error');
    expect(errors.map((issue) => issue.code)).toEqual(['MISSING_ROOT']);
    expect(a2uiErrorMessage(errors)).toMatch(/^\[ui-error\] \[\{"severity":"error"/);
  });
});
