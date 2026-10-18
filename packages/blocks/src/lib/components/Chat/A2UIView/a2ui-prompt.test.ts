import { describe, expect, it } from 'vitest';
import { A2UI_ISSUE_CODES } from './a2ui.types';
import { a2uiSystemPrompt } from './a2ui-prompt';
import {
  A2UI_CATALOG_ID,
  A2UI_ICON_NAMES,
  A2UI_REGISTRY,
  UNSUPPORTED_A2UI_COMPONENTS
} from './a2ui-registry';
import { a2uiSurfaceRequirementsSection } from './a2ui-requirements';
import { urbiconA2uiCatalogSpec } from './urbicon/a2ui-urbicon-registry';

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

  // No Basic prop declares a failsafe, so nothing would accept the form.
  it('does not offer the logic functions where no prop accepts them', () => {
    expect(prompt).not.toContain('"call": "not"');
    expect(prompt).not.toContain('not/and/or');
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

describe('a2uiSurfaceRequirementsSection', () => {
  const section = a2uiSurfaceRequirementsSection(
    {
      booking: [
        {
          component: 'Checkbox',
          path: '/agreed',
          description: 'consent to the cancellation policy'
        },
        { component: 'Button', prop: 'disabled', path: '/locked' },
        // Never meetable on this catalog — left out rather than asked for.
        { component: 'CheckBox' },
        { component: 'Checkbox', prop: 'checked', path: '/agreed' },
        { component: 'Checkbox', path: 'agreed' },
        { component: 'Separator' }
      ],
      unmeetable: [{ component: 'Modal' }],
      chat: []
    },
    urbiconA2uiCatalogSpec
  );

  it('pins the surfaceId and lists each requirement in the words the issue uses', () => {
    expect(section).toContain('## Required components');
    expect(section).toContain('use exactly');
    expect(section).toContain('the surfaceId listed');
    expect(section).toContain('- Surface "booking" must contain:');
    expect(section).toContain(
      '  - a Checkbox with value bound to { "path": "/agreed" } (consent to the cancellation policy)'
    );
    expect(section).toContain('  - a Button with disabled bound to { "path": "/locked" }');
    expect(section.endsWith('\n  - a Separator')).toBe(true);
  });

  it('leaves out what the catalog can never meet, and a surface left with nothing', () => {
    expect(section).not.toContain('CheckBox');
    expect(section).not.toContain('checked');
    expect(section).not.toContain('"agreed"');
    expect(section).not.toContain('"unmeetable"');
  });

  it('names the error the model gets back for an omission', () => {
    expect(section).toContain(A2UI_ISSUE_CODES.MISSING_REQUIRED_COMPONENT);
  });

  it('skips a surface with no requirements, and is empty without any', () => {
    expect(section).not.toContain('"chat"');
    expect(a2uiSurfaceRequirementsSection({}, urbiconA2uiCatalogSpec)).toBe('');
    expect(a2uiSurfaceRequirementsSection({ chat: [] }, urbiconA2uiCatalogSpec)).toBe('');
  });

  it('is not part of the catalog prompt, which cannot see consumer requirements', () => {
    expect(prompt).not.toContain('## Required components');
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
