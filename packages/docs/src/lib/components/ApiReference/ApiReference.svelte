<script lang="ts">
  import { Badge } from '@urbicon-ui/blocks';
  import { type Column, Table } from '@urbicon-ui/table';
  import { InfoCard } from '$lib';
  import { apiReferenceVariants } from './apireference.variants';
  import type { ApiReferenceProps, ApiProp } from './index.js';

  let {
    props = [],
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

  const columns: Column[] = [
    {
      accessor: 'name',
      title: 'Prop',
      minWidth: '160px',
      sortable: true,
      searchable: true,
      groupable: false,
      summable: false
    },
    {
      accessor: 'type',
      title: 'Type',
      minWidth: '140px',
      searchable: true,
      groupable: false,
      summable: false
    },
    {
      accessor: 'defaultValue',
      title: 'Default',
      minWidth: '80px',
      groupable: false,
      summable: false
    },
    {
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
  <section
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
      items={sortedProps as unknown as Record<string, unknown>[]}
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
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a
                href={item.seeAlso}
                class={unstyled ? '' : styles.link()}
                target="_blank"
                rel="noopener external"
              >
                <code class={unstyled ? '' : styles.typeCode()}>{item.type}</code>
              </a>
            {:else}
              <code class={unstyled ? '' : styles.typeCode()}>{item.type}</code>
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
