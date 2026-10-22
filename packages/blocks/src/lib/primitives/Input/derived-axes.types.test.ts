import { describe, expect, it } from 'vitest';
import type { CopyButtonProps } from '#lib/components/CopyButton/index.js';
import type { CurrencyInputProps } from '#lib/components/CurrencyInput/index.js';
import type { LocaleSwitcherProps } from '#lib/components/LocaleSwitcher/index.js';
import type { NumberInputProps } from '#lib/components/NumberInput/index.js';
import type { PinInputProps } from '#lib/components/PinInput/index.js';
import type { TimeInputProps } from '#lib/components/TimeInput/index.js';
import type { SelectProps } from '#lib/primitives/Select/index.js';
import type { SliderProps } from '#lib/primitives/Slider/index.js';
import type { TextareaProps } from '#lib/primitives/Textarea/index.js';
import type { InputProps } from './index';

// Compile-time contract: an axis a field computes for itself is not a prop of
// any props type built on it. The assertions live in the type positions; the
// single runtime expect only keeps vitest satisfied.
describe('derived tv() axes stay out of the props types', () => {
  it('rejects them where a caller would pass them', () => {
    const rejected = [
      // @ts-expect-error computed from the icon snippets and the clear button
      { hasLeftIcon: true } satisfies InputProps,
      // @ts-expect-error computed from the icon snippets and the clear button
      { hasRightIcon: true } satisfies InputProps,
      // @ts-expect-error set per icon container
      { iconPosition: 'right' } satisfies InputProps,
      // @ts-expect-error follows from `error`
      { messageType: 'error' } satisfies InputProps,
      // @ts-expect-error the wrapper inherits Input's type
      { hasRightIcon: true } satisfies NumberInputProps,
      // @ts-expect-error the wrapper inherits Input's type
      { iconPosition: 'left' } satisfies CurrencyInputProps,
      // @ts-expect-error follows from `error`
      { messageType: 'error' } satisfies SelectProps,
      // @ts-expect-error the wrapper inherits Select's type
      { messageType: 'error' } satisfies LocaleSwitcherProps,
      // @ts-expect-error follows from `error`
      { messageType: 'error' } satisfies TextareaProps,
      // @ts-expect-error follows from `error`
      { messageType: 'error' } satisfies PinInputProps,
      // @ts-expect-error follows from `error`
      { messageType: 'error' } satisfies TimeInputProps,
      // @ts-expect-error follows from `error`
      { messageType: 'error' } satisfies SliderProps
    ];

    // The axes a wrapper forwards stay props, redeclared with their own default.
    const forwarded = [
      {
        size: 'sm',
        tier: 'commit',
        variant: 'filled',
        intent: 'danger'
      } satisfies NumberInputProps,
      {
        size: 'sm',
        tier: 'commit',
        variant: 'filled',
        intent: 'danger'
      } satisfies CurrencyInputProps,
      { tier: 'commit' } satisfies LocaleSwitcherProps,
      { value: 'x', variant: 'filled', intent: 'danger', tier: 'modify' } satisfies CopyButtonProps
    ];

    expect([rejected, forwarded]).toBeDefined();
  });
});
