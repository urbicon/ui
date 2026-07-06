<script lang="ts">
  // E2E fixture for ACC-3 per-instance collapse motion (Playwright). Renders Collapsible +
  // Accordion in default and prop-overridden states, open, so a test can read the computed
  // transition-duration / -timing-function off each content region. Not part of the docs nav.
  import { Accordion, AccordionItem, Collapsible } from '@urbicon-ui/blocks';
</script>

<div class="bg-surface-base min-h-screen p-8" data-testid="collapse-motion-fixtures">
  <h1 class="text-text-primary mb-6 text-xl font-bold">Collapse motion fixtures</h1>

  <!-- Standalone Collapsible: default (token) vs. per-instance override. -->
  <Collapsible name="cm-default" title="Default" open>Default content.</Collapsible>
  <Collapsible
    name="cm-prop"
    title="Overridden"
    open
    transitionDuration={600}
    transitionEasing="linear"
  >
    Overridden content.
  </Collapsible>

  <!-- Accordion sets the vars on its root; the open item's content must inherit them. -->
  <Accordion transitionDuration={700} defaultValue="a1">
    <AccordionItem value="a1" title="Item one">Item one content.</AccordionItem>
  </Accordion>
</div>
