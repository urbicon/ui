<script lang="ts">
  import { Checkbox } from '@urbicon-ui/blocks';
  import { Table, type Column } from '@urbicon-ui/table';
  import { InlineCode, Section } from '#lib';
  import { useDocsI18n, useDocsLocale } from '#lib/i18n/index.js';
  import { revealTableRow } from '#lib/utils/cross-reference.js';
  import { SEARCH_ABOVE_ROWS } from '../ApiReference/reference-table.js';
  import { typesReferenceVariants } from './types-reference.variants';
  import { extractLiteralValues } from './index.js';
  import type { LocalTypeDef, TypeUsedByRef, TypesReferenceProps } from './index.js';

  const dt = useDocsI18n();
  const docsLocale = useDocsLocale();

  let {
    types = [],
    title,
    description,
    // Half of the anchor pair `ApiReference` jumps to
    // (`fallbackSectionId: 'types'`), and the id `<Section>` derives its
    // heading id from. A page rendering more than one instance passes its own.
    id = 'types',
    // Numbered by default: the types section is a section of the page, listed
    // in its table of contents beside the marked ones.
    marker = true,
    meta,
    size = 'md',
    class: className,
    unstyled = false,
    slotClasses = {},
    emptyState,
    ...restProps
  }: TypesReferenceProps = $props();

  const styles = $derived(typesReferenceVariants({ size }));

  // Locale-backed defaults; a consumer prop always wins. A default is `dt` text
  // and renders under the docs locale's `lang` (the title/subtitle snippets);
  // a consumer's string is in the page's own language and renders as given.
  //
  // The toolbar's count is the types the component has, not the rows on screen:
  // "Only referenced" and the search narrow the rows and leave it alone, as the
  // API Reference's search leaves its prop count. It is the section's one count;
  // the heading shows a `meta` only when a page passes one.
  const typesCount = $derived(dt('typesCount', { count: types.length }));

  type SlotName = keyof NonNullable<TypesReferenceProps['slotClasses']>;
  function slot(name: SlotName) {
    if (unstyled) return slotClasses?.[name] ?? '';
    const slotFns = styles as unknown as Record<SlotName, (args: { class?: string }) => string>;
    return slotFns[name]({ class: slotClasses?.[name] });
  }

  let onlyReferenced = $state(false);

  // `$derived`, not a plain const: the titles come from the locale, so a
  // language switch has to rebuild the column set (same reason as ApiReference).
  //
  // Every column carries its own `cell`: the default cell renders plain body
  // text, and these columns read as the API table's do — the name as its prop
  // name, the kind as its type, category and use count as its default.
  const columns: Column[] = $derived([
    {
      accessor: 'name',
      title: dt('typeName'),
      sortable: true,
      searchable: true,
      minWidth: '160px',
      cell: nameCell
    },
    { accessor: 'kind', title: dt('typeKind'), sortable: true, minWidth: '100px', cell: kindCell },
    {
      accessor: 'category',
      title: dt('typeCategory'),
      sortable: true,
      minWidth: '120px',
      cell: categoryCell
    },
    {
      accessor: 'usedBy',
      title: dt('typeUsedBy'),
      sortable: true,
      minWidth: '120px',
      cell: usedByCell
    },
    // `width` DOES reach the DOM on the standard render path — not through
    // `columnTrackGroup` (that `<colgroup>` is virtualised-only, and this
    // table's is indeed empty), but through `TableHead`, which writes
    // `width`/`min-width` inline on the `<th>` whenever a column carries a
    // `width`. Measured on /table/table at a 960px reading column: with only a
    // `minWidth` this column claimed 7472px and the table 7958px; with the two
    // below, 326px and 960px.
    //
    // `width` alone is not enough either — it caps the track, but the cell then
    // wraps to as many lines as the prose needs (TableContext's runs to five).
    // The clamp in `documentationCell` is what keeps the row a row. Same pair
    // ApiReference uses on its description column, for the same reason.
    {
      accessor: 'documentation',
      title: dt('description'),
      searchable: true,
      width: '34%',
      minWidth: '280px',
      cell: documentationCell
    }
  ]);

  /**
   * The props that use a type, one entry per prop. The generated list names a
   * prop once per source it is declared in (a tv() axis that is also a direct
   * prop arrives twice), so the raw list repeats it: counted, it overstates the
   * column; keyed on, it throws `each_key_duplicate` and takes the page down.
   */
  function usersOf(t: LocalTypeDef): TypeUsedByRef[] {
    const byProp = new Map<string, TypeUsedByRef>();
    for (const u of Array.isArray(t.usedByProps) ? t.usedByProps : []) {
      const key = `${u.component}.${u.propName}`;
      if (!byProp.has(key)) byProp.set(key, u);
    }
    return [...byProp.values()];
  }

  const tableItems = $derived.by(() =>
    (types || []).map((t, index) => ({
      id: `type-${t.name}-${index}`,
      name: t.name,
      kind: t.type,
      category:
        t.category ||
        (t.name.endsWith('Props')
          ? dt('categoryProps')
          : t.name.match(/Variants?$/)
            ? dt('categoryVariant')
            : dt('categoryHelper')),
      usedBy: String(usersOf(t).length),
      documentation: t.documentation || ''
    }))
  );

  const filteredItems = $derived.by(() =>
    onlyReferenced ? tableItems.filter((t) => Number(t.usedBy) > 0) : tableItems
  );

  function scrollToApiProp(event: MouseEvent, propRowId: string) {
    // Modified clicks (open in new tab, etc.) keep their native behaviour.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    // The link sits inside an expandable row — without this the click bubbles to the
    // row and collapses the very section the reader is navigating from.
    event.stopPropagation();
    revealTableRow({
      rowId: propRowId,
      highlightClasses: slot('highlightRing'),
      fallbackSectionId: 'api-reference',
      // Symmetric to the other direction now that API rows disclose too: a
      // reader following "used by ButtonProps.variant" wants to see HOW that
      // prop uses the type, and the full description lives behind the row's
      // disclosure.
      expand: true
    });
  }
