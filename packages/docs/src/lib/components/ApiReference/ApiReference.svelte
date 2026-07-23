<script lang="ts">
  import { Badge } from '@urbicon-ui/blocks';
  import { type Column, Table } from '@urbicon-ui/table';
  import { InfoCard } from '$lib';
  import { revealTableRow } from '$lib/utils/cross-reference.js';
  import { tokenizeTypeExpression } from '$lib/utils/type-links.js';
  import { apiReferenceVariants } from './apireference.variants';
  import type { ApiReferenceProps, ApiProp } from './index.js';

  let {
    props = [],
    types = [],
    usageNotes,
    class: className,
    unstyled = false,
    slotClasses = {},
    ...restProps
  }: ApiReferenceProps = $props();

  const SOURCE_PRIORITY: Record<string, number> = { direct: 3, variant: 2, inherited: 1 };

  function deduplicateProps(raw: ApiProp[]): ApiProp[] {
    const seen: Record<string, ApiProp> = {};

    for (const prop of raw) {
      const existing = seen[prop.name];
      if (!existing) {
        seen[prop.name] = { ...prop };
        continue;
      }

      const existingP = SOURCE_PRIORITY[existing.source?.type ?? ''] ?? 0;
      const newP = SOURCE_PRIORITY[prop.source?.type ?? ''] ?? 0;

      const [winner, donor] = newP > existingP ? [prop, existing] : [existing, prop];

      seen[prop.name] = {
        ...winner,
        values: winner.type === 'boolean' ? undefined : (winner.values ?? donor.values),
        defaultValue: winner.defaultValue ?? donor.defaultValue,
        description: winner.description || donor.description
      };
    }

    return Object.values(seen);
  }

  const sortedProps = $derived.by(() =>
    deduplicateProps(props).sort((a, b) => {
      const aSpread = a.name.startsWith('...');
      const bSpread = b.name.startsWith('...');
      if (aSpread !== bSpread) return aSpread ? 1 : -1;
      if (a.required !== b.required) return a.required ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
  );

  const requiredCount = $derived(sortedProps.filter((p) => p.required).length);
  const styles = $derived(apiReferenceVariants());

  /**
   * Row id per prop, so `TypesReference` can link back to a specific row.
   * `<Table>` renders `<tr id={item.id}>`.
   */
  const tableItems = $derived(
    sortedProps.map((prop) => ({ ...prop, id: `prop-${prop.name}` })) as unknown as Record<
      string,
      unknown
    >[]
  );

  /** Type names that a `TypesReference` on this page documents — the only linkable ones. */
  const knownTypeNames = $derived(new Set(types.map((t) => t.name).filter(Boolean)));

  function typeSegments(type: string | undefined) {
    return tokenizeTypeExpression(type, knownTypeNames);
  }

  function handleTypeLinkClick(event: MouseEvent, typeName: string) {
    // Modified clicks (open in new tab, etc.) keep their native behaviour.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    revealTableRow({
      rowId: `type-${typeName}`,
      highlightClasses: styles.highlightRing(),
      fallbackSectionId: 'types',
      expand: true
    });
  }

  // `id` is set explicitly on every column: the `cell` snippet below branches on
  // `column.id`, and `<Table>` hands the snippet the raw column object — an
  // accessor-only column arrives with `id === undefined` and every cell would
  // silently fall through to the plain-text branch.
  const columns: Column[] = [
    {
      id: 'name',
      accessor: 'name',
      title: 'Prop',
      minWidth: '160px',
      sortable: true,
      searchable: true,
      groupable: false,
      summable: false
    },
    {
      id: 'type',
      accessor: 'type',
      title: 'Type',
      minWidth: '140px',
      searchable: true,
      groupable: false,
      summable: false
    },
    {
      id: 'defaultValue',
      accessor: 'defaultValue',
      title: 'Default',
      minWidth: '80px',
      groupable: false,
      summable: false
    },
    {
      id: 'description',
      accessor: 'description',
      title: 'Description',
      minWidth: '240px',
      groupable: false,
      summable: false
    }
  ];
</script>

