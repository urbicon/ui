<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Avatar } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
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

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Team Row"
      description="Overlapping avatars with a children-based overflow counter."
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
      description="Use children to render arbitrary content instead of auto-generated initials."
      isolate
    >
      <Avatar size="xl" intent="primary">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </Avatar>
      <Avatar size="xl" intent="success">
        <span class="text-lg">42</span>
      </Avatar>
      <Avatar size="xl" intent="warning" variant="rounded">
        <span class="text-base">!</span>
      </Avatar>
    </CodeExample>

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

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The <code class="text-text-primary">aria-label</code> is derived from
          <code class="text-text-primary">alt</code> or
          <code class="text-text-primary">name</code>. Interactive avatars receive
          <code class="text-text-primary">role="button"</code>. Purely decorative avatars can be
          hidden via <code class="text-text-primary">aria-hidden</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Interactive avatars are focusable via
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          and activate with
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >. Non-interactive avatars are skipped in the tab order.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Image Fallback</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          When the image fails to load, the component falls back to
          <code class="text-text-primary">children</code> (if provided) or initials generated from
          <code class="text-text-primary">name</code>, ensuring content is always visible.
        </p>
      </div>
    </div>
  </div>
</Section>
