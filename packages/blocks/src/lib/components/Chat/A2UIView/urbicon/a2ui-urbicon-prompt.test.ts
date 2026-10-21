import { describe, expect, it } from 'vitest';
import { a2uiSystemPrompt } from '../a2ui-prompt';
import {
  URBICON_A2UI_CATALOG_ID,
  URBICON_A2UI_ICON_NAMES,
  URBICON_A2UI_REGISTRY,
  urbiconA2uiCatalogSpec
} from './a2ui-urbicon-registry';

const prompt = a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec });

describe('Urbicon system prompt', () => {
  it('advertises the Urbicon catalog id', () => {
    expect(prompt).toContain(URBICON_A2UI_CATALOG_ID);
  });

  it('stays under the length ceiling', () => {
    // A budget, not a measured threshold: a prompt that outgrows it raises this
    // number on purpose. `length` counts UTF-16 code units, not bytes.
    expect(prompt.length).toBeLessThan(24000);
  });

  it('documents the shared axes once (intent + size)', () => {
    expect(prompt).toContain('## Shared axes');
    expect(prompt).toContain('intent: primary | secondary | success | warning | danger | neutral');
    expect(prompt).toContain('size: sm | md | lg');
  });

  it('groups components by category', () => {
    for (const category of ['### Layout', '### Text', '### Form', '### Status', '### Media']) {
      expect(prompt).toContain(category);
    }
  });

  it("carries the catalog-specific don'ts", () => {
    expect(prompt).toContain('Text renders PLAIN');
    expect(prompt).toContain('RichText');
    expect(prompt).toContain('Select `value` is ALWAYS a string ARRAY');
    expect(prompt).toContain('`error` string prop');
  });

  it('teaches the logic functions and the consent gate on Button.disabled', () => {
    expect(prompt).toContain('{ "call": "not", "args": { "value": B } }');
    expect(prompt).toContain('{ "call": "and" | "or", "args": { "values": [B, B, ...] } }');
    expect(prompt).toContain('Only true');
    expect(prompt).toContain(
      '- disabled (optional; boolean literal, { path } binding or not/and/or call): '
    );
    expect(prompt).toContain('{ "call": "not", "args": { "value": { "path": "/agreed" } } }');
    // Rendered from Button.disabled's failsafe, not written into its description.
    expect(prompt).toContain('holds it at true.');
    expect(prompt).toContain('(2 or more B)');
    expect(prompt).toContain('function calls other than not/and/or');
  });

  it('does not offer the logic functions on a two-way input value', () => {
    expect(prompt).not.toMatch(/- value \([^)]*not\/and\/or call\)/);
  });

  it('omits any transport / data-schema section (app-specific)', () => {
    expect(prompt).not.toContain('```a2ui');
    expect(prompt).not.toContain('SSE');
    expect(prompt).not.toContain('## Data schema');
  });

  it('lists the mapped icon names', () => {
    for (const name of URBICON_A2UI_ICON_NAMES) expect(prompt).toContain(name);
  });
});

// Drift guard: every component, prop and enum value in the registry must be
// surfaced in the prompt (a new one that isn't fails the build). Shared-axis
// props are compressed to a reference, so their values are checked via the
// Shared axes section, not per component.
describe('Urbicon prompt drift guard', () => {
  for (const [componentName, spec] of Object.entries(URBICON_A2UI_REGISTRY)) {
    describe(componentName, () => {
      it('appears in the prompt', () => {
        expect(prompt).toContain(componentName);
      });
      for (const [propKey, propSpec] of Object.entries(spec.props)) {
        if (propSpec.promptHidden) continue;
        const isCommon = propKey === 'accessibility' || propKey === 'weight';
        if (isCommon) continue;
        it(`documents prop "${propKey}"`, () => {
          expect(prompt).toContain(propKey);
        });
        const shared = (propSpec as { sharedAxis?: string }).sharedAxis;
        if (propSpec.values && !shared) {
          for (const value of propSpec.values) {
            it(`documents enum value "${propKey}=${value}"`, () => {
              expect(prompt).toContain(value);
            });
          }
        }
      }
    });
  }
});
