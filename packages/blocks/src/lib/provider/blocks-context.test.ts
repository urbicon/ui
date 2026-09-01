import { afterEach, describe, expect, it, vi } from 'vitest';
import { badgeVariants } from '../primitives/Badge/badge.variants';
import {
  type BlocksConfig,
  type ConditionalOverride,
  mergeSlotClasses,
  type PresetMap,
  resolveOverrideSlotClasses,
  resolvePresetSlotClasses,
  resolveSlotClasses
} from './blocks-context';

describe('mergeSlotClasses', () => {
  it('returns empty object when all sources are undefined', () => {
    expect(mergeSlotClasses(undefined, undefined)).toEqual({});
  });

  it('concatenates classes per slot from multiple sources in order', () => {
    const a = { base: 'bg-primary', content: 'gap-2' };
    const b = { base: 'rounded-full', content: 'text-sm' };

    expect(mergeSlotClasses(a, b)).toEqual({
      base: 'bg-primary rounded-full',
      content: 'gap-2 text-sm'
    });
  });

  it('skips empty-string values so they do not pollute the output', () => {
    const a = { base: 'bg-primary' };
    const b = { base: '' };
    expect(mergeSlotClasses(a, b)).toEqual({ base: 'bg-primary' });
  });

  it('preserves later-source ordering (used for CSS cascade precedence)', () => {
    const providerDefaults = { base: 'rounded-md' };
    const preset = { base: 'bg-black/20 hover:bg-black/30' };
    const instance = { base: 'shadow-lg' };

    const merged = mergeSlotClasses(providerDefaults, preset, instance);

    expect(merged.base).toBe('rounded-md bg-black/20 hover:bg-black/30 shadow-lg');
  });
});

