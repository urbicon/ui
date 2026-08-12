<!-- urbicon-ignore raw-tailwind-color — the Customization demo paints each avatar disc with
     `slotClasses.frame`: it keeps the avatar's circular shape, `size` and centering, and only the
     per-identity gradient fill and initials colour are raw — a fill the intent palette has no
     equivalent for. Every other section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Avatar, Kbd, UserIcon } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <p class="text-text-secondary text-sm leading-relaxed">
      An Avatar shows the <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">src</code>
      photo, or the initials from
      <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">name</code>
      (the first letter of each word, up to two) when there is none.
      <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">randomColor</code> gives each name
      a stable colour, and
      <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">children</code>
      replace the initials with your own content.
    </p>

    <CodeExample
      title="Identity colours"
      description="`randomColor` hashes each `name` to a fixed hue from the identity palette, so people without a photo stay distinct and one person keeps the same colour everywhere."
      isolate
      previewClass="flex flex-wrap items-center gap-3"
    >
      <Avatar name="Ada Lovelace" randomColor size="lg" />
      <Avatar name="Alan Turing" randomColor size="lg" />
      <Avatar name="Grace Hopper" randomColor size="lg" />
      <Avatar name="Katherine Johnson" randomColor size="lg" />
      <Avatar name="Barbara Liskov" randomColor size="lg" />
      <Avatar name="Edsger Dijkstra" randomColor size="lg" />
    </CodeExample>

    <CodeExample
      title="Photo, with initials as the fallback"
      description="`src` renders the photo. If it is missing or fails to load, the avatar falls back to the initials from `name` inside the same fixed box, so the layout never shifts."
      isolate
      previewClass="flex flex-wrap items-center gap-3"
    >
      <Avatar src="https://i.pravatar.cc/96?img=12" name="Marcus Chen" size="lg" />
      <Avatar src="https://i.pravatar.cc/96?img=5" name="Sarah Okoro" size="lg" />
      <Avatar src="/broken/photo.jpg" name="Priya Nair" size="lg" />
    </CodeExample>

    <CodeExample
      title="Custom content"
      description="`children` replace the initials: an icon for a system account, a count for a group, a glyph for a placeholder."
      isolate
      previewClass="flex flex-wrap items-center gap-3"
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
  </div>

  <p class="text-text-secondary mt-6 text-sm leading-relaxed">
    For overlapping stacks with an overflow count, see
    <a href={resolve('/blocks/components/avatar-group')} class="text-primary underline"
      >AvatarGroup</a
    >.
  </p>
</Section>

<!-- ─── Status ─── -->

<Section marker id="status" title="Status">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    <code class="text-text-primary">status</code> adds a presence dot in the corner set by
    <code class="text-text-primary">statusPosition</code>. Each value carries its own colour, and
    <code class="text-text-primary">pulse</code> adds a radar ring in the same hue that draws the eye
    to a presence change.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold"><code class="text-text-primary">status</code></th>
          <th class="py-2 font-semibold">Example</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">online</code></td>
          <td class="py-3 align-top"><Avatar name="Ada Lovelace" randomColor status="online" /></td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">away</code></td>
          <td class="py-3 align-top"><Avatar name="Alan Turing" randomColor status="away" /></td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">busy</code></td>
          <td class="py-3 align-top"><Avatar name="Grace Hopper" randomColor status="busy" /></td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">offline</code></td>
          <td class="py-3 align-top">
            <Avatar name="Katherine Johnson" randomColor status="offline" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Gradient identities"
      description="Paint the disc with `slotClasses.frame`: it keeps the avatar's circular shape, `size` and centering, and only the gradient fill and initials colour are raw. The intent palette carries no per-identity gradient."
      isolate
      previewClass="flex flex-wrap items-center gap-4"
    >
      <Avatar
        size="lg"
        slotClasses={{ frame: 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white' }}
      >
        FD
      </Avatar>
      <Avatar
        size="lg"
        slotClasses={{ frame: 'bg-linear-to-br from-cyan-500 to-blue-500 text-white' }}
      >
        AK
      </Avatar>
      <Avatar
        size="lg"
        slotClasses={{ frame: 'bg-linear-to-br from-amber-400 to-orange-500 text-neutral-900' }}
      >
        ST
      </Avatar>
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
    <Note title="ARIA">
      <p>
        An interactive avatar (<code class="text-text-primary">clickable</code>,
        <code class="text-text-primary">interactive</code>, or
        <code class="text-text-primary">onclick</code>) carries
        <code class="text-text-primary">role="button"</code> and an
        <code class="text-text-primary">aria-label</code> taken from
        <code class="text-text-primary">alt</code> or <code class="text-text-primary">name</code>. A
        static avatar exposes its name through the image's
        <code class="text-text-primary">alt</code>, or renders initials. The presence dot is
        announced separately, as an image labelled “Status: online”. Hide a purely decorative avatar
        with <code class="text-text-primary">aria-hidden</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Interactive avatars are focusable with
        <Kbd keys="Tab" />
        and activate on
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />. A static avatar is skipped in the tab order.
      </p>
    </Note>
    <Note title="Image fallback">
      <p>
        When the image is missing or fails to load, the avatar falls back to
        <code class="text-text-primary">children</code> if given, otherwise to the initials from
        <code class="text-text-primary">name</code>, so it is never empty.
      </p>
    </Note>
    <Note title="Motion and contrast">
      <p>
        The <code class="text-text-primary">pulse</code> ring stops animating under
        <code class="text-text-primary">prefers-reduced-motion</code>. Under
        <code class="text-text-primary">prefers-contrast: more</code> the disc gains a delineating outline.
      </p>
    </Note>
  </NoteList>
</Section>
