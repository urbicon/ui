<script lang="ts">
  import { CodeExample, Section, TableOfContents } from '@urbicon-ui/docs';
</script>

<Section marker="01" id="examples" title="Examples" subtitle="Page navigation">
  <CodeExample title="Basic Usage" isolate>
    <TableOfContents
      navigation={[
        { id: 'overview', title: 'Overview' },
        { id: 'api', title: 'API' }
      ]}
    />
  </CodeExample>
</Section>
