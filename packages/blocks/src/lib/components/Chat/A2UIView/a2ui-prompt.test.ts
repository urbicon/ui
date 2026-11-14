import { describe, expect, it } from 'vitest';
import { A2UI_ISSUE_CODES } from './a2ui.types';
import { a2uiSystemPrompt } from './a2ui-prompt';
import {
  A2UI_ACCESSIBILITY_SPEC,
  A2UI_CATALOG_ID,
  A2UI_ICON_NAMES,
  A2UI_PROTOCOL_VERSION,
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
    expect(prompt).toContain(`Protocol version: ${A2UI_PROTOCOL_VERSION}.`);
    expect(prompt).toContain(`a "version" of "${A2UI_PROTOCOL_VERSION}"`);
    expect(prompt).toContain('root');
    expect(prompt).toContain('EXACTLY ONE of');
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

  it('forbids function calls but @index, and function-call actions', () => {
    expect(prompt).toContain('Other function calls');
    expect(prompt).toContain('NOT supported');
    expect(prompt).toContain('Do NOT use function calls other than @index');
    expect(prompt.toLowerCase()).toContain('do not use local function-call actions');
  });

  // No Basic prop declares a failsafe, so nothing would accept the form.
  it('does not offer the logic functions where no prop accepts them', () => {
    expect(prompt).not.toContain('"@call": "not"');
    expect(prompt).not.toContain('not/and/or');
  });

  // The 1.0 forms a model trained on earlier payloads gets wrong.
  it('writes bindings, calls and deletion the way A2UI 1.0 does, in both catalogs', () => {
    for (const text of [prompt, a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec })]) {
      expect(text).toContain('{ "@path": "/json/pointer" }');
      expect(text).toContain('{ "@call": "@index" }');
      expect(text).toContain('"value" of null DELETES the key at "path"');
      expect(text).toContain('no hyphen, no leading digit');
      expect(text).toContain('an agent event');
      expect(text).toContain('"userMessage"?: string');
      // …and nowhere the pre-1.0 ones.
      expect(text).not.toMatch(/\{ "?path"?[ :]/);
      expect(text).not.toContain('"call"');
      expect(text).not.toContain('v0.9');
      expect(text).not.toContain('server event');
    }
  });

  // `@accessibility` is the protocol's, so no registry lists it; the prompt
  // still has to state every key the validator takes.
  it('documents every @accessibility key and live value', () => {
    expect(prompt).toContain('- @accessibility (optional; object, each key optional)');
    for (const [key, spec] of Object.entries(A2UI_ACCESSIBILITY_SPEC)) {
      expect(prompt).toContain(`${key}`);
      expect(prompt).toContain(spec.description);
      for (const value of spec.values ?? []) expect(prompt).toContain(value);
    }
    expect(prompt).toContain('live (off | polite | assertive)');
  });

  it('omits any transport section (app-specific)', () => {
    expect(prompt).not.toContain('```a2ui');
    expect(prompt).not.toContain('SSE');
    expect(prompt).not.toContain('Server-Sent');
  });

  // What becomes of a surface after its turn depends on a router delivering a
  // later turn into it; the prompt cannot promise that, so the transport
  // section carries these rules.
  it('says nothing about patching a surface after its turn, nor about lines', () => {
    for (const text of [prompt, a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec })]) {
      expect(text).not.toMatch(/\bpatch/i);
      expect(text).not.toContain('createSurface twice');
      expect(text).not.toContain('updates in place');
      expect(text).not.toContain('deleteSurface when');
      expect(text).not.toContain('JSONL');
    }
  });

  // The prompt asks for several updateComponents envelopes, and a container
  // re-sent among them drops the children it no longer names.
  it('says a re-sent component id replaces it', () => {
    for (const catalog of [undefined, urbiconA2uiCatalogSpec]) {
      const text = a2uiSystemPrompt({ catalog });
      expect(text).toContain('Re-sending a component id REPLACES it');
      expect(text).toContain('re-send its\n  container with the full children list');
    }
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
    expect(section).toContain('the surfaceId and the catalogId listed');
    expect(section).toContain(
      `- Surface "booking", created with catalogId "${urbiconA2uiCatalogSpec.catalogId}", must contain:`
    );
    expect(section).toContain(
      '  - a Checkbox with value bound to { "@path": "/agreed" } (consent to the cancellation policy)'
    );
    expect(section).toContain('  - a Button with disabled bound to { "@path": "/locked" }');
    expect(section.endsWith('\n  - a Separator')).toBe(true);
  });

  it('leaves out what the catalog can never meet, and a surface left with nothing', () => {
    expect(section).not.toContain('CheckBox');
    expect(section).not.toContain('checked');
    expect(section).not.toContain('"agreed"');
    expect(section).not.toContain('"unmeetable"');
  });

  // No catalog is a fallback, so the model is never left to pick one — also
  // where every configured catalog could hold the entries.
  it('pins the catalogId of every listed surface', () => {
    const both = a2uiSurfaceRequirementsSection(
      { notes: [{ component: 'Text' }] },
      urbiconA2uiCatalogSpec
    );
    expect(both).toContain(
      `- Surface "notes", created with catalogId "${urbiconA2uiCatalogSpec.catalogId}", must contain:`
    );
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
