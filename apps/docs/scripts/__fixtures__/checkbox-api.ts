/**
 * A verbatim excerpt of the generated `apps/docs/src/routes/blocks/primitives/checkbox/api.ts`
 * — same `componentData` shape, same real prop names, types and descriptions.
 *
 * Checked in as a fixture because the generated modules are git-ignored: they
 * only exist after `docs:gen:all`, so a test that imported them would fail in a
 * fresh worktree and in CI's `test` job (which does not generate them).
 *
 * The real modules are still covered — `build-search-index.ts` imports them and
 * exits non-zero if they yield 0 props, and that runs in CI's `build` job.
 * Keep this in sync if the generator's shape changes; the build script fails
 * loudly if `componentData` disappears.
 */

import type { HarvestableApi } from '../harvest';

export const componentData: HarvestableApi = {
  name: 'Checkbox',
  props: [
    {
      name: 'checked',
      type: 'boolean',
      description: 'Current checked state. Supports two-way binding via `bind:checked`.'
    },
    {
      name: 'indeterminate',
      type: 'boolean',
      description:
        'Visual-only third state showing a dash icon. Resets to unchecked on next user toggle. Does not affect the submitted form value. Supports `bind:indeterminate`.'
    },
    {
      name: 'onCheckedChange',
      type: '(checked: boolean) => void',
      description: 'Fired after the checked state changes. Receives the new `checked` value.'
    }
  ],
  variants: [
    { name: 'intent', values: ['danger', 'neutral', 'primary', 'secondary', 'success', 'warning'] },
    { name: 'variant', values: ['filled', 'ghost', 'outlined'] },
    { name: 'size', values: ['lg', 'md', 'sm', 'xs'] }
  ],
  inheritance: [
    {
      props: [{ name: 'slotClasses', description: 'Per-slot class overrides.' }]
    }
  ]
};
