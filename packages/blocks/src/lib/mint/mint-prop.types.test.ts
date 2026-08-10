import { describe, expect, it } from 'vitest';
import type { BuiltinMintName, MintProp } from './types';

// Compile-time contract of the mint prop typing. The assertions live in the
// type positions; the single runtime expect only keeps vitest satisfied.
describe('MintProp typing', () => {
  it('accepts built-ins, none, custom names, configs and arrays', () => {
    const builtin: MintProp = 'scale';
    const none: MintProp = 'none';
    // The registry stays open: consumer-registered names must keep compiling.
    const custom: MintProp = 'my-app-shimmer';
    const withConfig: MintProp = { name: 'glow', config: { duration: 500 } };
    const mixed: MintProp = ['scale', { name: 'ripple', config: { opacity: 0.3 } }];

    // The union derives from the runtime constant; registry.test.ts asserts
    // that constant against what registerDefaultMints() actually registers.
    const derived: BuiltinMintName = 'wiggle';

    // @ts-expect-error a config object needs a name
    const invalid: MintProp = { config: { duration: 500 } };

    expect([builtin, none, custom, withConfig, mixed, derived, invalid]).toBeDefined();
  });
});
