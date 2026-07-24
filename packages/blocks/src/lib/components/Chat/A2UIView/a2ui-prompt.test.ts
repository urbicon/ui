import { describe, expect, it } from 'vitest';
import { a2uiSystemPrompt } from './a2ui-prompt';
import {
  A2UI_CATALOG_ID,
  A2UI_ICON_NAMES,
  A2UI_REGISTRY,
  UNSUPPORTED_A2UI_COMPONENTS
} from './a2ui-registry';

const prompt = a2uiSystemPrompt();

describe('a2uiSystemPrompt', () => {
  it('advertises the default catalog id', () => {
    expect(prompt).toContain(A2UI_CATALOG_ID);
  });

  it('honors a custom catalog id', () => {
    const custom = a2uiSystemPrompt({ catalogId: 'acme.com:catalog/v1' });
    expect(custom).toContain('acme.com:catalog/v1');
    expect(custom).not.toContain(A2UI_CATALOG_ID);
  });

  it('states the core envelope rules', () => {
    expect(prompt).toContain('v0.9.1');
    expect(prompt).toContain('root');
    expect(prompt.toLowerCase()).toContain('one json envelope per line');
    expect(prompt).toContain('createSurface');
    expect(prompt).toContain('updateComponents');
    expect(prompt).toContain('updateDataModel');
    expect(prompt).toContain('deleteSurface');
  });

  it('explains child vs children and the template form', () => {
    expect(prompt).toContain('child');
    expect(prompt).toContain('children');
    expect(prompt).toContain('componentId');
  });

  it('forbids function-call bindings and actions', () => {
    expect(prompt).toContain('Function-call bindings');
    expect(prompt).toContain('NOT supported');
    expect(prompt.toLowerCase()).toContain('do not use local function-call actions');
  });

  it('omits any transport section (app-specific)', () => {
    expect(prompt).not.toContain('```a2ui');
    expect(prompt).not.toContain('SSE');
    expect(prompt).not.toContain('Server-Sent');
  });

  it('lists the mapped icon names', () => {
    for (const name of A2UI_ICON_NAMES) expect(prompt).toContain(name);
  });

  it('warns against unsupported components', () => {
    for (const name of UNSUPPORTED_A2UI_COMPONENTS) expect(prompt).toContain(name);
  });
});

// The single source of truth (registry) must be fully reflected in the prompt.
// A new component, prop, or enum value that is not surfaced here fails the build.
describe('registry drift guard', () => {
  for (const [componentName, spec] of Object.entries(A2UI_REGISTRY)) {
    describe(componentName, () => {
      it('appears in the prompt', () => {
        expect(prompt).toContain(componentName);
      });

      for (const [propKey, propSpec] of Object.entries(spec.props)) {
        if (propSpec.promptHidden) continue;
        it(`documents prop "${propKey}"`, () => {
          expect(prompt).toContain(propKey);
        });
        if (propSpec.values) {
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
