import type { Snippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { InputProps } from '../primitives/Input';
import BlocksProvider from './BlocksProvider.svelte';
import type { ThemePropsOf } from './component-slots';
import type { StylePropsOf } from './theme-props';

/** Both directions, so neither a widened nor a narrowed answer passes. */
type Eq<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;

const children = null as unknown as Snippet;
const internal = null as unknown as never;

/**
 * The compile-time half of theme props, asserted on `BlocksProvider` itself —
 * the mechanics and why are the head of `component-slots.types.test.ts`.
 *
 * What it pins is the #199 shape one level up: a `props` key the component
 * does not read, or a value its own prop type does not admit, must not
 * type-check. Both halves come from the component's props, so they are
 * asserted against those rather than against a list written here.
 */
describe('provider theme props', () => {
  it('admits exactly the style props a component declares, typed as it types them', () => {
    const input: Eq<
      ThemePropsOf<'Input'>,
      Pick<Partial<InputProps>, 'variant' | 'size' | 'intent' | 'tier'>
    > = true;
    // A behaviour prop with a vocabulary type is still not a style prop.
    const noDisabled: Eq<'disabled' extends keyof ThemePropsOf<'Input'> ? 1 : 0, 0> = true;
    // A free value is not a look the library names: QRCode's `size` is pixels.
    const noPixels: Eq<'size' extends keyof ThemePropsOf<'QRCode'> ? 1 : 0, 0> = true;
    const frame: Eq<'frame' extends keyof ThemePropsOf<'QRCode'> ? 1 : 0, 1> = true;
    expect([input, noDisabled, noPixels, frame]).toBeDefined();
  });

  it('rejects a prop the component does not have, a behaviour prop and a foreign value', () => {
    const typeCheckedOnly = () => {
      BlocksProvider(internal, {
        children,
        // @ts-expect-error Card has no size — the #199 shape: it would read nothing
        defaults: { Card: { props: { size: 'lg' } } }
      });
      BlocksProvider(internal, {
        children,
        // @ts-expect-error … and beside a key Card does read
        defaults: { Card: { props: { variant: 'outlined', size: 'lg' } } }
      });
      BlocksProvider(internal, {
        children,
        // @ts-expect-error behaviour stays at the call site
        defaults: { Input: { props: { disabled: true } } }
      });
      BlocksProvider(internal, {
        children,
        // @ts-expect-error a value Input's own `variant` does not admit
        defaults: { Input: { props: { variant: 'elevated' } } }
      });
      BlocksProvider(internal, {
        children,
        // @ts-expect-error the same check through a preset
        presets: { Input: { zeile: { props: { variant: 'elevated' } } } }
      });
      BlocksProvider(internal, {
        children,
        defaults: {
          Input: { props: { variant: 'underline', size: 'sm' } },
          Card: { props: { variant: 'outlined', tier: 'bridge', padding: 'lg' } }
        },
        presets: { Input: { zeile: { props: { variant: 'bare' }, slotClasses: { base: 'ok' } } } }
      });
    };
    expect(typeCheckedOnly).toBeTypeOf('function');
  });

  it('gives a component without style props no `props` keys at all', () => {
    const typeCheckedOnly = () => {
      BlocksProvider(internal, {
        children,
        // @ts-expect-error Chat declares no style prop
        defaults: { Chat: { props: { variant: 'plain' } } }
      });
    };
    expect(typeCheckedOnly).toBeTypeOf('function');
  });

  it('distributes over a union props type', () => {
    // Each Badge arm contributes the members it declares; a label badge's
    // variant still cannot be a value no arm admits.
    const typeCheckedOnly = () => {
      BlocksProvider(internal, {
        children,
        // @ts-expect-error no Badge arm admits this variant
        defaults: { Badge: { props: { variant: 'ghost' } } }
      });
      BlocksProvider(internal, {
        children,
        defaults: { Badge: { props: { variant: 'soft', intent: 'neutral', size: 'sm' } } }
      });
    };
    expect(typeCheckedOnly).toBeTypeOf('function');
  });

  it('leaves a name from outside this package open, like its slots', () => {
    const open: Eq<ThemePropsOf<'MoneyField'>, Record<string, unknown>> = true;
    const explicit: Eq<
      StylePropsOf<{ size?: 'sm' | 'lg'; height?: number; open?: boolean }>,
      { size?: 'sm' | 'lg' }
    > = true;
    expect([open, explicit]).toBeDefined();
  });
});
