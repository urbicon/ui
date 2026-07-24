import { describe, expect, it } from 'vitest';
import type { A2uiPropKind } from '../a2ui-registry';
import {
  SHARED_AXES,
  UNSUPPORTED_URBICON_A2UI_COMPONENTS,
  URBICON_A2UI_CATALOG_ID,
  URBICON_A2UI_ICON_NAMES,
  URBICON_A2UI_REGISTRY,
  URBICON_AXES,
  urbiconA2uiCatalogSpec
} from './a2ui-urbicon-registry';

const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const VALID_KINDS: ReadonlySet<A2uiPropKind> = new Set<A2uiPropKind>([
  'string',
  'number',
  'boolean',
  'stringList',
  'enum',
  'childId',
  'childList',
  'labeledChildren',
  'action',
  'options',
  'icon',
  'accessibility'
]);

const entries = Object.entries(URBICON_A2UI_REGISTRY);

describe('URBICON_A2UI_REGISTRY invariants', () => {
  it('has the expected v1 scope (27 components)', () => {
    expect(entries.length).toBe(27);
  });

  for (const [name, spec] of entries) {
    describe(name, () => {
      it('has a non-empty description and a category', () => {
        expect(spec.description.length).toBeGreaterThan(0);
        expect(spec.category.length).toBeGreaterThan(0);
      });

      it('has no prototype-pollution prop keys', () => {
        for (const key of Object.keys(spec.props)) expect(PROTO_KEYS.has(key)).toBe(false);
      });

      for (const [propKey, propSpec] of Object.entries(spec.props)) {
        it(`prop "${propKey}" has a valid kind and description`, () => {
          expect(VALID_KINDS.has(propSpec.kind)).toBe(true);
          expect(propSpec.description.length).toBeGreaterThan(0);
        });

        if (propSpec.kind === 'enum' || propSpec.kind === 'icon') {
          it(`prop "${propKey}" (${propSpec.kind}) declares non-empty values`, () => {
            expect(propSpec.values && propSpec.values.length > 0).toBe(true);
          });
        }

        if (propSpec.default !== undefined && propSpec.values) {
          it(`prop "${propKey}" default is within its values`, () => {
            expect(propSpec.values).toContain(propSpec.default);
          });
        }
      }
    });
  }
});

describe('icon names', () => {
  it('are unique and non-empty', () => {
    expect(URBICON_A2UI_ICON_NAMES.length).toBeGreaterThan(0);
    expect(new Set(URBICON_A2UI_ICON_NAMES).size).toBe(URBICON_A2UI_ICON_NAMES.length);
  });
});

// The heart of the hybrid design: the hand-curated registry must never advertise
// a variant value the real Urbicon component does not support, and its documented
// defaults must match. Coupled to the generated axis truth.
describe('axis drift coupling (registry ⊆ URBICON_AXES)', () => {
  for (const [name, spec] of entries) {
    for (const [propKey, propSpec] of Object.entries(spec.props)) {
      const axis = (propSpec as { axis?: string }).axis;
      if (!axis) continue;
      describe(`${name}.${propKey} → axis "${axis}"`, () => {
        it('the component declares an `urbicon` source', () => {
          expect(typeof spec.urbicon).toBe('string');
        });
        it('the axis exists in URBICON_AXES', () => {
          expect(URBICON_AXES[spec.urbicon as string]?.[axis]).toBeDefined();
        });
        it('curated values are a subset of the axis', () => {
          const axisValues = URBICON_AXES[spec.urbicon as string]?.[axis]?.values ?? [];
          for (const value of propSpec.values ?? []) expect(axisValues).toContain(value);
        });
        it('curated default equals the axis default', () => {
          if (propSpec.default === undefined) return;
          expect(propSpec.default).toBe(URBICON_AXES[spec.urbicon as string]?.[axis]?.default);
        });
      });
    }
  }
});

describe('SHARED_AXES', () => {
  it('intent is the six semantic intents', () => {
    expect([...SHARED_AXES.intent].sort()).toEqual(
      ['danger', 'neutral', 'primary', 'secondary', 'success', 'warning'].sort()
    );
  });
  it('size is the curated sm/md/lg subset', () => {
    expect([...SHARED_AXES.size]).toEqual(['sm', 'md', 'lg']);
  });
});

describe('urbiconA2uiCatalogSpec', () => {
  it('advertises the Urbicon catalog id', () => {
    expect(urbiconA2uiCatalogSpec.catalogId).toBe(URBICON_A2UI_CATALOG_ID);
    expect(URBICON_A2UI_CATALOG_ID).toBe('urbicon-ui/urbicon-catalog/v1');
  });
  it('wires the registry, icons, unsupported and ignored sets', () => {
    expect(urbiconA2uiCatalogSpec.registry).toBe(URBICON_A2UI_REGISTRY);
    expect(urbiconA2uiCatalogSpec.iconNames).toBe(URBICON_A2UI_ICON_NAMES);
    expect(urbiconA2uiCatalogSpec.unsupportedComponents).toBe(UNSUPPORTED_URBICON_A2UI_COMPONENTS);
    expect(urbiconA2uiCatalogSpec.flexContainers.has('Row')).toBe(true);
    expect(urbiconA2uiCatalogSpec.flexContainers.has('Column')).toBe(true);
  });
  it('flags Markdown-in-Text via componentChecks', () => {
    const check = urbiconA2uiCatalogSpec.componentChecks?.Text;
    expect(check).toBeDefined();
    const withMarkdown = check?.({
      id: 't1',
      props: new Map([['text', 'Hello **bold**']]),
      surfaceId: 's',
      base: '/messages/0/updateComponents/components/0'
    });
    expect(withMarkdown?.[0]?.code).toBe('MARKDOWN_IN_TEXT');
    expect(withMarkdown?.[0]?.severity).toBe('warning');
    const plain = check?.({
      id: 't2',
      props: new Map([['text', 'Just plain text']]),
      surfaceId: 's',
      base: '/messages/0/updateComponents/components/0'
    });
    expect(plain).toEqual([]);
  });
});
