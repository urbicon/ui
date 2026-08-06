<script lang="ts">
  import { Badge } from '@urbicon-ui/blocks';
  import { type Column, Table } from '@urbicon-ui/table';
  import { InfoCard } from '$lib';
  import { useDocsI18n } from '$lib/i18n';
  import { revealTableRow } from '$lib/utils/cross-reference.js';
  import { tokenizeTypeExpression } from '$lib/utils/type-links.js';
  import { type ApiReferenceSlots, apiReferenceVariants } from './apireference.variants';
  import type { ApiReferenceProps, ApiProp } from './index.js';

  const dt = useDocsI18n();

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

  // `unstyled` drops the tv defaults; slotClasses always apply on top.
  // Folds through tv(): a `slotClasses` entry strips the default it conflicts
  // with, so the override wins its bucket instead of both classes landing on
  // the element and the stylesheet order picking the winner. Same contract as
  // the ternary every `blocks` component uses, and as CodePanel /
  // TypesReference / PlaygroundConfigurator here. Under `unstyled` there are
  // no defaults to fold against, so the override stands alone.
  const slot = (name: ApiReferenceSlots): string => {
    if (unstyled) return slotClasses[name] ?? '';
    const fns = styles as unknown as Record<string, (a: { class?: string }) => string>;
    return fns[name]({ class: slotClasses[name] });
  };

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
      // Through `slot()`, not `styles.highlightRing()` directly: `highlightRing`
      // IS a tv slot, so it is part of the public `slotClasses` union — called
      // directly it ignored the consumer's entry and survived `unstyled`. It is
      // not a class attribute but an argument, which is exactly why it was
      // missed.
      highlightClasses: slot('highlightRing'),
      fallbackSectionId: 'types',
      expand: true
    });
  }

  // `id` is set explicitly on every column: the `cell` snippet below branches on
  // `column.id`, and `<Table>` hands the snippet the raw column object — an
  // accessor-only column arrives with `id === undefined` and every cell would
  // silently fall through to the plain-text branch.
  // `$derived`, not a plain const: the titles come from the locale, so a
  // language switch has to rebuild the column set.
  const columns: Column[] = $derived([
    {
      id: 'name',
      accessor: 'name',
      title: dt('property'),
      minWidth: '160px',
      sortable: true,
      searchable: true,
      groupable: false,
      summable: false
    },
    {
      id: 'type',
      accessor: 'type',
      title: dt('type'),
      minWidth: '140px',
      searchable: true,
      groupable: false,
      summable: false
    },
    {
      id: 'defaultValue',
      accessor: 'defaultValue',
      title: dt('default'),
      minWidth: '80px',
      groupable: false,
      summable: false
    },
    {
      id: 'description',
      accessor: 'description',
      title: dt('description'),
      minWidth: '240px',
      groupable: false,
      summable: false
    }
  ]);
</script>

