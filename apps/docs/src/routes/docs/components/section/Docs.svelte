<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
</script>

<!-- `headingLevel={4}` on the demos below: the enclosing Examples section is an
     h2 and a CodeExample title is an h3, so a demo rendered at the default h2
     would put a same-level heading inside a heading's content. The middle demo
     is the exception — its subject IS the level.

     This note lives outside the CodeExample on purpose: `isolate` extracts the
     children markup verbatim as the shown snippet, comments included, so an
     authoring note placed inside becomes four lines of the reader's example. -->
<Section marker id="examples" title="Examples" subtitle="Structuring a page">
  <div class="flex flex-col gap-6">
    <CodeExample
      title="A numbered section"
      description="The everyday shape: an editorial marker, a title, a subtitle, and an id the table of contents can point at. On a page you write `marker` bare and the page counts — the literal is here because a demo section sits inside another section, and a nested one claims no number."
      isolate
    >
      <Section
        id="demo-basic"
        marker="01"
        headingLevel={4}
        title="Customization"
        subtitle="slotClasses, preset and unstyled"
      >
        <p class="text-text-secondary text-sm">Section content goes here.</p>
      </Section>
    </CodeExample>

    <CodeExample
      title="A heading level that is not the visual size"
      description="headingLevel decides the tag, intent decides the type scale. A subsection can keep h3 semantics and still read as a primary heading — nothing forces breaking the outline to get a size."
      isolate
    >
      <Section
        id="demo-levels"
        headingLevel={3}
        intent="primary"
        title="Still an h3"
        subtitle="Primary type scale, third-level semantics"
      >
        <p class="text-text-secondary text-sm">
          The outline sees an <code>h3</code>; the reader sees the 24px heading.
        </p>
      </Section>
    </CodeExample>

    <CodeExample
      title="Badges and a footer"
      description="Badges sit beside the title for status that belongs to the whole section; the footer snippet closes it with a note or a link."
      isolate
    >
      <Section
        id="demo-badges"
        headingLevel={4}
        title="Remote mode"
        badges={[{ text: 'beta', variant: 'soft', intent: 'warning' }]}
      >
        <p class="text-text-secondary text-sm">Server-side sorting, filtering and pagination.</p>
        {#snippet footerSnippet()}
          <p class="text-text-tertiary text-sm">
            Requires an endpoint that accepts the query state.
          </p>
        {/snippet}
      </Section>
    </CodeExample>
  </div>
</Section>
