<script lang="ts">
  import { Card, Checkbox } from '@urbicon-ui/blocks';
  import { Table, type Column } from '@urbicon-ui/table';
  import { useDocsI18n } from '$lib/i18n';
  import { revealTableRow } from '$lib/utils/cross-reference.js';
  import { typesReferenceVariants } from './types-reference.variants';
  import { extractLiteralValues } from './index.js';
  import type { TypesReferenceProps } from './index.js';

  const dt = useDocsI18n();

  let {
    types = [],
    title,
    description,
    size = 'md',
    class: className,
    unstyled = false,
    slotClasses = {},
    emptyState,
    ...restProps
  }: TypesReferenceProps = $props();

  // Instance-local heading id. `$props.id()` may only appear as a top-level
  // initializer, hence the two steps (see SVELTE5-PATTERNS.md); the same shape
  // PlaygroundConfigurator already uses for its own title.
  const propsId = $props.id();
  const titleId = `types-title-${propsId}`;

  const styles = $derived(typesReferenceVariants({ size }));

  // Locale-backed defaults; a consumer prop always wins.
  const headingTitle = $derived(title ?? dt('typesTitle'));
  const headingDescription = $derived(description ?? dt('typesDescription'));

  type SlotName = keyof NonNullable<TypesReferenceProps['slotClasses']>;
  function slot(name: SlotName) {
    if (unstyled) return slotClasses?.[name] ?? '';
    const slotFns = styles as unknown as Record<SlotName, (args: { class?: string }) => string>;
    return slotFns[name]({ class: slotClasses?.[name] });
  }

  let onlyReferenced = $state(false);

  // `$derived`, not a plain const: the titles come from the locale, so a
  // language switch has to rebuild the column set (same reason as ApiReference).
  const columns: Column[] = $derived([
    {
      accessor: 'name',
      title: dt('typeName'),
      sortable: true,
      searchable: true,
      minWidth: '160px'
    },
    { accessor: 'kind', title: dt('typeKind'), sortable: true, minWidth: '100px' },
    { accessor: 'category', title: dt('typeCategory'), sortable: true, minWidth: '120px' },
    { accessor: 'usedBy', title: dt('typeUsedBy'), sortable: true, minWidth: '120px' },
    { accessor: 'documentation', title: dt('description'), searchable: true, minWidth: '280px' }
  ]);

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
      usedBy: Array.isArray(t.usedByProps) ? String(t.usedByProps.length) : '0',
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
      fallbackSectionId: 'api-reference'
    });
  }
</script>

<!-- The heading is right there, so the region can name itself; without the
     reference this is a `<section>` a screen reader announces as nothing.
     `id="types"` stays fixed on purpose — it is one half of the anchor pair
     ApiReference jumps to (`fallbackSectionId: 'types'`), and `{...restProps}`
     comes last so a page rendering more than one can rename it. The heading id
     has no such contract, so it is instance-local: it was hardcoded, and the
     types-reference docs page renders three instances, which left the second
     and third `<section>` named by the FIRST one's heading. -->
<section
  id="types"
  class="{slot('root')} {className ?? ''}"
  aria-labelledby={titleId}
  {...restProps}
>
  <div class="space-y-6">
    <div class={slot('header')}>
      <h2 id={titleId} class={slot('title')}>{headingTitle}</h2>
      {#if headingDescription}
        <p class={slot('description')}>{headingDescription}</p>
      {/if}
    </div>

    <Card variant="elevated" padding="none">
      <div class={slot('toolbar')}>
        <div class={slot('toolbarText')}>
          {dt('typesCount', { count: filteredItems.length })}
        </div>
        <Checkbox
          class={slot('filterLabel')}
          label={dt('onlyReferenced')}
          checked={onlyReferenced}
          onCheckedChange={(val) => (onlyReferenced = val)}
        />
      </div>

      {#if filteredItems.length > 0}
        <Table
          items={filteredItems}
          {columns}
          itemsPerPage={50}
          enableSmartFilter={false}
          searchPlaceholder={dt('searchTypes')}
        >
          {#snippet expandedRowContent(item)}
            {@const t = (types || []).find((x) => x.name === (item.name as string))}
            {#if t}
              {@const code =
                t.type === 'type'
                  ? `type ${t.name} = ${t.definition}`
                  : `${t.type} ${t.name} {\n${t.definition}\n}`}
              {@const values = t.type === 'type' ? extractLiteralValues(t.definition) : []}
              {@const usedBy = Array.isArray(t.usedByProps) ? t.usedByProps : []}

              <div id={`type-${t.name}`} class={slot('card')}>
                <pre class={slot('codeBlock')}><code>{code}</code></pre>

                {#if t.documentation}
                  <p class={slot('documentation')}>{t.documentation}</p>
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
                    {#each usedBy as u, i (`${u.component}.${u.propName}`)}
                      <a
                        href="#api-reference"
                        class={slot('usedByLink')}
                        onclick={(e) => scrollToApiProp(e, `prop-${u.propName}`)}
                        >{u.component}.{u.propName}</a
                      >{i < usedBy.length - 1 ? ', ' : ''}
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          {/snippet}
        </Table>
      {:else if emptyState}
        {@render emptyState()}
      {:else}
        <div class="text-text-tertiary p-6 text-center text-sm">
          {dt('noTypesMatch')}
        </div>
      {/if}
    </Card>
  </div>
</section>
