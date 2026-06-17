<script lang="ts">
  import { Card, Checkbox } from '@urbicon-ui/blocks';
  import { Table, type Column } from '@urbicon-ui/table';
  import { typesReferenceVariants } from './types-reference.variants';
  import { extractLiteralValues } from './index.js';
  import type { TypesReferenceProps } from './index.js';

  let {
    types = [],
    title = 'Types',
    description = 'Local type definitions used by this component.',
    size = 'md',
    class: className,
    unstyled = false,
    slotClasses = {},
    emptyState,
    ...restProps
  }: TypesReferenceProps = $props();

  const styles = $derived(typesReferenceVariants({ size }));

  type SlotName = keyof NonNullable<TypesReferenceProps['slotClasses']>;
  function slot(name: SlotName) {
    if (unstyled) return slotClasses?.[name] ?? '';
    const slotFns = styles as unknown as Record<SlotName, (args: { class?: string }) => string>;
    return slotFns[name]({ class: slotClasses?.[name] });
  }

  let onlyReferenced = $state(false);

  const columns: Column[] = [
    { accessor: 'name', title: 'Name', sortable: true, searchable: true, minWidth: '160px' },
    { accessor: 'kind', title: 'Kind', sortable: true, minWidth: '100px' },
    { accessor: 'category', title: 'Category', sortable: true, minWidth: '120px' },
    { accessor: 'usedBy', title: 'Used by', sortable: true, minWidth: '120px' },
    { accessor: 'documentation', title: 'Description', searchable: true, minWidth: '280px' }
  ];

  const tableItems = $derived.by(() =>
    (types || []).map((t, index) => ({
      id: `type-${t.name}-${index}`,
      name: t.name,
      kind: t.type,
      category:
        t.category ||
        (t.name.endsWith('Props') ? 'props' : t.name.match(/Variants?$/) ? 'variant' : 'helper'),
      usedBy: Array.isArray(t.usedByProps) ? String(t.usedByProps.length) : '0',
      documentation: t.documentation || ''
    }))
  );

  const filteredItems = $derived.by(() =>
    onlyReferenced ? tableItems.filter((t) => Number(t.usedBy) > 0) : tableItems
  );

  function scrollToApiProp(event: MouseEvent, propRowId: string) {
    event.preventDefault();
    const apiSection = document.getElementById('api-reference');
    if (apiSection) {
      apiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    requestAnimationFrame(() => {
      let row = document.getElementById(propRowId) as HTMLElement | null;
      if (!row) {
        row = document.querySelector(`[id^="${propRowId}-"]`) as HTMLElement | null;
      }
      if (row) {
        const ringClasses = styles.highlightRing().split(' ');
        row.classList.add(...ringClasses);
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => row.classList.remove(...ringClasses), 1200);
      }
    });
  }
</script>

<section id="types" class="{slot('root')} {className ?? ''}" {...restProps}>
  <div class="space-y-6">
    <div class={slot('header')}>
      <h2 class={slot('title')}>{title}</h2>
      {#if description}
        <p class={slot('description')}>{description}</p>
      {/if}
    </div>

    <Card variant="elevated" padding="none">
      <div class={slot('toolbar')}>
        <div class={styles.toolbarText()}>
          {filteredItems.length} type{filteredItems.length !== 1 ? 's' : ''}
        </div>
        <Checkbox
          class={styles.filterLabel()}
          label="Only referenced"
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
          searchPlaceholder="Search types..."
        >
          {#snippet expandedRowContent(item)}
            {@const t = (types || []).find((x) => x.name === (item.name as string))}
            {#if t}
              {@const code =
                t.type === 'interface'
                  ? `interface ${t.name} {\n${t.definition}\n}`
                  : `type ${t.name} = ${t.definition}`}
              {@const values = t.type === 'type' ? extractLiteralValues(t.definition) : []}
              {@const usedBy = Array.isArray(t.usedByProps) ? t.usedByProps : []}

              <div id={`type-${t.name}`} class={slot('card')}>
                <pre class={slot('codeBlock')}><code>{code}</code></pre>

                {#if t.documentation}
                  <p class={styles.documentation()}>{t.documentation}</p>
                {/if}

                {#if values.length > 0}
                  <div class={slot('literalValues')}>
                    {#each values.slice(0, 12) as val (val)}
                      <span class={slot('literalBadge')}>{val}</span>
                    {/each}
                    {#if values.length > 12}
                      <span class="text-text-tertiary text-[11px]">
                        +{values.length - 12} more
                      </span>
                    {/if}
                  </div>
                {/if}

                {#if usedBy.length > 0}
                  <div class={slot('usedBySection')}>
                    Used by:
                    {#each usedBy as u, i (`${u.component}.${u.propName}`)}
                      <a
                        href="#api-reference"
                        class={styles.usedByLink()}
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
          No types match the current filter.
        </div>
      {/if}
    </Card>
  </div>
</section>