</script>

{#snippet nameCell(_item: Record<string, unknown>, value: unknown)}
  <code class={slot('nameCode')}>{value}</code>
{/snippet}

{#snippet kindCell(_item: Record<string, unknown>, value: unknown)}
  <code class={slot('kindCode')}>{value}</code>
{/snippet}

<!-- `<code>`, the element the API table's default value uses: a host
     stylesheet that sizes `code` (the docs site's `app.css` does, unlayered,
     over `text-xs`) then sizes both columns alike. -->
{#snippet categoryCell(_item: Record<string, unknown>, value: unknown)}
  <code class={slot('categoryCode')}>{value}</code>
{/snippet}

<!-- No prop uses the type: the dash the API table shows for "no default". -->
{#snippet usedByCell(_item: Record<string, unknown>, value: unknown)}
  {#if Number(value) > 0}
    <code class={slot('usedByCount')}>{value}</code>
  {:else}
    <span class={slot('placeholder')}>—</span>
  {/if}
{/snippet}

<!-- The description column's cell. Two jobs the default cell cannot do: clamp
     the prose to two lines (see the column note above), and render the
     inline markdown the JSDoc is written with (`InlineCode`) — `slotClasses`
     reads as a literal pair of backticks otherwise. ApiReference does both on its own
     description column; this is the same treatment, not a second one. -->
{#snippet documentationCell(_item: Record<string, unknown>, value: unknown)}
  {#if value}
    <span class={[slot('documentation'), slot('documentationClamped')]}>
      <InlineCode text={String(value)} />
    </span>
  {:else}
    <span class={slot('placeholder')}>—</span>
  {/if}
{/snippet}

<!-- A real `<Section>`, not a hand-built copy of one. This used to render its
     own `<section>` + `<h2>` + description and re-derive the section look from
     tv slots, which is why it drifted twice: the heading came out a size
     bigger than the `API Reference` above it, and it had no header margin at
     all, so it sat flush against the last API row. The page's table of
     contents lists it beside the marked sections anyway — it IS one.
     `intent="secondary"` is exactly what every component page passes to the
     API Reference section above, so the two now read as siblings by
     construction rather than by two configs agreeing.
     `id` stays a real prop with the `types` default: `<Section>` derives its
     heading id from it (`{id}-title`), so a page rendering more than one
     instance renames both halves at once — which is what makes the old
     instance-local `$props.id()` unnecessary. -->
{#snippet localizedTitle()}<span lang={docsLocale()}>{dt('typesTitle')}</span>{/snippet}
{#snippet localizedSubtitle()}<span lang={docsLocale()}>{dt('typesDescription')}</span>{/snippet}

<Section
  {id}
  {marker}
  {meta}
  {title}
  titleSnippet={title == null ? localizedTitle : undefined}
  subtitle={description}
  subtitleSnippet={description == null ? localizedSubtitle : undefined}
  intent="secondary"
  class={className}
  {...restProps}
>
  <div class={slot('stack')}>
    <div class={slot('toolbar')}>
      <span>{typesCount}</span>
      <Checkbox
        class={slot('filterLabel')}
        size="xs"
        label={dt('onlyReferenced')}
        checked={onlyReferenced}
        onCheckedChange={(val) => (onlyReferenced = val)}
      />
    </div>

    {#if filteredItems.length > 0}
      <!-- `size="sm"` is ApiReference's, and it is pinned rather than derived
         from this component's `size` prop on purpose: row density here is not
         a property of the section but of the pair. The two tables sit under
         each other on every component page, and two reference tables with
         different row heights read as two different widgets.
         The empty `pagination` snippet is the one case Table.svelte's note
         about that workaround does not cover: the footer it suppresses exists
         to carry the only visible row count, and this component already prints
         one in the toolbar above ("5 types"). Page size follows — a reference
         list a reader searches with Ctrl+F must not hide a type on page two. -->
      <Table
        items={filteredItems}
        {columns}
        viewDefaults={{ pageSize: 999 }}
        enableSmartFilter={tableItems.length > SEARCH_ABOVE_ROWS}
        searchPlaceholder={dt('searchTypes')}
        size="sm"
      >
        {#snippet expandedRowContent(item)}
          {@const t = (types || []).find((x) => x.name === (item.name as string))}
          {#if t}
            {@const code =
              t.type === 'type'
                ? `type ${t.name} = ${t.definition}`
                : `${t.type} ${t.name} {\n${t.definition}\n}`}
            {@const values = t.type === 'type' ? extractLiteralValues(t.definition) : []}
            {@const usedBy = usersOf(t)}

            <div id={`type-${t.name}`} class={slot('expandedPanel')}>
              <pre class={slot('codeBlock')}><code>{code}</code></pre>

              {#if t.documentation}
                <p class={slot('documentation')}><InlineCode text={t.documentation} /></p>
              {/if}

              {#if values.length > 0}
                <div class={slot('literalValues')}>
                  <!-- Keyed on value+index: a literal union may legitimately repeat a value. -->
                  {#each values.slice(0, 12) as val, i (`${val}-${i}`)}
                    <span class={slot('literalBadge')}>{val}</span>
                  {/each}
                  {#if values.length > 12}
                    <span class={slot('moreValues')}>
                      {dt('moreValues', { count: values.length - 12 })}
                    </span>
                  {/if}
                </div>
              {/if}

              {#if t.seeAlso || t.seeAlsoRefs?.length}
                <!-- `@see` on the type declaration. A navigable target becomes
                   a link; a bare sibling-type name (`CartesianDatum`) stays
                   a literal chip, because a link there would have nowhere to
                   point — the same split ApiReference makes for props. -->
                <div class={slot('seeAlsoSection')}>
                  {dt('seeAlsoLabel')}
                  {#if t.seeAlso}
                    <a
                      href={t.seeAlso}
                      class={slot('seeAlsoLink')}
                      target={t.seeAlso.startsWith('http') ? '_blank' : undefined}
                      rel={t.seeAlso.startsWith('http') ? 'noopener external' : undefined}
                      >{t.seeAlso}</a
                    >
                  {/if}
                  {#each t.seeAlsoRefs ?? [] as ref, i (`${ref}-${i}`)}
                    <code class={slot('seeAlsoRef')}>{ref}</code>
                  {/each}
                </div>
              {/if}

              {#if usedBy.length > 0}
                <div class={slot('usedBySection')}>
                  {dt('usedByLabel')}
                  <!-- Link and comma in one flex item: the section is the API
                       table's footnote line, a wrapping flex row, and a bare
                       ", " between two links would be an item of its own with
                       the gap on both sides of it. -->
                  {#each usedBy as u, i (`${u.component}.${u.propName}`)}
                    <span
                      ><a
                        href="#api-reference"
                        class={slot('usedByLink')}
                        onclick={(e) => scrollToApiProp(e, `prop-${u.propName}`)}
                        >{u.component}.{u.propName}</a
                      >{i < usedBy.length - 1 ? ',' : ''}</span
                    >
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/snippet}
        {#snippet pagination()}{/snippet}
      </Table>
    {:else if emptyState}
      {@render emptyState()}
    {:else}
      <div class={slot('emptyText')}>
        {dt('noTypesMatch')}
      </div>
    {/if}
  </div>
</Section>
