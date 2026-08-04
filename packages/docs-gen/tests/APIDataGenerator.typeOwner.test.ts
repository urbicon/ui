import type { ComponentInfo } from '@urbicon-ui/shared-types';
import { describe, expect, it } from 'vitest';
import { APIDataGenerator } from '../src/core/enrichment/APIDataGenerator';
import type { TypeDefinition } from '../src/types';
import { repoRelativePackagePath } from '../src/utils/repo-path';

// `owner` is the canonical home of a type: the documented component whose
// source declares it. It is what lets a page render a reference instead of a
// second full copy of a definition that lives elsewhere — measured on the
// real tree, 201 of 967 entries are such copies, 168 of them from one
// compound directory (Guide), which is why the multi-component case below is
// not a corner case but the majority of the mechanism's work.

const BLOCKS = '/repo/packages/blocks/src/lib';

function typeDef(name: string, sourcePath: string): TypeDefinition {
  return {
    name,
    type: 'interface',
    definition: 'value: string;',
    package: '@urbicon-ui/blocks',
    sourcePath
  };
}

function component(
  name: string,
  filePath: string,
  localTypes: TypeDefinition[] = []
): ComponentInfo {
  return {
    name,
    packageName: '@urbicon-ui/blocks',
    filePath,
    description: `${name} component`,
    props: [],
    variants: [],
    inheritance: [],
    stats: { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 },
    ...{ localTypes }
  } as unknown as ComponentInfo;
}

async function ownersFor(components: ComponentInfo[]) {
  const api = await new APIDataGenerator().generate(components, { routeBasePath: '/blocks' });
  const out: Record<string, Record<string, string | undefined>> = {};
  for (const [name, data] of Object.entries(api.components)) {
    out[name] = Object.fromEntries((data.types ?? []).map((t) => [t.name, t.owner]));
  }
  return out;
}

