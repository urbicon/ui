<!--
  Recursive inline-node renderer for StreamingMarkdown. Internal — not exported.

  Whitespace discipline: every branch keeps its element glued to the control-flow
  tags (no newline between `}` and `<strong>`), because stray template whitespace
  becomes a visible space inside underlines / code backgrounds. Guarded by the
  exact-textContent test in StreamingMarkdown.svelte.test.ts.
-->
<script lang="ts">
  import { resolveIcon } from '$lib/icons';
  import ImageIconDefault from '$lib/icons/ImageIcon.svelte';
  import CitationChip from '../CitationChip/CitationChip.svelte';
  import type { CitationSource } from '../CitationChip';
  import type { InlineNode } from '../markdown/types';
  import { checkLinkUrl } from '../markdown/url-policy';
  import type { MdRenderContext } from './md-context';
  import MdInlineSelf from './MdInline.svelte';

  const ImageIcon = resolveIcon('image', ImageIconDefault);

  let { nodes, ctx }: { nodes: InlineNode[]; ctx: MdRenderContext } = $props();

  // The citation snippet override receives the same sanitized-URL contract as
  // renderers.link/image: a source.url that fails the policy is stripped
  // before it ever reaches consumer markup (review finding, P1 wave).
  function safeCitationSource(source: CitationSource | undefined): CitationSource | undefined {
    if (!source?.url) return source;
    const check = checkLinkUrl(source.url, ctx.urlPolicy);
    return check.ok ? { ...source, url: check.href } : { ...source, url: undefined };
  }
</script>

<!--
  Index keys throughout: inline/block node arrays are write-once (the engine
  replaces the whole block object on change, never reorders within it), so
  position IS identity here.
-->
{#each nodes as node, i (i)}
  {#if node.kind === 'text'}{node.text}{:else if node.kind === 'strong'}<strong
      ><MdInlineSelf nodes={node.children} {ctx} /></strong
    >{:else if node.kind === 'em'}<em><MdInlineSelf nodes={node.children} {ctx} /></em
    >{:else if node.kind === 'strike'}<del><MdInlineSelf nodes={node.children} {ctx} /></del
    >{:else if node.kind === 'code'}<code class={ctx.classes.inlineCode}>{node.text}</code
    >{:else if node.kind === 'link'}{#if ctx.renderers?.link}{@render ctx.renderers.link({
        href: node.href,
        title: node.title,
        children: node.children,
        blocked: node.blocked === true
      })}{:else if node.blocked}<span class={ctx.classes.linkBlocked}
        ><MdInlineSelf nodes={node.children} {ctx} /></span
      >{:else}<a
        class={ctx.classes.link}
        href={node.href}
        title={node.title}
        target={ctx.linkTarget}
        rel={ctx.linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
        ><MdInlineSelf nodes={node.children} {ctx} /></a
      >{/if}{:else if node.kind === 'image'}{#if ctx.renderers?.image}{@render ctx.renderers.image({
        src: node.src,
        alt: node.alt,
        title: node.title,
        blocked: node.blocked === true
      })}{:else if node.blocked}<span class={ctx.classes.imageBlocked}
        ><ImageIcon class="size-3.5 shrink-0" /><span class="truncate">{node.alt}</span></span
      >{:else}<img
        class={ctx.classes.image}
        src={node.src}
        alt={node.alt}
        title={node.title}
        loading="lazy"
      />{/if}{:else if node.kind === 'citation'}{#if ctx.renderers?.citation}{@render ctx.renderers.citation(
        {
          id: node.id,
          source: safeCitationSource(ctx.citations?.get(node.id)?.source),
          index: ctx.citations?.get(node.id)?.index
        }
      )}{:else}{@const entry = ctx.citations?.get(node.id)}{#if entry}<CitationChip
          source={entry.source}
          index={entry.index}
          urlPolicy={ctx.urlPolicy}
        />{:else}{`[${node.id}]`}{/if}{/if}{:else if node.kind === 'break'}<br />{/if}
{/each}
