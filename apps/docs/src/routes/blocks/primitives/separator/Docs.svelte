<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Separator, Button, Avatar, Card } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Inline Vertical Separator"
      description="Vertical separators as dividers between navigation items — a classic breadcrumb pattern."
      isolate
    >
      <nav class="flex items-center text-sm">
        <a href="#!" class="text-text-tertiary hover:text-text-primary transition-colors">Home</a>
        <Separator orientation="vertical" size="sm" class="mx-3 h-4" />
        <a href="#!" class="text-text-tertiary hover:text-text-primary transition-colors"
          >Products</a
        >
        <Separator orientation="vertical" size="sm" class="mx-3 h-4" />
        <a href="#!" class="text-text-tertiary hover:text-text-primary transition-colors"
          >Electronics</a
        >
        <Separator orientation="vertical" size="sm" class="mx-3 h-4" />
        <span class="text-text-primary font-medium">Headphones</span>
      </nav>
    </CodeExample>

    <CodeExample
      title="Settings Card"
      description="Separators structuring a realistic settings panel — as a section divider and between in-list rows."
      isolate
      previewClass="flex justify-center w-full"
    >
      <div class="w-full max-w-sm">
        <Card padding="none">
          <div class="px-5 py-4">
            <h3 class="text-text-primary text-sm font-semibold">Account</h3>
            <p class="text-text-tertiary text-xs">Manage your profile and preferences</p>
          </div>
          <Separator size="sm" />
          <div class="divide-border-subtle space-y-0 divide-y">
            <div class="flex items-center justify-between px-5 py-3">
              <div class="flex items-center gap-3">
                <Avatar size="sm" name="JD" />
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
          <Separator size="sm" />
          <div class="px-5 py-3">
            <Button variant="ghost" intent="danger" size="sm">Delete Account</Button>
          </div>
        </Card>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Separator with Label"
      description="A common pattern: text centered over a horizontal rule — typical for 'OR continue with' auth flows."
      isolate
      previewClass="flex flex-col gap-6"
    >
      <div class="relative flex items-center">
        <Separator class="flex-1" />
        <span class="text-text-tertiary bg-surface-base px-3 text-xs font-medium uppercase"
          >or continue with</span
        >
        <Separator class="flex-1" />
      </div>
      <div class="relative flex items-center">
        <Separator
          class="!my-0 flex-1"
          slotClasses={{ base: 'bg-linear-to-r from-transparent to-border-subtle' }}
        />
        <span class="text-text-secondary bg-surface-base px-4 text-sm font-semibold tracking-wide"
          >Chapter 2</span
        >
        <Separator
          class="!my-0 flex-1"
          slotClasses={{ base: 'bg-linear-to-l from-transparent to-border-subtle' }}
        />
      </div>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      Separator supports the standard <code class="text-text-primary">unstyled</code> /
      <code class="text-text-primary">slotClasses</code>
      /
      <code class="text-text-primary">preset</code> trio despite its single
      <code class="text-text-primary">base</code>
      slot — a recurring rule treatment like the gradient fade can live in
      <code class="text-text-primary">presets.Separator</code>
      on <code class="text-text-primary">BlocksProvider</code>. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA Roles">
      <p>
        By default, <code class="text-text-primary">decorative={'{'}true}</code> renders
        <code class="text-text-primary">role="none"</code> so screen readers skip the element
        entirely. Set <code class="text-text-primary">decorative={'{'}false}</code> to use
        <code class="text-text-primary">role="separator"</code> with
        <code class="text-text-primary">aria-orientation</code>, announcing it as a meaningful
        content boundary.
      </p>
    </Note>
    <Note title="When to use semantic mode">
      <p>
        Use <code class="text-text-primary">decorative={'{'}false}</code> when the separator marks a thematic
        shift — e.g. between unrelated content sections. Keep the default for purely visual spacing between
        related items.
      </p>
    </Note>
    <Note title="HTML Semantics">
      <p>
        Renders as a <code class="text-text-primary">&lt;div&gt;</code> rather than
        <code class="text-text-primary">&lt;hr&gt;</code> for full ARIA control. The
        <code class="text-text-primary">role</code> and
        <code class="text-text-primary">aria-orientation</code> attributes are set automatically
        based on the <code class="text-text-primary">decorative</code> and
        <code class="text-text-primary">orientation</code> props.
      </p>
    </Note>
  </NoteList>
</Section>