describe('APIDataGenerator — canonical type owner', () => {
  it('names the declaring component for a copy pulled in from another page', async () => {
    // The Issue's own example: ConfirmDialog imports DialogIntent, so the
    // definition is duplicated onto its page. Dialog is where it belongs.
    const owners = await ownersFor([
      component('Dialog', `${BLOCKS}/primitives/Dialog/index.ts`, [
        typeDef('DialogIntent', 'packages/blocks/src/lib/primitives/Dialog/index.ts')
      ]),
      component('ConfirmDialog', `${BLOCKS}/primitives/ConfirmDialog/index.ts`, [
        typeDef('ConfirmDialogProps', 'packages/blocks/src/lib/primitives/ConfirmDialog/index.ts'),
        typeDef('DialogIntent', 'packages/blocks/src/lib/primitives/Dialog/index.ts')
      ])
    ]);

    expect(owners.ConfirmDialog?.ConfirmDialogProps).toBe('ConfirmDialog');
    expect(owners.ConfirmDialog?.DialogIntent).toBe('Dialog');
    expect(owners.Dialog?.DialogIntent).toBe('Dialog');
  });

  it('counts the variants file as the same component (directory, not file)', async () => {
    const owners = await ownersFor([
      component('Dialog', `${BLOCKS}/primitives/Dialog/index.ts`, [
        typeDef('DialogVariants', 'packages/blocks/src/lib/primitives/Dialog/dialog.variants.ts')
      ])
    ]);

    expect(owners.Dialog?.DialogVariants).toBe('Dialog');
  });

  it('picks the longest matching sibling in a compound directory', async () => {
    // components/Guide/index.ts declares the props of nine documented
    // components. `GuidePanelProps` prefixes both `Guide` and `GuidePanel`;
    // only the longer one is its home.
    const guideIndex = 'packages/blocks/src/lib/components/Guide/index.ts';
    const owners = await ownersFor([
      component('Guide', `${BLOCKS}/components/Guide/index.ts`, [
        typeDef('GuideProps', guideIndex),
        typeDef('GuidePanelProps', guideIndex),
        typeDef('GuideBeaconProps', guideIndex)
      ]),
      component('GuidePanel', `${BLOCKS}/components/Guide/index.ts`, [
        typeDef('GuidePanelProps', guideIndex)
      ]),
      component('GuideBeacon', `${BLOCKS}/components/Guide/index.ts`, [
        typeDef('GuideBeaconProps', guideIndex)
      ])
    ]);

    expect(owners.Guide?.GuideProps).toBe('Guide');
    expect(owners.Guide?.GuidePanelProps).toBe('GuidePanel');
    expect(owners.Guide?.GuideBeaconProps).toBe('GuideBeacon');
    expect(owners.GuidePanel?.GuidePanelProps).toBe('GuidePanel');
  });

  // Component paths arrive absolute, `sourcePath` arrives repo-relative, and
  // ownership only resolves when both reduce to the identical string. Both
  // failure modes below were silent — no error, no warning, just `owner`
  // absent on every entry in the run.
  //
  // The `sourcePath` here is not hand-written: it is derived from the same
  // absolute path through the same helper `LocalTypesExtractor` uses, which
  // is the whole point — a hand-written one would encode the assumption
  // under test instead of exercising it. Under `/home/me/packages/ui` the
  // extractor really does store `packages/ui/packages/blocks/…`.
  it.each([
    // Matching the bare substring `packages/` re-anchored the absolute side
    // one level too high.
    ['a checkout directory ending in "packages"', '/home/me/dev-packages/ui'],
    // Here the stored sourcePath still contains a later `/packages/`, so a
    // non-idempotent rule reduces it a second time and the two sides part.
    ['a checkout directory named "packages"', '/home/me/packages/ui'],
    ['a plain checkout', '/home/me/ui']
  ])('keys the directory index the same way sourcePath is spelled: %s', async (_label, root) => {
    const absolute = `${root}/packages/blocks/src/lib/primitives/Dialog/index.ts`;
    const storedSourcePath = repoRelativePackagePath(absolute) as string;

    const owners = await ownersFor([
      component('Dialog', absolute, [typeDef('DialogIntent', storedSourcePath)])
    ]);

    expect(owners.Dialog?.DialogIntent).toBe('Dialog');
  });

  it('leaves library plumbing unowned rather than inventing a home', async () => {
    // `$lib/utils` and `$lib/mint` back no doc page. 390 of 967 real entries
    // land here, 352 of them exported package API — an absent owner means
    // "no page to link to", never "safe to drop".
    const owners = await ownersFor([
      component('Button', `${BLOCKS}/primitives/Button/index.ts`, [
        typeDef('ButtonProps', 'packages/blocks/src/lib/primitives/Button/index.ts'),
        typeDef('MintProp', 'packages/blocks/src/lib/mint/types.ts'),
        typeDef('VariantProps', 'packages/blocks/src/lib/utils/variants.ts')
      ])
    ]);

    expect(owners.Button?.ButtonProps).toBe('Button');
    expect(owners.Button?.MintProp).toBeUndefined();
    expect(owners.Button?.VariantProps).toBeUndefined();
  });

  it('falls back to the family root, whatever the sibling count', async () => {
    // The first cut made this depend on arity: a lone sibling owned its
    // directory unconditionally, two siblings demanded a prefix match. Real
    // consequence — `DatePicker/index.ts` declares `DatePickerPreset` and,
    // five lines on, `DateRangePreset`; only the first got a home, though
    // both are exported and appear on both date pages.
    const dpIndex = 'packages/blocks/src/lib/primitives/DatePicker/index.ts';
    const owners = await ownersFor([
      component('DatePicker', `${BLOCKS}/primitives/DatePicker/index.ts`, [
        typeDef('DatePickerPreset', dpIndex),
        typeDef('DateRangePreset', dpIndex),
        typeDef('DateFormatOptions', 'packages/blocks/src/lib/primitives/DatePicker/engine.ts')
      ]),
      component('DateRangePicker', `${BLOCKS}/primitives/DatePicker/index.ts`, [
        typeDef('DateRangePreset', dpIndex)
      ])
    ]);

    expect(owners.DatePicker?.DatePickerPreset).toBe('DatePicker');
    // Prefixes neither sibling — the directory's own component owns it.
    expect(owners.DatePicker?.DateRangePreset).toBe('DatePicker');
    expect(owners.DatePicker?.DateFormatOptions).toBe('DatePicker');
    // …and from the sibling's page it is therefore a reference, not a copy.
    expect(owners.DateRangePicker?.DateRangePreset).toBe('DatePicker');
  });

  it('stays unowned when no sibling is named after the directory either', async () => {
    // A family whose root component is not documented has no page to point
    // at; handing the type to whichever sibling sorted first would link to a
    // page that never documents it.
    const owners = await ownersFor([
      component('GuidePanel', `${BLOCKS}/components/Guide/index.ts`, [
        typeDef('OverlayHandle', 'packages/blocks/src/lib/components/Guide/index.ts')
      ]),
      component('GuideBeacon', `${BLOCKS}/components/Guide/index.ts`, [])
    ]);

    expect(owners.GuidePanel?.OverlayHandle).toBeUndefined();
  });
});
