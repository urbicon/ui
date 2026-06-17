import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeSlotClasses, type PresetMap, resolvePresetSlotClasses } from './blocks-context';

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
