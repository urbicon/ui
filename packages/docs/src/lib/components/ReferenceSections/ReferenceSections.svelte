<script lang="ts">
  import { ApiReference, Section, TypesReference } from '#lib';
  import { useDocsI18n, useDocsLocale } from '#lib/i18n/index.js';
  import { deduplicateProps } from '../ApiReference/reference-table.js';
  import type { ReferenceSectionsProps } from './index.js';

  const dt = useDocsI18n();
  const docsLocale = useDocsLocale();

  let { componentData, typesDescription }: ReferenceSectionsProps = $props();

  // Read once: the API table, the links in it and the Types table below all
  // take these two values, so they cannot be fed different arrays.
  const apiProps = $derived(componentData.props ?? []);
  const types = $derived(componentData.types ?? []);

  // The table's own row count, not `apiProps.length`: a name the generated data
  // lists once per source is one row.
  const propCount = $derived(deduplicateProps(apiProps).length);
</script>

<!-- `dt` text inside a page whose prose has a language of its own: the heading
     carries the locale it is actually in, as TypesReference's does. -->
{#snippet apiTitle()}<span lang={docsLocale()}>{dt('apiReferenceTitle')}</span>{/snippet}

<Section
  marker
  id="api"
  titleSnippet={apiTitle}
  intent="secondary"
  meta={dt('propsCount', { count: propCount })}
>
  <ApiReference props={apiProps} {types} />
</Section>

<!-- `description` is passed even when unset: TypesReference falls back to a
     localized subtitle for `undefined`, and the API Reference heading above
     carries none. The count beside the heading is TypesReference's own. -->
<TypesReference {types} description={typesDescription ?? ''} />
