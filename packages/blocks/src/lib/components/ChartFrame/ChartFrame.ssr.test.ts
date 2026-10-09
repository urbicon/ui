import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ChartFramePlotProbe from './__fixtures__/ChartFramePlotProbe.svelte';

/**
 * The server has no container to measure, so the frame it sends is drawn at
 * the pre-measure width — 320 px unless `width` is set — and a visitor sees
 * that drawing, scaled into the column, until hydration and the first
 * observation replace it. A fixed `width` is what makes the server output
 * final, which is the reason the prop exists.
 */

/** The attributes of the one mark the probe draws over the plot box. */
function plotMark(body: string): Record<string, string> {
  const tag = /<rect data-plot[^>]*>/.exec(body)?.[0];
  if (!tag) throw new Error('the children snippet did not render');
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
}

describe('ChartFrame (SSR)', () => {
  it('draws at the 320 px pre-measure width when no width is given', () => {
    const { body } = render(ChartFramePlotProbe, { props: {} });

    expect(body).toContain('viewBox="0 0 320 240"');
    expect(plotMark(body)).toMatchObject({ 'data-width': '320', width: '268', height: '204' });
  });

  it('draws at a fixed width as given', () => {
    const { body } = render(ChartFramePlotProbe, { props: { width: 500 } });

    expect(body).toContain('viewBox="0 0 500 240"');
    expect(plotMark(body)).toMatchObject({ 'data-width': '500', width: '448', height: '204' });
  });
});
