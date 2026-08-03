/**
 * SSR smoke render for the Breadcrumb collapse logic. The vitest env is `node`,
 * so these can't exercise the click-to-expand interaction — but they pin the
 * branchy `entries` derivation (collapse thresholds, head/tail slicing, the
 * always-present current page) by asserting the rendered HTML.
 */

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import HomeIcon from '$lib/icons/HomeIcon.svelte';
import Breadcrumb from './Breadcrumb.svelte';
import type { BreadcrumbItem } from './index';

// Distinctive labels so `toContain` can't false-match a Tailwind class token.
const trail: BreadcrumbItem[] = [
  { label: 'Alpha', href: '/a' },
  { label: 'Bravo', href: '/b' },
  { label: 'Charlie', href: '/c' },
  { label: 'Delta', href: '/d' },
  { label: 'Echo' }
];

const EXPAND_LABEL = 'Show all breadcrumb items';
const countCurrent = (html: string) => html.match(/aria-current="page"/g)?.length ?? 0;

describe('Breadcrumb collapse (SSR)', () => {
  it('renders the full trail and no ellipsis when maxItems is unset', () => {
    const { body } = render(Breadcrumb, { props: { items: trail } });
    for (const label of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) {
      expect(body).toContain(label);
    }
    expect(body).not.toContain(EXPAND_LABEL);
    expect(countCurrent(body)).toBe(1);
  });

  it('collapses the middle into an ellipsis once the trail exceeds maxItems', () => {
    const { body } = render(Breadcrumb, { props: { items: trail, maxItems: 3 } });
    // default before=1 / after=1 → Alpha / … / Echo
    expect(body).toContain('Alpha');
    expect(body).toContain('Echo');
    expect(body).not.toContain('Bravo');
    expect(body).not.toContain('Charlie');
    expect(body).not.toContain('Delta');
    expect(body).toContain(EXPAND_LABEL);
    // the current page is never hidden by the collapse
    expect(countCurrent(body)).toBe(1);
  });

  it('does not collapse when maxItems is >= the item count', () => {
    const { body } = render(Breadcrumb, { props: { items: trail, maxItems: 5 } });
    expect(body).toContain('Charlie');
    expect(body).not.toContain(EXPAND_LABEL);
  });

  it('does not collapse when keeping head+tail would hide nothing', () => {
    // before(3) + after(1) = 4, only one item (Delta) would be hidden — render
    // it whole instead of swapping one item for a "…".
    const { body } = render(Breadcrumb, {
      props: { items: trail, maxItems: 3, itemsBeforeCollapse: 3, itemsAfterCollapse: 1 }
    });
    expect(body).toContain('Delta');
    expect(body).not.toContain(EXPAND_LABEL);
  });

  it('honors itemsBeforeCollapse=0 (ellipsis leads, current page kept)', () => {
    const { body } = render(Breadcrumb, {
      props: { items: trail, maxItems: 3, itemsBeforeCollapse: 0 }
    });
    expect(body).not.toContain('Alpha');
    expect(body).toContain('Echo');
    expect(body).toContain(EXPAND_LABEL);
    expect(countCurrent(body)).toBe(1);
  });

  it('uses a custom expandLabel as the ellipsis button accessible name', () => {
    const { body } = render(Breadcrumb, {
      props: { items: trail, maxItems: 3, expandLabel: 'Mehr anzeigen' }
    });
    expect(body).toContain('Mehr anzeigen');
    expect(body).not.toContain(EXPAND_LABEL);
  });
});

describe('Breadcrumb item icons (SSR)', () => {
  it('renders a per-item icon into the server HTML', () => {
    const withIcon: BreadcrumbItem[] = [{ ...trail[0], icon: HomeIcon }, ...trail.slice(1)];
    const { body } = render(Breadcrumb, { props: { items: withIcon } });
    expect(body).toContain('<svg');
    // one icon for one icon-bearing item — the label is untouched by it
    expect(body.match(/<svg/g)?.length).toBe(1);
    expect(body).toContain('Alpha');
  });

  it('renders no icon markup when no item declares one', () => {
    const { body } = render(Breadcrumb, { props: { items: trail } });
    expect(body).not.toContain('<svg');
  });
});
