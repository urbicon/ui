import { describe, expect, it } from 'vitest';
import {
  A2UI_CATALOG_ID,
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
        { version: '1.0', createSurface: { surfaceId: 's', catalogId: A2UI_CATALOG_ID } },
        {
          version: '1.0',
          updateComponents: {
            surfaceId: 's',
            components: [{ id: 'title', component: 'Text', text: 'No root yet' }]
          }
        }
      ]
    };
    const errors = validateA2uiPayload(args).filter((issue) => issue.severity === 'error');
    expect(errors.map((issue) => issue.code)).toEqual(['MISSING_ROOT']);
    expect(a2uiErrorMessage(errors)).toMatch(
      /^\[ui-error\] \[\{"surfaceId":"s","issues":\[\{"severity":"error"/
    );
  });

  it('names a long surfaceId once, however many issues it has', () => {
    const turn = (surfaceId: string) => {
      const errors = validateA2uiPayload({
        messages: [
          { version: '1.0', createSurface: { surfaceId, catalogId: A2UI_CATALOG_ID } },
          {
            version: '1.0',
            updateComponents: {
              surfaceId,
              components: Array.from({ length: 500 }, (_, i) => ({
                id: `c${i}`,
                component: 'Nope'
              }))
            }
          }
        ]
      }).filter((issue) => issue.severity === 'error');
      expect(errors.length).toBeGreaterThan(500);
      return a2uiErrorMessage(errors);
    };
    // The same payload with a 100 000-character id instead of a 1-character
    // one: the turn grows by the difference once, not once per issue.
    const long = 's'.repeat(100_000);
    expect(turn(long).length - turn('s').length).toBe(long.length - 1);
  });
});
