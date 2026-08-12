<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Separator, Button, Avatar, Card } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Inline metadata"
      description="A vertical separator is `h-full`, so give it an explicit height (here `h-4`) inside a flex row."
      isolate
      previewClass="flex justify-center w-full"
    >
      <div class="text-text-secondary flex items-center gap-3 text-sm">
        <span>Engineering</span>
        <Separator orientation="vertical" class="h-4" />
        <span>12 min read</span>
        <Separator orientation="vertical" class="h-4" />
        <time datetime="2024-03">March 2024</time>
      </div>
    </CodeExample>

    <CodeExample
      title="Section boundaries in a card"
      description="Reach for a Separator to set off a distinct region. Use `divide-y` for the rules between repeated rows."
      isolate
      previewClass="flex justify-center w-full"
    >
      <div class="w-full max-w-sm">
        <Card padding="none">
          <div class="px-5 py-4">
            <h3 class="text-text-primary text-sm font-semibold">Account</h3>
            <p class="text-text-tertiary text-xs">Manage your profile and preferences</p>
          </div>
          <Separator />
          <div class="divide-border-subtle divide-y">
            <div class="flex items-center justify-between px-5 py-3">
              <div class="flex items-center gap-3">
                <Avatar size="sm" name="Jane Doe" randomColor />
                <div>
                  <p class="text-text-primary text-sm font-medium">Jane Doe</p>
                  <p class="text-text-tertiary text-xs">jane@example.com</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">Edit</Button>
            </div>
            <div class="flex items-center justify-between px-5 py-3">
              <span class="text-text-secondary text-sm">Language</span>
              <span class="text-text-tertiary text-sm">English</span>
            </div>
            <div class="flex items-center justify-between px-5 py-3">
              <span class="text-text-secondary text-sm">Timezone</span>
              <span class="text-text-tertiary text-sm">UTC+1</span>
            </div>
          </div>
          <Separator />
          <div class="px-5 py-3">
            <Button variant="ghost" intent="danger" size="sm">Delete account</Button>
          </div>
        </Card>
      </div>
    </CodeExample>

    <CodeExample
      title="Labeled divider"
      description="Separator draws only the rule, so build a labeled break yourself: two `flex-1` separators around a centered label make the 'or continue with' divider on a sign-in form."
      isolate
      previewClass="flex justify-center w-full"
    >
      <div class="flex w-full max-w-sm items-center gap-3">
        <Separator class="flex-1" />
        <span class="text-text-tertiary text-xs font-medium uppercase">or continue with</span>
        <Separator class="flex-1" />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Custom rules"
      description="A `class` swaps the fill while the rule keeps its width and thickness. The first is a gradient that fades at both ends, the second a dashed border. Both clear the default flat fill with `bg-transparent` and take their colour from the `border-strong` token. Neither is reachable through the standard props."
      isolate
      previewClass="w-full py-6"
    >
      <div class="mx-auto flex w-full max-w-sm flex-col gap-6">
        <Separator
          class="via-border-strong bg-transparent bg-linear-to-r from-transparent to-transparent"
        />
        <Separator class="border-border-strong border-t border-dashed bg-transparent" />
      </div>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      This is one of five ways to restyle a block. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>, <code class="text-text-primary">preset</code>
      and provider-level overrides.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Roles and semantics">
      <p>
        Separator renders a <code class="text-text-primary">&lt;div&gt;</code> rather than an
        <code class="text-text-primary">&lt;hr&gt;</code>, so its role is set explicitly. The
        default
        <code class="text-text-primary">decorative={'{'}true}</code> gives it
        <code class="text-text-primary">role="none"</code>, and screen readers skip it. Set
        <code class="text-text-primary">decorative={'{'}false}</code> for
        <code class="text-text-primary">role="separator"</code> with a matching
        <code class="text-text-primary">aria-orientation</code>, which announces the line as a real
        content boundary.
      </p>
    </Note>
    <Note title="When to use semantic mode">
      <p>
        Keep the default for spacing between related items. Reach for
        <code class="text-text-primary">decorative={'{'}false}</code> when the line marks a thematic shift,
        such as a boundary between two unrelated sections, where a screen reader announcing the break
        helps.
      </p>
    </Note>
  </NoteList>
</Section>
