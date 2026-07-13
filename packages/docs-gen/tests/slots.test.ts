import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PropInfo } from '@urbicon-ui/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMDocumentationGenerator } from '../src/generators/llm/LLMDocumentationGenerator';
import { MCPCatalogGenerator } from '../src/generators/mcp/MCPCatalogGenerator';
import { resolveSlotNames } from '../src/generators/shared/slots';
import type { APIData, ComponentAPIData, EnrichedComponentInfo } from '../src/types';

const NO_STATS = { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 };

function compApi(partial: Partial<ComponentAPIData> & { name: string }): ComponentAPIData {
  return {
    props: [],
    variants: [],
    inheritance: [],
    examples: [],
    stats: { ...NO_STATS },
    ...partial
  };
}

function slotClassesProp(type: string): PropInfo {
  return {
    name: 'slotClasses',
    type,
    required: false,
    description: 'Per-slot class overrides',
    source: { type: 'direct', name: 'TestProps' }
  };
}

// ---------------------------------------------------------------------------
// resolveSlotNames — the single unified slot source shared by both generators
// ---------------------------------------------------------------------------

describe('resolveSlotNames', () => {
  it('prefers ComponentAPIData.slots (the tv() slots: keys), in order', () => {
    const slots = resolveSlotNames(
      compApi({ name: 'Card', slots: ['base', 'header', 'content', 'footer'] })
    );
    expect(slots).toEqual(['base', 'header', 'content', 'footer']);
  });

  it('ignores the legacy slotClasses regex when tv() slots are present', () => {
    const slots = resolveSlotNames(
      compApi({
        name: 'Card',
        slots: ['base', 'header'],
        props: [slotClassesProp("Partial<Record<'ignored', string>>")]
      })
    );
    expect(slots).toEqual(['base', 'header']);
  });

  it('falls back to an inline Record<..> slotClasses type when no tv() slots parsed', () => {
    const slots = resolveSlotNames(
      compApi({
        name: 'Legacy',
        props: [slotClassesProp("Partial<Record<'trigger' | 'panel', string>>")]
      })
    );
    expect(slots).toEqual(['trigger', 'panel']);
  });

  it('falls back to a variant literally named "slots"', () => {
    const slots = resolveSlotNames(
      compApi({ name: 'Legacy2', variants: [{ name: 'slots', values: ['a', 'b'] }] })
    );
    expect(slots).toEqual(['a', 'b']);
  });

  it('does NOT treat the derived-alias slotClasses type as a slot (the original bug)', () => {
    // `Partial<Record<CardSlots, string>>` — no inline quoted union, so the
    // regex must not match. Without ComponentAPIData.slots this is empty; that
    // emptiness is exactly why the alias needed AST extraction.
    const slots = resolveSlotNames(
      compApi({ name: 'Card', props: [slotClassesProp('Partial<Record<CardSlots, string>>')] })
    );
    expect(slots).toEqual([]);
  });

  it('returns [] when there is no slot source at all', () => {
    expect(resolveSlotNames(compApi({ name: 'Plain' }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: slot names reach BOTH catalog surfaces from ComponentAPIData.slots
// ---------------------------------------------------------------------------

const CARD_SLOTS = ['base', 'header', 'content', 'footer'];

function enriched(name: string): EnrichedComponentInfo {
  return {
    name,
    packageName: '@urbicon-ui/blocks',
    filePath: `/nonexistent/${name}/index.ts`,
    description: `${name} component`,
    props: [],
    variants: [],
    inheritance: [],
    stats: { ...NO_STATS },
    crossReferences: [],
    examples: []
  };
}

function apiWithCardSlots(): APIData {
  return {
    components: {
      Card: compApi({ name: 'Card', group: 'primitives', slots: CARD_SLOTS })
    },
    types: [],
    metadata: {
      generated: new Date().toISOString(),
      version: '0.0.0-test',
      totalComponents: 1,
      totalProps: 0,
      generator: 'test'
    }
  };
}

describe('slot names reach both catalog surfaces', () => {
  let root: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'slots-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('renders the real slot names into the per-component llm.txt', async () => {
    const scopeDir = path.join(root, 'blocks');
    const gen = new LLMDocumentationGenerator({
      enabled: true,
      outputPath: scopeDir,
      format: 'markdown'
    });
    await gen.generate([enriched('Card')], apiWithCardSlots());

    const cardLlm = await fs.readFile(
      path.join(scopeDir, 'primitives', 'card', 'llm.txt'),
      'utf-8'
    );
    expect(cardLlm).toContain('### Slots (slotClasses keys)');
    for (const slot of CARD_SLOTS) {
      expect(cardLlm).toContain(`\`${slot}\``);
    }
  });

  it('writes the real slot names into the MCP _catalog.json entry', async () => {
    const gen = new MCPCatalogGenerator('@urbicon-ui/blocks', root);
    await gen.generate([enriched('Card')], apiWithCardSlots());

    const catalog = JSON.parse(await fs.readFile(path.join(root, '_catalog.json'), 'utf-8'));
    const card = catalog.find((c: { name: string }) => c.name === 'Card');
    expect(card).toBeDefined();
    expect(card.slots).toEqual(CARD_SLOTS);
  });
});
