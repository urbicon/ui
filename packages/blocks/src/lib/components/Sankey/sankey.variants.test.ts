import { describe, expect, it } from 'vitest';
import { sankeyVariants } from './sankey.variants';

describe('sankeyVariants', () => {
  it('default intent neutral colors node and link', () => {
    const styles = sankeyVariants({});
    expect(styles.nodeRect()).toContain('fill-neutral');
    expect(styles.link()).toContain('stroke-neutral');
  });

  it('intent maps to fill-{intent} and stroke-{intent}', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const styles = sankeyVariants({ intent });
      expect(styles.nodeRect()).toContain(`fill-${intent}`);
      expect(styles.link()).toContain(`stroke-${intent}`);
    }
  });

  it('uses semantic surface tokens for tooltip', () => {
    const tt = sankeyVariants({}).tooltip();
    expect(tt).toContain('bg-surface-elevated');
    expect(tt).toContain('text-text-primary');
    expect(tt).toContain('border-border-hairline');
  });

  it('tooltip uses z-tooltip token', () => {
    expect(sankeyVariants({}).tooltip()).toContain('z-[var(--z-tooltip)]');
  });

  it('node label uses fill-text-primary token', () => {
    expect(sankeyVariants({}).nodeLabel()).toContain('fill-text-primary');
  });

  it('node value uses fill-text-tertiary and tabular-nums', () => {
    const v = sankeyVariants({}).nodeValue();
    expect(v).toContain('fill-text-tertiary');
    expect(v).toContain('tabular-nums');
  });

  it('link uses fill-none for path-only rendering', () => {
    expect(sankeyVariants({}).link()).toContain('fill-none');
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const styles = sankeyVariants({ intent });
      expect(styles.nodeRect()).not.toMatch(/\bdark:/);
      expect(styles.link()).not.toMatch(/\bdark:/);
      expect(styles.tooltip()).not.toMatch(/\bdark:/);
    }
  });

  it('tooltip has data-visible toggle', () => {
    expect(sankeyVariants({}).tooltip()).toContain('data-[visible=true]:opacity-100');
  });

  it('node and link have transition classes', () => {
    expect(sankeyVariants({}).node()).toContain('transition-');
    expect(sankeyVariants({}).link()).toContain('transition-');
  });
});
