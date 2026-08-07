<!-- urbicon-ignore raw-tailwind-color — the 6 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Avatar, Kbd, UserIcon } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Team Row"
      description="Overlapping avatars with a children-based overflow counter — the standard way to show a member list in a row that has no room for one."
      isolate
      previewClass="flex items-center"
    >
      <div class="flex -space-x-3">
        <Avatar name="Anna" size="lg" randomColor ring ringIntent="neutral" />
        <Avatar name="Ben" size="lg" randomColor ring ringIntent="neutral" />
        <Avatar name="Cleo" size="lg" randomColor ring ringIntent="neutral" />
        <Avatar name="Dan" size="lg" randomColor ring ringIntent="neutral" />
        <Avatar
          unstyled
          class="bg-surface-elevated text-text-secondary ring-surface-base flex h-12 w-12 items-center justify-center rounded-full text-xs font-semibold ring-2"
        >
          +5
        </Avatar>
      </div>
    </CodeExample>

    <CodeExample
      title="Custom Children"
      description="Use children to render arbitrary content instead of auto-generated initials — an icon for a system account, a count for a group, a glyph for a placeholder."
      isolate
    >
      <Avatar size="xl" intent="primary">
        <UserIcon size={24} />
      </Avatar>
      <Avatar size="xl" intent="success">
        <span class="text-lg">42</span>
      </Avatar>
      <Avatar size="xl" intent="warning" variant="rounded">
        <span class="text-base">!</span>
      </Avatar>
    </CodeExample>

    <CodeExample
      title="Mint micro-interactions"
      description="Mints only apply when the avatar is interactive (clickable, interactive, or onclick). Recommended: scale and glow — they read as 'this profile is tappable' without being playful. Avoid bounce, rotate, and wiggle on profile pictures — they undermine the calm a face conveys."
      isolate
    >
      <Avatar name="Scale" clickable mint="scale" size="lg" />
      <Avatar name="Glow" clickable mint="glow" intent="primary" size="lg" />
      <Avatar name="Static" clickable size="lg" />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Gradient Avatar"
      description="Use unstyled with children for fully custom styling."
      isolate
    >
      <Avatar
        unstyled
        class="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-lg shadow-violet-500/25"
      >
        FD
      </Avatar>
      <Avatar
        unstyled
        class="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-cyan-500 to-blue-500 text-lg font-bold text-white shadow-lg shadow-cyan-500/25"
      >
        AK
      </Avatar>
      <Avatar
        unstyled
        class="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 text-lg font-bold text-neutral-900 shadow-lg shadow-amber-500/25"
      >
        ST
      </Avatar>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      Beyond <code class="text-text-primary">unstyled</code> +
      <code class="text-text-primary">class</code>, Avatar exposes
      <code class="text-text-primary">base</code>,
      <code class="text-text-primary">frame</code>, <code class="text-text-primary">image</code>,
      <code class="text-text-primary">fallback</code>, and
      <code class="text-text-primary">status</code>
      through
      <code class="text-text-primary">slotClasses</code>. A recurring identity treatment — like the
      gradient tiles above — is best registered as a
      <code class="text-text-primary">BlocksProvider</code>
      preset (<code class="text-text-primary">presets.Avatar</code>) and applied via
      <code class="text-text-primary">preset</code>; see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA">
      <p>
        The <code class="text-text-primary">aria-label</code> is derived from
        <code class="text-text-primary">alt</code> or
        <code class="text-text-primary">name</code>. Interactive avatars receive
        <code class="text-text-primary">role="button"</code>. Purely decorative avatars can be
        hidden via <code class="text-text-primary">aria-hidden</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Interactive avatars are focusable via
        <Kbd keys="Tab" />
        and activate with
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />. Non-interactive avatars are skipped in the tab order.
      </p>
    </Note>
    <Note title="Image Fallback">
      <p>
        When the image fails to load, the component falls back to
        <code class="text-text-primary">children</code> (if provided) or initials generated from
        <code class="text-text-primary">name</code>, ensuring content is always visible.
      </p>
    </Note>
  </NoteList>
</Section>
