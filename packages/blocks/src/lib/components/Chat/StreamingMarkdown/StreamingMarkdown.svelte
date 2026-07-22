<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { createIncrementalParser } from '../markdown/blocks';
  import type { MarkdownParseOptions, MarkdownUrlPolicy } from '../markdown/types';
  import type { CitationSource } from '../CitationChip';
  import MdBlock from './MdBlock.svelte';
  import type { MdRenderContext } from './md-context';
  import {
    streamingMarkdownVariants,
    type StreamingMarkdownVariants
  } from './streaming-markdown.variants';
  import type { StreamingMarkdownProps } from './index';

  let {
    content,
    streaming = false,
    sources,
    urlPolicy,
    renderers,
    autolink = false,
    headingLevelStart = 1,
    linkTarget = '_blank',
    tableRegionLabel = 'Table',
    size = 'md',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: StreamingMarkdownProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: StreamingMarkdownVariants = $derived({ size });
  const styles = $derived(streamingMarkdownVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'StreamingMarkdown', preset, variantProps, slotClassesProp)
  );

  /** Final class string per slot — computed once here so MdBlock/MdInline stay dumb. */
  const classes = $derived.by(() => {
    const out: Record<string, string> = {};
    for (const [name, slotFn] of Object.entries(styles)) {
      const override = slotClasses?.[name as keyof typeof slotClasses];
      out[name] = unstyled ? (override ?? '') : slotFn({ class: override });
    }
    return out;
  });

  const citations = $derived(
    sources?.length
      ? new Map(sources.map((source, i) => [source.id, { source, index: i + 1 }]))
      : undefined
  );

  // ── Parser lifecycle ───────────────────────────────────────────────────────
  // The incremental parser is plain (non-reactive) state, rebuilt only when a
  // parse *option* changes: the citation-id set, autolink, or the urlPolicy
  // reference (keep `urlPolicy` referentially stable in consumers). A rebuild
  // re-parses the full content; block keys are index-sequential in both the
  // old and new parser, so the keyed {#each} patches instead of remounting.
  // Appends mutate the parser inside $derived.by — legal, since none of the
  // mutated values are reactive state; the guard on `parser.source` makes
  // re-evaluation idempotent.
  let parser = createIncrementalParser();
  let parserOptionsKey: string | undefined;
  let parserPolicy: MarkdownUrlPolicy | undefined;

  const doc = $derived.by(() => {
    const ids = sources?.map((s) => s.id) ?? [];
    // JSON keeps distinct id sets distinct - a plain join can collide and
    // would then skip a required parser rebuild.
    const optionsKey = `${autolink ? 1 : 0}|${JSON.stringify(ids)}`;
    if (optionsKey !== parserOptionsKey || urlPolicy !== parserPolicy) {
      const options: MarkdownParseOptions = {
        urlPolicy,
        autolink,
        citationIds: ids.length ? new Set(ids) : undefined
      };
      parser = createIncrementalParser(options);
      parserOptionsKey = optionsKey;
      parserPolicy = urlPolicy;
    }
    if (content !== parser.source) {
      if (content.startsWith(parser.source)) {
        parser.append(content.slice(parser.source.length));
      } else {
        parser.reset();
        parser.append(content);
      }
    }
    return parser.document;
  });

  const ctx = $derived<MdRenderContext>({
    classes,
    renderers,
    citations,
    urlPolicy,
    headingLevelStart,
    linkTarget,
    tableRegionLabel
  });
</script>

<div
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  {...restProps}
>
  {#each doc.blocks as block (block.key)}
    <MdBlock {block} {ctx} />
  {/each}
  {#if streaming}<span class={classes.cursor} aria-hidden="true"></span>{/if}
</div>
