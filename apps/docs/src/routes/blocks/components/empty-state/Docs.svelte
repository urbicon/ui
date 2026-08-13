<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    EmptyState,
    Button,
    Card,
    BuildingIcon,
    FunnelIcon,
    PlusIcon,
    SearchIcon
  } from '@urbicon-ui/blocks';
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="With icon and CTA"
      code={`<EmptyState
  icon={BuildingIcon}
  title="No apartments yet"
  description="Get started by adding the first apartment."
>
  {#snippet cta()}
    <Button intent="primary"><PlusIcon />Add apartment</Button>
  {/snippet}
</EmptyState>`}
      language="svelte"
    >
      <EmptyState
        icon={BuildingIcon}
        title="No apartments yet"
        description="Get started by adding the first apartment."
      >
        {#snippet cta()}
          <Button intent="primary">
            <PlusIcon />
            Add apartment
          </Button>
        {/snippet}
      </EmptyState>
    </CodeExample>

    <CodeExample
      title="Compact — for inline empty rows"
      description="Use density='compact' inside table bodies and small cards where the full-page layout is too tall."
      code={`<EmptyState
  density="compact"
  icon={FunnelIcon}
  title="No matches"
  description="Try adjusting your filter."
/>`}
      language="svelte"
    >
      <EmptyState
        density="compact"
        icon={FunnelIcon}
        title="No matches"
        description="Try adjusting your filter."
      />
    </CodeExample>

    <CodeExample
      title="Embedded inside a Card"
      description="Use density='compact' when the EmptyState sits inside a container like a Card or a table body, where the default density would be too tall for the parent."
      code={`<Card variant="outlined" padding="md">
  <h3 class="text-text-primary mb-3 text-sm font-semibold">Recent activity</h3>
  <EmptyState
    density="compact"
    icon={SearchIcon}
    title="Nothing here yet"
    description="New events will show up as they happen."
  />
</Card>`}
      language="svelte"
    >
      <Card variant="outlined" padding="md">
        <h3 class="text-text-primary mb-3 text-sm font-semibold">Recent activity</h3>
        <EmptyState
          density="compact"
          icon={SearchIcon}
          title="Nothing here yet"
          description="New events will show up as they happen."
        />
      </Card>
    </CodeExample>
  </div>
</Section>

<Section marker id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      Pair with any icon from <code>@urbicon-ui/blocks</code>. The icon and text use the
      <code>primary</code> intent tokens, so they follow your theme; override any slot with
      <code>slotClasses</code>, <code>unstyled</code>, or a <code>preset</code>.
    </p>
    <p>
      Use the <code>cta</code> snippet for the primary action; render your own markup via
      <code>children</code> for richer empty states (e.g. tutorials, illustrations).
    </p>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="The icon is decorative">
      <p>
        The decorative icon is hidden from screen readers via its built-in <code>aria-hidden</code>.
      </p>
    </Note>
    <Note title="The title is an h3">
      <p>
        The title renders as an <code>&lt;h3&gt;</code>, so it nests under your page's
        <code>&lt;h1&gt;</code> in the heading hierarchy.
      </p>
    </Note>
  </NoteList>
</Section>
