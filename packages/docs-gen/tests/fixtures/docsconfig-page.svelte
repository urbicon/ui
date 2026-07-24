<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { Button, Drawer } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['placement', 'size', 'hideCloseButton'],
        defaults: { placement: 'right', size: 'md' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Drawer Component', showToc: true }
  };

  // Runes and markup live alongside the config and must not disturb parsing.
  let open = $state(false);
</script>

<Button onclick={() => (open = true)}>Open</Button>
<Drawer bind:open>Content</Drawer>
