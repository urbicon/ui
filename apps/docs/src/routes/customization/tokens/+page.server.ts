// Prerendered (global `prerender = true`): the counts are taken from the blocks
// source once at build and only the rows are serialized to the client.
import { withUses } from '#lib/server/blocks-utility-uses.js';

export function load() {
  return {
    typographyScale: withUses([
      { utility: 'text-3xs', variable: '--text-3xs', value: '0.625rem', pixels: '10px' },
      { utility: 'text-2xs', variable: '--text-2xs', value: '0.6875rem', pixels: '11px' },
      { utility: 'text-xs', variable: '--text-xs', value: '0.75rem', pixels: '12px' },
      { utility: 'text-sm', variable: '--text-sm', value: '0.875rem', pixels: '14px' },
      { utility: 'text-base', variable: '--text-base', value: '1rem', pixels: '16px' },
      { utility: 'text-lg', variable: '--text-lg', value: '1.125rem', pixels: '18px' },
      { utility: 'text-xl', variable: '--text-xl', value: '1.25rem', pixels: '20px' },
      { utility: 'text-2xl', variable: '--text-2xl', value: '1.5rem', pixels: '24px' }
    ]),
    weightScale: withUses([
      { utility: 'font-normal', variable: '--font-weight-normal', value: '400' },
      { utility: 'font-medium', variable: '--font-weight-medium', value: '500' },
      { utility: 'font-semibold', variable: '--font-weight-semibold', value: '600' },
      { utility: 'font-bold', variable: '--font-weight-bold', value: '700' }
    ])
  };
}
