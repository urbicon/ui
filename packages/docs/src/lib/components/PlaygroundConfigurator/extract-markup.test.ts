import { describe, expect, it } from 'vitest';
import { extractChildMarkup } from './extract-markup';

/**
 * The inputs are the shapes that actually occur in `apps/docs` — a wrapper div
 * around the component, a spread plus static attributes, nested snippets, a
 * self-closing tag — rather than invented minimal cases. Each `describe`
 * names the playground it was taken from.
 */

/** `declarations` become top-level `const`s in the fake playground's script. */
function playground(children: string, declarations: string[] = []): string {
  const script = declarations.map((name) => `  const ${name} = 1;`).join('\n');
  return `<script lang="ts">
${script}
</script>

<PlaygroundConfigurator componentName="X">
  {#snippet children(values)}
${children}
  {/snippet}
</PlaygroundConfigurator>
`;
}

describe('extractChildMarkup', () => {
  it('returns nothing for a self-closing tag (PinInput)', () => {
    const source = playground('    <PinInput {...values} />');
    expect(extractChildMarkup(source, 'PinInput')).toEqual({ markup: null, unresolved: [] });
  });

  it('reaches through a layout wrapper (Collapsible)', () => {
    const source = playground(`    <div class="w-full max-w-lg">
      <Collapsible variant={values.variant} title="What are design tokens?">
        <p class="text-text-secondary text-sm">
          Design tokens are named values.
        </p>
      </Collapsible>
    </div>`);
    const { markup, unresolved } = extractChildMarkup(source, 'Collapsible');
    expect(unresolved).toEqual([]);
    // De-indented to column 0, and the wrapper div is gone — it is docs
    // scaffolding, not part of using the component.
    expect(markup).toBe(
      '<p class="text-text-secondary text-sm">\n  Design tokens are named values.\n</p>'
    );
  });

  it('keeps sibling children whole (SegmentGroup)', () => {
    const source = playground(`    <SegmentGroup {...values} value="list" ariaLabel="View mode">
      <SegmentItem value="list">List</SegmentItem>
      <SegmentItem value="grid">Grid</SegmentItem>
    </SegmentGroup>`);
    expect(extractChildMarkup(source, 'SegmentGroup').markup).toBe(
      '<SegmentItem value="list">List</SegmentItem>\n<SegmentItem value="grid">Grid</SegmentItem>'
    );
  });

  it('keeps named snippets, which is the content no data declaration can express (Card)', () => {
    const source = playground(`    <Card variant={values.variant}>
      {#snippet header()}
        <div class="font-semibold">Card Title</div>
      {/snippet}
      <div class="text-sm">Cards group related content.</div>
      {#snippet footer()}
        <Button variant="ghost">Cancel</Button>
      {/snippet}
    </Card>`);
    const { markup, unresolved } = extractChildMarkup(source, 'Card');
    expect(unresolved).toEqual([]);
    expect(markup).toContain('{#snippet header()}');
    expect(markup).toContain('{#snippet footer()}');
    expect(markup).toContain('Cards group related content.');
  });

  it('does not stop at a nested tag of the same name', () => {
    const source = playground(`    <Sidebar open={values.open}>
      <Sidebar nested>inner</Sidebar>
      <span>after the nested one</span>
    </Sidebar>`);
    expect(extractChildMarkup(source, 'Sidebar').markup).toContain('after the nested one');
  });

  it('is not fooled by a self-closing tag of the same name inside', () => {
    const source = playground(`    <Toolbar>
      <Toolbar.Divider />
      <span>still inside</span>
    </Toolbar>`);
    expect(extractChildMarkup(source, 'Toolbar').markup).toContain('still inside');
  });

  it('survives a `>` inside an attribute string', () => {
    const source = playground(`    <Alert title="5 > 3" intent={values.intent}>
      <span>body</span>
    </Alert>`);
    expect(extractChildMarkup(source, 'Alert').markup).toBe('<span>body</span>');
  });

  describe('unresolved references', () => {
    it('flags a script const the snippet would not declare', () => {
      const source = playground(
        `    <Chat>
        <ChatMessageList messages={playgroundMessages} />
      </Chat>`,
        ['playgroundMessages']
      );
      expect(extractChildMarkup(source, 'Chat').unresolved).toEqual(['playgroundMessages']);
    });

    it('accepts it once codeSetup declares it', () => {
      const source = playground(
        `    <Chat>
        <ChatMessageList messages={playgroundMessages} />
      </Chat>`,
        ['playgroundMessages']
      );
      expect(extractChildMarkup(source, 'Chat', ['playgroundMessages']).unresolved).toEqual([]);
    });

    it('treats `values` as in scope — the generated tag carries those', () => {
      const source = playground(`    <Button>
        {values.children}
      </Button>`);
      expect(extractChildMarkup(source, 'Button').unresolved).toEqual([]);
    });

    // The four cases below all used to be false alarms: an identifier scan had
    // to special-case syntax, locals and the standard library, and still got
    // `x`/`y`/`v`/`i` wrong. Checking against the playground's own declarations
    // makes each one a non-question.
    it('ignores block bindings and property names', () => {
      const source = playground(
        `    <List>
        {#each items as item}
          <span>{item.label}</span>
        {/each}
      </List>`,
        ['items']
      );
      expect(extractChildMarkup(source, 'List').unresolved).toEqual(['items']);
    });

    it('ignores arrow parameters and object keys (ChartFrame)', () => {
      const source = playground(
        `    <ChartFrame>
        {#snippet children({ innerWidth, innerHeight })}
          {@const pts = demo.map((v, i) => ({ x: i * innerWidth, y: v * innerHeight }))}
          {#each pts as p (p.x)}
            <circle cx={p.x} cy={p.y} />
          {/each}
        {/snippet}
      </ChartFrame>`,
        ['demo']
      );
      // Only `demo` comes from the script — `v`, `i`, `x`, `y`, `pts`, `p` and
      // the snippet params do not.
      expect(extractChildMarkup(source, 'ChartFrame').unresolved).toEqual(['demo']);
    });

    it('ignores globals and named snippets', () => {
      const source = playground(`    <Card>
        {#snippet header()}
          <span>{Math.max(1, 2)}</span>
        {/snippet}
      </Card>`);
      expect(extractChildMarkup(source, 'Card').unresolved).toEqual([]);
    });

    it('flags an {@const} bound above the tag (Alert)', () => {
      // In scope for the markup, but outside what gets extracted — a copied
      // snippet has it exactly as little as a script const.
      const source = playground(`    {@const { children: description } = values}
    <Alert>
      {description}
    </Alert>`);
      expect(extractChildMarkup(source, 'Alert').unresolved).toEqual(['description']);
    });

    it('does not flag an {@const} bound inside the markup', () => {
      const source = playground(`    <Alert>
      {@const label = 'x'}
      <span>{label}</span>
    </Alert>`);
      expect(extractChildMarkup(source, 'Alert').unresolved).toEqual([]);
    });

    it('ignores a declaration name that only appears inside a string', () => {
      const source = playground(
        `    <Alert title="the demo value">
        <span>plain text mentioning demo</span>
      </Alert>`,
        ['demo']
      );
      expect(extractChildMarkup(source, 'Alert').unresolved).toEqual([]);
    });
  });

  it('returns nothing when the component is absent or the children are blank', () => {
    expect(extractChildMarkup(playground('    <Other />'), 'Missing').markup).toBeNull();
    expect(extractChildMarkup(playground('    <Card>\n\n    </Card>'), 'Card').markup).toBeNull();
  });
});
