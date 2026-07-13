import type { ComponentInfo, PropInfo } from '@urbicon-ui/shared-types';
import { describe, expect, it } from 'vitest';
import { APIDataGenerator } from '../src/core/enrichment/APIDataGenerator';
import { PipelineOrchestrator } from '../src/core/pipeline/PipelineOrchestrator';
import { ConfigurationFactory } from '../src/schema/ConfigurationBuilder';
import type { GeneratorConfig } from '../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function prop(partial: Partial<PropInfo> & { name: string; type: string }): PropInfo {
  return {
    required: false,
    description: `${partial.name} property for exercising cross-links`,
    source: { type: 'direct', name: 'TestProps' },
    ...partial
  };
}

function component(name: string, filePath: string, props: PropInfo[] = []): ComponentInfo {
  return {
    name,
    packageName: '@urbicon-ui/blocks',
    filePath,
    description: `${name} component`,
    props,
    variants: [],
    inheritance: [],
    stats: {
      totalProps: props.length,
      directProps: props.length,
      variantProps: 0,
      inheritedProps: 0
    }
  };
}

const gen = new APIDataGenerator();

async function linksFor(components: ComponentInfo[], routeBasePath = '/blocks') {
  const api = await gen.generate(components, { routeBasePath });
  return api.components;
}

// ---------------------------------------------------------------------------
// Sub-Task 1 — group-aware component route links
// ---------------------------------------------------------------------------

describe('APIDataGenerator — group-aware doc-route links (Sub-Task 1)', () => {
  it('routes a primitive self-link under /blocks/primitives/<slug>', async () => {
    const comps = await linksFor([
      component('Sidebar', '/repo/packages/blocks/src/lib/primitives/Sidebar/index.ts', [
        prop({ name: 'variantBag', type: 'VariantProps' })
      ])
    ]);
    const p = comps.Sidebar?.props.find((x) => x.name === 'variantBag');
    expect(p?.seeAlso).toBe('/blocks/primitives/sidebar#variants');
  });

  it('routes a component self-link under /blocks/components/<slug>', async () => {
    const comps = await linksFor([
      component('Planner', '/repo/packages/blocks/src/lib/components/Planner/index.ts', [
        prop({ name: 'variantBag', type: 'VariantProps' })
      ])
    ]);
    const p = comps.Planner?.props.find((x) => x.name === 'variantBag');
    expect(p?.seeAlso).toBe('/blocks/components/planner#variants');
  });

  it('resolves a cross-group #api link using the TARGET component group, not the source', async () => {
    // Sidebar (primitives) references PlannerProps; Planner lives in components.
    // The emitted link must carry Planner's group segment, proving the base is
    // resolved per *target* component rather than per run.
    const comps = await linksFor([
      component('Sidebar', '/repo/primitives/Sidebar/index.ts', [
        prop({ name: 'planner', type: 'PlannerProps' })
      ]),
      component('Planner', '/repo/components/Planner/index.ts', [])
    ]);
    const p = comps.Sidebar?.props.find((x) => x.name === 'planner');
    expect(p?.seeAlso).toBe('/blocks/components/planner#api');
  });

  it('never emits the old flat /components/<slug> link', async () => {
    const comps = await linksFor([
      component('Planner', '/repo/components/Planner/index.ts', [
        prop({ name: 'variantBag', type: 'VariantProps' })
      ])
    ]);
    const p = comps.Planner?.props.find((x) => x.name === 'variantBag');
    expect(p?.seeAlso?.startsWith('/blocks/')).toBe(true);
    expect(p?.seeAlso).not.toMatch(/^\/components\//);
  });

  it('falls back to <base>/<slug> when a component has no group segment', async () => {
    // The table target has no primitives/components split (group === undefined).
    const comps = await linksFor(
      [
        component('Table', '/repo/packages/table/src/lib/core/table/index.ts', [
          prop({ name: 'variantBag', type: 'VariantProps' })
        ])
      ],
      '/table'
    );
    const p = comps.Table?.props.find((x) => x.name === 'variantBag');
    expect(p?.seeAlso).toBe('/table/table#variants');
  });
});

// ---------------------------------------------------------------------------
// Sub-Task 1 — route base derivation from the API output directory
// ---------------------------------------------------------------------------

describe('PipelineOrchestrator — route base derived from API output path (Sub-Task 1)', () => {
  const derive = (config: GeneratorConfig) =>
    (
      new PipelineOrchestrator(config) as unknown as { deriveRouteBasePath(): string }
    ).deriveRouteBasePath();

  it('derives /blocks, /docs, /table, /auth from each preset config', () => {
    expect(derive(ConfigurationFactory.blocks())).toBe('/blocks');
    expect(derive(ConfigurationFactory.docs())).toBe('/docs');
    expect(derive(ConfigurationFactory.table())).toBe('/table');
    expect(derive(ConfigurationFactory.auth())).toBe('/auth');
  });
});

// ---------------------------------------------------------------------------
// Sub-Task 2 — urbicon token type links
// ---------------------------------------------------------------------------

describe('APIDataGenerator — urbicon token type links (Sub-Task 2)', () => {
  it('maps MintProp / ComponentIntent / ComponentSize to real /customization/tokens routes', async () => {
    const comps = await linksFor([
      component('Card', '/repo/primitives/Card/index.ts', [
        prop({ name: 'mint', type: 'MintProp' }),
        prop({ name: 'intent', type: 'ComponentIntent' }),
        prop({ name: 'size', type: 'ComponentSize' })
      ])
    ]);
    const byName = Object.fromEntries((comps.Card?.props ?? []).map((p) => [p.name, p]));
    expect(byName.mint?.seeAlso).toBe('/customization/tokens#interaction');
    expect(byName.intent?.seeAlso).toBe('/customization/tokens#colors');
    expect(byName.size?.seeAlso).toBe('/customization/tokens');
  });

  it('no longer emits the dead /docs/mint-system or /docs/design-tokens links', async () => {
    const comps = await linksFor([
      component('Card', '/repo/primitives/Card/index.ts', [
        prop({ name: 'mint', type: 'MintProp' }),
        prop({ name: 'intent', type: 'ComponentIntent' })
      ])
    ]);
    for (const name of ['mint', 'intent']) {
      const p = comps.Card?.props.find((x) => x.name === name);
      expect(p?.seeAlso).not.toMatch(/\/docs\/(mint-system|design-tokens)/);
    }
  });
});
