<script lang="ts">
  import { Button, Tab, TabItem, TabPanel, Toolbar } from '@urbicon-ui/blocks';

  const VARIANTS = ['line', 'pills', 'enclosed', 'solid'] as const;
  const ORIENTATIONS = ['horizontal', 'vertical'] as const;

  // Toolbar is the second horizontal scroll container in the library, so it can
  // clip a focus ring the same way. Its contents are consumer markup, so the
  // ring measured here is a plain Button's.
  const PADDINGS = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
</script>

<div data-testid="tab-fixtures" class="bg-surface-base flex flex-col gap-10 p-10">
  {#each PADDINGS as padding (padding)}
    <div data-probe={`toolbar-${padding}`} class="max-w-md">
      <p class="text-text-tertiary mb-2 text-xs">toolbar · padding {padding}</p>
      <Toolbar {padding} variant="outlined" aria-label={`toolbar ${padding}`}>
        <Button size="sm">One</Button>
        <Button size="sm">Two</Button>
      </Toolbar>
    </div>
  {/each}
  {#each ORIENTATIONS as orientation (orientation)}
    {#each VARIANTS as variant (variant)}
      <div data-probe={`${variant}-${orientation}`} class="max-w-md">
        <p class="text-text-tertiary mb-2 text-xs">{variant} · {orientation}</p>
        <Tab {variant} {orientation} defaultValue="a">
          {#snippet tabs()}
            <TabItem value="a">First</TabItem>
            <TabItem value="b">Second</TabItem>
            <TabItem value="c">Third</TabItem>
          {/snippet}
          {#snippet panels()}
            <TabPanel value="a"><span class="text-text-secondary text-sm">Panel A</span></TabPanel>
            <TabPanel value="b"><span class="text-text-secondary text-sm">Panel B</span></TabPanel>
            <TabPanel value="c"><span class="text-text-secondary text-sm">Panel C</span></TabPanel>
          {/snippet}
        </Tab>
      </div>
    {/each}
  {/each}
</div>