{#if sortedProps.length === 0}
  <InfoCard intent="warning" title={dt('noApiProperties')}>
    <p>{dt('noApiPropertiesBody')}</p>
  </InfoCard>
{:else}
  <!-- A `<div>`, not a `<section>`: this component renders no heading of its own
       — every page puts it inside a titled `<Section>` — so as a section it was
       an unnamed region, which a screen reader announces as nothing at all
       while still counting as a landmark boundary. The `id` stays: it is the
       anchor TypesReference links back to, and a page may override it via
       restProps — which is why the spread comes LAST. Svelte lets a later
       attribute win over an earlier spread, so `{...restProps}` in front would
       pin every instance to the literal, and a page rendering more than one
       (the Guide page renders 13) would emit the same id that often. -->
  <div id="api-reference" class={[slot('base'), className]} {...restProps}>
    <div class={slot('stats')}>
      <span>{dt('propsCount', { count: sortedProps.length })}</span>
      {#if requiredCount > 0}
        <span aria-hidden="true">·</span>
        <span class={slot('requiredCount')}>{dt('requiredCount', { count: requiredCount })}</span>
      {/if}
    </div>

    <Table
      items={tableItems}
      {columns}
      viewDefaults={{ pageSize: 999 }}
      enableSmartFilter={sortedProps.length > 6}
      searchPlaceholder={dt('filterProperties')}
      searchDebounceMs={200}
      noDataText={dt('noMatchingProperties')}
      size="sm"
    >
      {#snippet cell(rawItem, value, column)}
        {@const item = rawItem as unknown as ApiProp}
        {#if column.id === 'name'}
          <div class={slot('nameCell')}>
            <code class={slot(item.name.startsWith('...') ? 'spreadCode' : 'nameCode')}>
              {item.name}
            </code>
            {#if (item.source?.type ?? 'direct') === 'variant'}
              <Badge variant="soft" intent="primary" size="xs">{dt('badgeVariant')}</Badge>
            {:else if (item.source?.type ?? 'direct') === 'inherited'}
              <Badge variant="soft" intent="warning" size="xs">{dt('badgeInherited')}</Badge>
            {/if}
            {#if item.required}
              <Badge variant="soft" intent="danger" size="xs">{dt('badgeRequired')}</Badge>
            {/if}
          </div>
        {:else if column.id === 'type'}
          {#if item.values?.length}
            <div class={slot('typeChips')}>
              <!-- Keyed on value+index: a literal union may legitimately repeat a value. -->
              {#each item.values as val, i (`${val}-${i}`)}
                <span class={slot('typeChip')}>{val}</span>
              {/each}
            </div>
          {:else if item.type}
            {#if item.seeAlso?.startsWith('http')}
              <!-- External documentation link; `resolve()` only applies to
                   internal SvelteKit routes. -->
              <a href={item.seeAlso} class={slot('link')} target="_blank" rel="noopener external">
                <code class={slot('typeCode')}>{item.type}</code>
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
              <a href={item.seeAlso} class={slot('link')}>
                <code class={slot('typeCode')}>{item.type}</code>
              </a>
            {:else}
              <!-- Type names documented by a TypesReference on this page become in-page
                   links; every other token stays plain text. Written tight (no newlines
                   between segments) so the expression renders without stray whitespace. -->
              {@const segments = typeSegments(item.type)}
              <code class={slot('typeCode')}
                >{#each segments as segment, i (`${segment.text}-${i}`)}{#if segment.linked}<a
                      href="#type-{segment.text}"
                      class={slot('typeLink')}
                      onclick={(e) => handleTypeLinkClick(e, segment.text)}>{segment.text}</a
                    >{:else}{segment.text}{/if}{/each}</code
              >
            {/if}
          {:else}
            <span class={slot('placeholder')}>—</span>
          {/if}
        {:else if column.id === 'defaultValue'}
          {#if value != null && value !== ''}
            <code class={slot('defaultCode')}>{value}</code>
          {:else}
            <span class={slot('placeholder')}>—</span>
          {/if}
        {:else if column.id === 'description'}
          {#if value || item.seeAlsoRefs?.length}
            <div class={slot('descriptionCell')}>
              {#if value}
                <span class={slot('description')}>{value}</span>
              {/if}
              {#if item.seeAlsoRefs?.length}
                <!-- Prose `@see` values (`HTMLButtonAttributes.value`,
                     `CartesianDatum`). They name a type or member rather than a
                     doc URL, so they render as literal text — a link here would
                     have nowhere to point. Navigable `@see` targets live in
                     `seeAlso` and decorate the Type column instead. -->
                <span class={slot('seeAlsoRefs')}>
                  {dt('seeAlsoLabel')}
                  {#each item.seeAlsoRefs as ref, i (`${ref}-${i}`)}
                    <code class={slot('seeAlsoRef')}>{ref}</code>
                  {/each}
                </span>
              {/if}
            </div>
          {:else}
            <span class={slot('placeholder')}>—</span>
          {/if}
        {:else if value}
          <span class={slot('description')}>{value}</span>
        {:else}
          <span class={slot('placeholder')}>—</span>
        {/if}
      {/snippet}
      {#snippet pagination()}{/snippet}
    </Table>

    {#if usageNotes}
      <div class={slot('usageNotes')}>
        {@render usageNotes()}
      </div>
    {/if}
  </div>
{/if}