{#if sortedProps.length === 0}
  <InfoCard intent="warning" title="No API Properties">
    <p>No API properties found for this component.</p>
  </InfoCard>
{:else}
  <!-- `id` is the anchor TypesReference links back to; a page may override it via restProps. -->
  <section
    id="api-reference"
    class={unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })}
    {...restProps}
  >
    <div
      class={unstyled ? (slotClasses?.stats ?? '') : styles.stats({ class: slotClasses?.stats })}
    >
      <span>{sortedProps.length} props</span>
      {#if requiredCount > 0}
        <span aria-hidden="true">·</span>
        <span class="text-danger">{requiredCount} required</span>
      {/if}
    </div>

    <Table
      items={tableItems}
      {columns}
      itemsPerPage={999}
      enableSmartFilter={sortedProps.length > 6}
      searchPlaceholder="Filter properties…"
      searchDebounceMs={200}
      noDataText="No matching properties"
      size="sm"
    >
      {#snippet cell(rawItem, value, column)}
        {@const item = rawItem as unknown as ApiProp}
        {#if column.id === 'name'}
          <div class="flex flex-wrap items-center gap-1.5">
            <code
              class={unstyled
                ? ''
                : item.name.startsWith('...')
                  ? styles.spreadCode()
                  : styles.nameCode()}
            >
              {item.name}
            </code>
            {#if (item.source?.type ?? 'direct') === 'variant'}
              <Badge variant="soft" intent="primary" size="xs">variant</Badge>
            {:else if (item.source?.type ?? 'direct') === 'inherited'}
              <Badge variant="soft" intent="warning" size="xs">inherited</Badge>
            {/if}
            {#if item.required}
              <Badge variant="soft" intent="danger" size="xs">required</Badge>
            {/if}
          </div>
        {:else if column.id === 'type'}
          {#if item.values?.length}
            <div class="flex flex-wrap gap-1">
              {#each item.values as val (val)}
                <span class={unstyled ? '' : styles.typeChip()}>{val}</span>
              {/each}
            </div>
          {:else if item.type}
            {#if item.seeAlso?.startsWith('http')}
              <!-- External documentation link; `resolve()` only applies to
                   internal SvelteKit routes. -->
              <a
                href={item.seeAlso}
                class={unstyled ? '' : styles.link()}
                target="_blank"
                rel="noopener external"
              >
                <code class={unstyled ? '' : styles.typeCode()}>{item.type}</code>
              </a>
            {:else if item.seeAlso?.startsWith('/') || item.seeAlso?.startsWith('#')}
              <!-- Internal documentation target — a route-relative path
                   (`/blocks/primitives/button#variants`, `…#type-Foo`, `…#api`,
                   `/customization/tokens#colors`) or a bare `#fragment`. Rendered
                   as a same-origin link wrapping the whole type, visually mirroring
                   the external branch above (no target/rel). `resolve()` on route
                   paths is the caller's responsibility — `packages/docs` has no
                   `$app/*` import. A non-navigable `@see` value (e.g. a bare
                   `HTMLButtonAttributes.value`) is neither `/` nor `#`, so it
                   falls through to the type-segment branch instead of becoming a
                   broken link. -->
              <a href={item.seeAlso} class={unstyled ? '' : styles.link()}>
                <code class={unstyled ? '' : styles.typeCode()}>{item.type}</code>
              </a>
            {:else}
              <!-- Type names documented by a TypesReference on this page become in-page
                   links; every other token stays plain text. Written tight (no newlines
                   between segments) so the expression renders without stray whitespace. -->
              {@const segments = typeSegments(item.type)}
              <code class={unstyled ? '' : styles.typeCode()}
                >{#each segments as segment, i (i)}{#if segment.linked}<a
                      href="#type-{segment.text}"
                      class={unstyled ? '' : styles.typeLink()}
                      onclick={(e) => handleTypeLinkClick(e, segment.text)}>{segment.text}</a
                    >{:else}{segment.text}{/if}{/each}</code
              >
            {/if}
          {:else}
            <span class={unstyled ? '' : styles.placeholder()}>—</span>
          {/if}
        {:else if column.id === 'defaultValue'}
          {#if value != null && value !== ''}
            <code class={unstyled ? '' : styles.defaultCode()}>{value}</code>
          {:else}
            <span class={unstyled ? '' : styles.placeholder()}>—</span>
          {/if}
        {:else if value}
          <span class={unstyled ? '' : styles.description()}>{value}</span>
        {:else}
          <span class={unstyled ? '' : styles.placeholder()}>—</span>
        {/if}
      {/snippet}
      {#snippet pagination()}{/snippet}
    </Table>

    {#if usageNotes}
      <div
        class={unstyled
          ? (slotClasses?.usageNotes ?? '')
          : styles.usageNotes({ class: slotClasses?.usageNotes })}
      >
        {@render usageNotes()}
      </div>
    {/if}
  </section>
{/if}
