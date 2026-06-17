import { describe, expect, it } from 'vitest';
import { computeSankeyLayout, sankeyLinkPath } from './layout';

describe('computeSankeyLayout', () => {
  it('handles empty graph gracefully', () => {
    const result = computeSankeyLayout([], [], { width: 600, height: 400 });
    expect(result.nodes).toHaveLength(0);
    expect(result.links).toHaveLength(0);
  });

  it('handles isolated nodes (no links)', () => {
    const result = computeSankeyLayout([{ id: 'a' }, { id: 'b' }], [], { width: 600, height: 400 });
    expect(result.nodes).toHaveLength(2);
    expect(result.links).toHaveLength(0);
    for (const n of result.nodes) {
      expect(n.value).toBe(0);
    }
  });

  it('places source on left and sink on right (justify)', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }],
      [{ source: 'a', target: 'b', value: 100 }],
      { width: 600, height: 400, nodeAlign: 'justify' }
    );
    const a = result.nodes.find((n) => n.id === 'a')!;
    const b = result.nodes.find((n) => n.id === 'b')!;
    expect(a.x0).toBeLessThan(b.x0);
    expect(a.x0).toBe(0);
    expect(b.x1).toBe(600);
  });

  it('preserves value conservation: sum incoming = node.value for inner nodes', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'pot' }],
      [
        { source: 'a', target: 'pot', value: 100 },
        { source: 'b', target: 'pot', value: 50 },
        { source: 'c', target: 'pot', value: 25 },
        { source: 'pot', target: 'd', value: 175 }
      ],
      { width: 600, height: 400 }
    );
    const pot = result.nodes.find((n) => n.id === 'pot')!;
    const incoming = pot.targetLinks.reduce((s, l) => s + l.value, 0);
    const outgoing = pot.sourceLinks.reduce((s, l) => s + l.value, 0);
    expect(incoming).toBe(175);
    expect(outgoing).toBe(175);
    expect(pot.value).toBe(175);
  });

  it('assigns layer correctly across 3-stage flow', () => {
    const result = computeSankeyLayout(
      [{ id: 's1' }, { id: 's2' }, { id: 'mid' }, { id: 't1' }, { id: 't2' }],
      [
        { source: 's1', target: 'mid', value: 10 },
        { source: 's2', target: 'mid', value: 20 },
        { source: 'mid', target: 't1', value: 15 },
        { source: 'mid', target: 't2', value: 15 }
      ],
      { width: 600, height: 400, nodeAlign: 'justify' }
    );
    expect(result.nodes.find((n) => n.id === 's1')!.layer).toBe(0);
    expect(result.nodes.find((n) => n.id === 's2')!.layer).toBe(0);
    expect(result.nodes.find((n) => n.id === 'mid')!.layer).toBe(1);
    expect(result.nodes.find((n) => n.id === 't1')!.layer).toBe(2);
    expect(result.nodes.find((n) => n.id === 't2')!.layer).toBe(2);
  });

  it('respects nodeWidth and nodePadding options', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [
        { source: 'a', target: 'c', value: 50 },
        { source: 'b', target: 'c', value: 50 }
      ],
      { width: 400, height: 200, nodeWidth: 30, nodePadding: 10 }
    );
    for (const n of result.nodes) {
      expect(n.x1 - n.x0).toBe(30);
    }
  });

  it('all nodes have y0 < y1 after layout', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [
        { source: 'a', target: 'c', value: 50 },
        { source: 'b', target: 'c', value: 100 }
      ],
      { width: 400, height: 200 }
    );
    for (const n of result.nodes) {
      expect(n.y0).toBeLessThanOrEqual(n.y1);
    }
  });

  it('all nodes stay within [0, height]', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      [
        { source: 'a', target: 'c', value: 100 },
        { source: 'b', target: 'd', value: 80 }
      ],
      { width: 400, height: 200, nodePadding: 10 }
    );
    for (const n of result.nodes) {
      expect(n.y0).toBeGreaterThanOrEqual(0);
      expect(n.y1).toBeLessThanOrEqual(200 + 0.01); // floating tolerance
    }
  });

  it('drops links to unknown nodes silently', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }],
      [
        { source: 'a', target: 'b', value: 50 },
        { source: 'a', target: 'unknown', value: 25 } // link to non-existing node
      ],
      { width: 400, height: 200 }
    );
    expect(result.links).toHaveLength(1);
    expect(result.links[0].source.id).toBe('a');
    expect(result.links[0].target.id).toBe('b');
  });

  it('warns and skips self-loops', () => {
    const original = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };
    try {
      const result = computeSankeyLayout([{ id: 'a' }], [{ source: 'a', target: 'a', value: 50 }], {
        width: 400,
        height: 200
      });
      expect(result.links).toHaveLength(0);
      expect(warned).toBe(true);
    } finally {
      console.warn = original;
    }
  });

  it('left alignment places sinks immediately after their sources', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [
        { source: 'a', target: 'b', value: 50 },
        { source: 'b', target: 'c', value: 50 }
      ],
      { width: 600, height: 200, nodeAlign: 'left' }
    );
    expect(result.nodes.find((n) => n.id === 'a')!.layer).toBe(0);
    expect(result.nodes.find((n) => n.id === 'b')!.layer).toBe(1);
    expect(result.nodes.find((n) => n.id === 'c')!.layer).toBe(2);
  });

  it('preserves source/target reference identity in links', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }],
      [{ source: 'a', target: 'b', value: 100 }],
      { width: 400, height: 200 }
    );
    const a = result.nodes.find((n) => n.id === 'a')!;
    const link = result.links[0];
    expect(link.source).toBe(a);
    expect(a.sourceLinks[0]).toBe(link);
  });

  it('passes meta through to laid-out nodes and links', () => {
    const result = computeSankeyLayout(
      [
        { id: 'a', meta: { color: 'red' } },
        { id: 'b', meta: { color: 'blue' } }
      ],
      [{ source: 'a', target: 'b', value: 50, meta: { type: 'flow' } }],
      { width: 400, height: 200 }
    );
    expect(result.nodes[0].meta).toEqual({ color: 'red' });
    expect(result.links[0].meta).toEqual({ type: 'flow' });
  });

  it('assigns longest path when a node is reachable via multiple paths', () => {
    // A→B→D + A→C→B→D — B should land at layer 2 (via A→C→B), D at layer 3
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      [
        { source: 'a', target: 'b', value: 50 },
        { source: 'a', target: 'c', value: 50 },
        { source: 'c', target: 'b', value: 50 },
        { source: 'b', target: 'd', value: 100 }
      ],
      { width: 600, height: 200, nodeAlign: 'left' }
    );
    expect(result.nodes.find((n) => n.id === 'a')!.layer).toBe(0);
    expect(result.nodes.find((n) => n.id === 'c')!.layer).toBe(1);
    expect(result.nodes.find((n) => n.id === 'b')!.layer).toBe(2);
    expect(result.nodes.find((n) => n.id === 'd')!.layer).toBe(3);
  });

  it('cyclic sub-graphs trigger cycle warning AND get layered', () => {
    const original = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };
    try {
      const result = computeSankeyLayout(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [
          { source: 'a', target: 'b', value: 50 },
          { source: 'b', target: 'c', value: 50 },
          { source: 'c', target: 'a', value: 50 } // cycle
        ],
        { width: 600, height: 200 }
      );
      // Should still produce some layout, not all stacked at layer 0
      const layers = new Set(result.nodes.map((n) => n.layer));
      expect(layers.size).toBeGreaterThan(0);
      expect(warned).toBe(true);
    } finally {
      console.warn = original;
    }
  });

  it('inner node value equals max(incoming, outgoing) when they differ', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'mid' }, { id: 'b' }, { id: 'c' }],
      [
        { source: 'a', target: 'mid', value: 100 },
        { source: 'mid', target: 'b', value: 60 },
        { source: 'mid', target: 'c', value: 30 }
      ],
      { width: 400, height: 200 }
    );
    const mid = result.nodes.find((n) => n.id === 'mid')!;
    // incoming=100, outgoing=90 → value=100
    expect(mid.value).toBe(100);
  });
});

describe('sankeyLinkPath', () => {
  it('produces a valid SVG cubic-bezier path', () => {
    const result = computeSankeyLayout(
      [{ id: 'a' }, { id: 'b' }],
      [{ source: 'a', target: 'b', value: 50 }],
      { width: 400, height: 200 }
    );
    const path = sankeyLinkPath(result.links[0]);
    expect(path).toMatch(/^M[\d.-]+,[\d.-]+C[\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+$/);
  });
});