describe('resolvePresetSlotClasses', () => {
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  afterEach(() => {
    consoleWarnSpy.mockClear();
  });

  const presets: PresetMap = {
    Button: {
      overlay: {
        slotClasses: {
          base: 'bg-black/20 hover:bg-black/30 active:bg-black/40 text-white'
        }
      },
      glass: {
        slotClasses: { base: 'bg-white/10 backdrop-blur-md' }
      }
    }
  };

  it('returns undefined when no preset name is provided', () => {
    expect(resolvePresetSlotClasses(presets, 'Button', undefined)).toBeUndefined();
  });

  it('returns undefined (without warning) when presets map is empty and name is missing', () => {
    expect(resolvePresetSlotClasses(undefined, 'Button', undefined)).toBeUndefined();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('returns the preset slotClasses when registered', () => {
    expect(resolvePresetSlotClasses(presets, 'Button', 'overlay')).toEqual({
      base: 'bg-black/20 hover:bg-black/30 active:bg-black/40 text-white'
    });
  });

  it('returns undefined for an unknown preset name on a known component', () => {
    expect(resolvePresetSlotClasses(presets, 'Button', 'nonexistent')).toBeUndefined();
  });

  it('returns undefined for an unknown component entirely', () => {
    expect(resolvePresetSlotClasses(presets, 'Widget', 'overlay')).toBeUndefined();
  });
});

describe('resolveOverrideSlotClasses', () => {
  const overrides: ConditionalOverride[] = [
    { variant: 'outlined', class: { base: 'border' } },
    { variant: 'outlined', intent: 'danger', class: { base: 'ring-2', content: 'font-bold' } }
  ];

  it('returns undefined with no overrides', () => {
    expect(resolveOverrideSlotClasses(undefined, { variant: 'outlined' })).toBeUndefined();
    expect(resolveOverrideSlotClasses([], { variant: 'outlined' })).toBeUndefined();
  });

  it('returns undefined when nothing matches', () => {
    expect(resolveOverrideSlotClasses(overrides, { variant: 'filled' })).toBeUndefined();
  });

  it('returns the class record of the matching entry', () => {
    expect(
      resolveOverrideSlotClasses(overrides, { variant: 'outlined', intent: 'primary' })
    ).toEqual({ base: 'border' });
  });

  it('merges multiple matching entries additively per slot', () => {
    expect(
      resolveOverrideSlotClasses(overrides, { variant: 'outlined', intent: 'danger' })
    ).toEqual({
      base: 'border ring-2',
      content: 'font-bold'
    });
  });
});

describe('resolveSlotClasses', () => {
  const config: BlocksConfig = {
    unstyled: false,
    defaults: {
      Badge: {
        slotClasses: { base: 'shadow-sm' },
        overrides: [{ variant: 'outlined', class: { base: 'border' } }]
      }
    },
    presets: {
      Badge: {
        thin: {
          slotClasses: { base: 'tracking-wide' },
          overrides: [{ variant: 'outlined', class: { base: 'border-[0.5px]' } }]
        }
      }
    }
  };

  it('returns instance slotClasses only when no provider config applies', () => {
    expect(
      resolveSlotClasses(
        undefined,
        'Badge',
        undefined,
        { variant: 'filled' },
        { base: 'mt-1' },
        badgeVariants.config
      )
    ).toEqual({ base: 'mt-1' });
  });

  it('applies a default override only for the matching variant', () => {
    expect(
      resolveSlotClasses(
        config,
        'Badge',
        undefined,
        { variant: 'outlined' },
        undefined,
        badgeVariants.config
      )
    ).toEqual({ base: 'shadow-sm border' });
    expect(
      resolveSlotClasses(
        config,
        'Badge',
        undefined,
        { variant: 'filled' },
        undefined,
        badgeVariants.config
      )
    ).toEqual({
      base: 'shadow-sm'
    });
  });

  it('layers preset slotClasses + preset overrides on top of defaults (later width wins)', () => {
    const tokens = resolveSlotClasses(
      config,
      'Badge',
      'thin',
      { variant: 'outlined' },
      undefined,
      badgeVariants.config
    ).base.split(/\s+/);
    expect(tokens).toContain('shadow-sm');
    expect(tokens).toContain('tracking-wide');
    expect(tokens).toContain('border-[0.5px]');
    expect(tokens).not.toContain('border'); // default's unqualified 1px border stripped by preset
  });

  it('resolves unconditional-vs-conditional conflicts deterministically (later wins)', () => {
    const conflicting: BlocksConfig = {
      unstyled: false,
      defaults: {
        Badge: {
          slotClasses: { base: 'border-4' },
          overrides: [{ variant: 'outlined', class: { base: 'border' } }]
        }
      },
      presets: {}
    };
    expect(
      resolveSlotClasses(
        conflicting,
        'Badge',
        undefined,
        { variant: 'outlined' },
        undefined,
        badgeVariants.config
      )
    ).toEqual({ base: 'border' });
    expect(
      resolveSlotClasses(
        conflicting,
        'Badge',
        undefined,
        { variant: 'filled' },
        undefined,
        badgeVariants.config
      )
    ).toEqual({ base: 'border-4' });
  });

  it('lets instance slotClasses win over the whole provider cascade', () => {
    const tokens = resolveSlotClasses(
      config,
      'Badge',
      undefined,
      { variant: 'outlined' },
      { base: 'border-8' },
      badgeVariants.config
    ).base.split(/\s+/);
    expect(tokens).toContain('border-8');
    expect(tokens).not.toContain('border');
  });
});

describe('resolveSlotClasses – integration with badgeVariants (origin-blind)', () => {
  const config: BlocksConfig = {
    unstyled: false,
    defaults: { Badge: { overrides: [{ variant: 'outlined', class: { base: 'border' } }] } },
    presets: {}
  };

  it('strips the outlined variant border-2 end-to-end', () => {
    const resolved = resolveSlotClasses(
      config,
      'Badge',
      undefined,
      { variant: 'outlined', intent: 'primary' },
      undefined,
      badgeVariants.config
    );
    // Mirror Badge.svelte: styles.base({ class: [slotClasses.base, className] }).
    const tokens = badgeVariants({ variant: 'outlined', intent: 'primary' })
      .base({ class: [resolved.base] })
      .split(/\s+/);
    expect(tokens).not.toContain('border-2'); // variant-origin border-2 stripped
    expect(tokens).toContain('border'); // 1px applied
    expect(tokens).toContain('border-primary'); // orthogonal color bucket survives
  });

  it('does not touch filled badges (override does not match)', () => {
    const resolved = resolveSlotClasses(
      config,
      'Badge',
      undefined,
      { variant: 'filled', intent: 'primary' },
      undefined,
      badgeVariants.config
    );
    expect(resolved.base).toBeUndefined();
  });
});
