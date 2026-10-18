<script lang="ts">
  import { ApiReference, Section, TypesReference } from '#lib';
  import { useDocsI18n } from '#lib/i18n/index.js';
  import { deduplicateProps } from '../ApiReference/reference-table.js';
  import type { ReferenceSectionsProps } from './index.js';

  const dt = useDocsI18n();

  let { componentData, typesDescription }: ReferenceSectionsProps = $props();

  // Read once: the API table, the links in it and the Types table below all
  // take these two values, so they cannot be fed different arrays.
  const apiProps = $derived(componentData.props ?? []);
  const types = $derived(componentData.types ?? []);

  // The table's own row count, not `apiProps.length`: a name the generated data
  // lists once per source is one row.
  const propCount = $derived(deduplicateProps(apiProps).length);
</script>

<Section
  marker
  id="api"
  title={dt('apiReferenceTitle')}
  intent="secondary"
  meta={dt('propsCount', { count: propCount })}
>
  <ApiReference props={apiProps} {types} />
</Section>

<!-- `description` is passed even when unset: TypesReference falls back to a
     localized subtitle for `undefined`, and the API Reference heading above
     carries none. -->
<TypesReference
  {types}
  meta={dt('typesCount', { count: types.length })}
  description={typesDescription ?? ''}
/>
