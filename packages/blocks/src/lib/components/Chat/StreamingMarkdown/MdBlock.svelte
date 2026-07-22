<!-- Block-node dispatcher for StreamingMarkdown. Internal — not exported. -->
<script lang="ts">
  import CodeBlock from '../CodeBlock/CodeBlock.svelte';
  import type { BlockNode } from '../markdown/types';
  import type { MdRenderContext } from './md-context';
  import MdBlockSelf from './MdBlock.svelte';
  import MdInline from './MdInline.svelte';

  let { block, ctx }: { block: BlockNode; ctx: MdRenderContext } = $props();

  const headingTag = $derived(
    block.kind === 'heading' ? `h${Math.min(6, block.level - 1 + ctx.headingLevelStart)}` : 'h2'
  );

  function alignClass(align: 'left' | 'center' | 'right' | null): string {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-end';
    return 'text-start';
  }
</script>

{#if block.kind === 'paragraph'}
  <p class={ctx.classes.paragraph}><MdInline nodes={block.children} {ctx} /></p>
{:else if block.kind === 'heading'}
  <svelte:element this={headingTag} class={ctx.classes[`heading${block.level}`]}
    ><MdInline nodes={block.children} {ctx} /></svelte:element
  >
{:else if block.kind === 'code-block'}
  {#if ctx.renderers?.codeBlock}
    {@render ctx.renderers.codeBlock({ code: block.code, lang: block.lang, open: block.open })}
  {:else}
    <CodeBlock class={ctx.classes.codeBlock} code={block.code} lang={block.lang} />
  {/if}
{:else if block.kind === 'list'}
  <svelte:element
    this={block.ordered ? 'ol' : 'ul'}
    start={block.ordered ? block.start : undefined}
    class={block.ordered ? ctx.classes.listOrdered : ctx.classes.listUnordered}
  >
    {#each block.items as item, i (i)}
      <li class={item.checked === undefined ? ctx.classes.listItem : ctx.classes.taskItem}>
        {#if item.checked !== undefined}
          <input type="checkbox" checked={item.checked} disabled class={ctx.classes.taskCheckbox} />
          <div class="min-w-0 flex-1">
            {#each item.children as child, c (c)}
              <MdBlockSelf block={child} {ctx} />
            {/each}
          </div>
        {:else}
          {#each item.children as child, c (c)}
            <MdBlockSelf block={child} {ctx} />
          {/each}
        {/if}
      </li>
    {/each}
  </svelte:element>
{:else if block.kind === 'blockquote'}
  <blockquote class={ctx.classes.blockquote}>
    {#each block.children as child, c (c)}
      <MdBlockSelf block={child} {ctx} />
    {/each}
  </blockquote>
{:else if block.kind === 'table'}
  <!-- Focusable scroll container (axe: scrollable-region-focusable) -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class={ctx.classes.tableWrapper}
    role="region"
    aria-label={ctx.tableRegionLabel}
    tabindex="0"
  >
    <table class={ctx.classes.table}>
      <thead>
        <tr class={ctx.classes.tableRow}>
          {#each block.header as cell, col (col)}
            <th
              scope="col"
              class={[ctx.classes.tableHeadCell, alignClass(block.align[col] ?? null)]}
              ><MdInline nodes={cell} {ctx} /></th
            >
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each block.rows as row, r (r)}
          <tr class={ctx.classes.tableRow}>
            {#each row as cell, col (col)}
              <td class={[ctx.classes.tableCell, alignClass(block.align[col] ?? null)]}
                ><MdInline nodes={cell} {ctx} /></td
              >
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if block.kind === 'hr'}
  <hr class={ctx.classes.hr} />
{/if}
