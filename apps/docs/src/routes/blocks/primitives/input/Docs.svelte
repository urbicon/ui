<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Input, SearchIcon, EyeIcon, EyeOffIcon, MailIcon, LockIcon } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: [
          'variant',
          'intent',
          'size',
          'label',
          'placeholder',
          'clearable',
          'disabled',
          'readonly',
          'required',
          'error'
        ],
        defaults: { variant: 'outlined', size: 'md', intent: 'default' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Input Component', showToc: true }
  };

  let searchValue = $state('Svelte components');
  let passwordValue = $state('');
  let passwordVisible = $state(false);
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Search input"
      description="Pair `clearable` with a left search icon — the most common real-world pattern. Press Escape or click the clear button to reset."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Input
        clearable
        bind:value={searchValue}
        placeholder="Search anything..."
        aria-label="Search"
      >
        {#snippet leftIcon()}
          <SearchIcon />
        {/snippet}
      </Input>
    </CodeExample>

    <CodeExample
      title="Password with visibility toggle"
      description="Combine `type='password'` with a clickable right icon — `onRightIconClick` turns the icon into an accessible button (note the required `rightIconAriaLabel`)."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Input
        type={passwordVisible ? 'text' : 'password'}
        label="Password"
        placeholder="Enter your password"
        bind:value={passwordValue}
        onRightIconClick={() => (passwordVisible = !passwordVisible)}
        rightIconAriaLabel={passwordVisible ? 'Hide password' : 'Show password'}
      >
        {#snippet leftIcon()}
          <LockIcon />
        {/snippet}
        {#snippet rightIcon()}
          {#if passwordVisible}
            <EyeOffIcon />
          {:else}
            <EyeIcon />
          {/if}
        {/snippet}
      </Input>
    </CodeExample>

    <CodeExample
      title="Email field with validation error"
      description="`error` overrides `helper` and forces danger styling regardless of `intent`. Combined with a left icon for visual context."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Input
        type="email"
        label="Email"
        placeholder="name@example.com"
        value="not-an-email"
        error="Please enter a valid email address"
        required
      >
        {#snippet leftIcon()}
          <MailIcon />
        {/snippet}
      </Input>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Branded Search Bar"
      description="The container acts as the visual boundary with ring and shadow. The input's own border is suppressed via slotClasses."
      isolate
      previewClass="flex flex-col items-center gap-4 max-w-lg w-full mx-auto"
    >
      <Input
        size="xl"
        placeholder="Search components, patterns, tokens..."
        clearable
        slotClasses={{
          container:
            'rounded-2xl bg-surface-base shadow-[var(--blocks-shadow-lg)] ring-2 ring-primary/20 focus-within:ring-primary/50 transition-all overflow-hidden',
          base: 'border-0 bg-transparent rounded-2xl focus-visible:ring-0'
        }}
      />
    </CodeExample>

    <CodeExample
      title="Glassmorphism Input"
      description="Frosted glass input for overlay or hero contexts."
      isolate
      previewClass="flex flex-col items-center gap-4 max-w-md w-full mx-auto rounded-xl bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 py-10"
    >
      <Input
        unstyled
        placeholder="Enter your email"
        slotClasses={{
          base: 'w-full rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-white placeholder-white/50 shadow-lg backdrop-blur-md transition-all focus-visible:border-white/40 focus-visible:bg-white/15 focus-visible:outline-none'
        }}
      />
    </CodeExample>

    <CodeExample
      title="Underline Form"
      description="The underline variant pairs well with compact forms."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Input variant="underline" label="Full Name" placeholder="Jane Doe" />
      <Input variant="underline" label="Email" placeholder="jane@acme.com" />
      <Input variant="underline" label="Phone" placeholder="+49 123 456 789" helper="Optional" />
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Drop all defaults for complete control."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Input
        unstyled
        label="Brutalist Input"
        placeholder="Type something..."
        class="text-text-primary placeholder:text-text-tertiary w-full border-2 border-current bg-transparent px-4 py-3 font-mono text-sm focus-visible:outline-none"
        slotClasses={{
          label: 'font-mono text-xs uppercase tracking-widest text-text-secondary mb-1'
        }}
      />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Labels are automatically associated via <code class="text-text-primary">for</code> and
          <code class="text-text-primary">id</code>. Error and helper messages are linked through
          <code class="text-text-primary">aria-describedby</code>. Validation states set
          <code class="text-text-primary">aria-invalid</code> automatically.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          to focus. Native text input behavior for all key combinations. Clearable inputs respond to
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >
          to clear the value. Focus indication uses
          <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Color Contrast</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Error, warning, and success states use both color and text to convey status – never color
          alone. Helper and error messages meet WCAG AA contrast ratios against all surface tokens.
        </p>
      </div>
    </div>
  </div>
</Section>
