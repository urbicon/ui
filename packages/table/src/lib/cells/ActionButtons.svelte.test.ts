// @vitest-environment jsdom
import { CopyIcon } from '@urbicon-ui/blocks';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ActionButtons, { type ExtraAction } from './ActionButtons.svelte';

// `extraActions` is consumer config, and nothing makes a label or a
// `testIdSuffix` unique across it.

type Row = { id: number };

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const action = (label: string, testIdSuffix?: string): ExtraAction<Row> => ({
  icon: CopyIcon,
  label,
  onClick: () => {},
  testIdSuffix
});

describe('ActionButtons (extra actions)', () => {
  it.each<[string, ExtraAction<Row>[]]>([
    ['two actions that share a label', [action('Copy'), action('Copy')]],
    ['a testIdSuffix that is the label of another action', [action('Copy', 'Move'), action('Move')]]
  ])('renders %s', (_, extraActions) => {
    const instance = mount(ActionButtons<Row>, {
      target: document.body,
      props: { item: { id: 1 }, extraActions }
    });
    dispose = () => unmount(instance);
    flushSync();
    expect(document.querySelectorAll('button')).toHaveLength(2);
  });
});
