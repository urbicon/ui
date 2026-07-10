<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Combobox, Badge, Avatar } from '@urbicon-ui/blocks';
  import type { ComboboxOption } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['variant', 'size', 'clearable', 'disabled', 'placeholder', 'noResultsText'],
        defaults: { variant: 'outlined', size: 'md' },
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
    meta: { title: 'Combobox Component', showToc: true }
  };

  const timezones: ComboboxOption[] = [
    { label: 'UTC−12:00 Baker Island', value: 'utc-12' },
    { label: 'UTC−08:00 Pacific Time', value: 'utc-8' },
    { label: 'UTC−05:00 Eastern Time', value: 'utc-5' },
    { label: 'UTC+00:00 London', value: 'utc+0' },
    { label: 'UTC+01:00 Berlin', value: 'utc+1' },
    { label: 'UTC+02:00 Helsinki', value: 'utc+2' },
    { label: 'UTC+05:30 Mumbai', value: 'utc+5:30' },
    { label: 'UTC+08:00 Singapore', value: 'utc+8' },
    { label: 'UTC+09:00 Tokyo', value: 'utc+9' },
    { label: 'UTC+10:00 Sydney', value: 'utc+10' }
  ];

  const teamMembers: ComboboxOption[] = [
    { label: 'Sarah Chen — Engineering Lead', value: 'sarah' },
    { label: 'Marcus Rivera — Senior Designer', value: 'marcus' },
    { label: 'Aisha Patel — Backend Developer', value: 'aisha' },
    { label: 'Tom Wilson — Product Manager', value: 'tom' },
    { label: 'Lisa Kim — QA Engineer', value: 'lisa', disabled: true },
    { label: 'James Brown — DevOps', value: 'james' }
  ];

  const languages: ComboboxOption[] = [
    { label: 'TypeScript', value: 'ts' },
    { label: 'JavaScript', value: 'js' },
    { label: 'Python', value: 'py' },
    { label: 'Rust', value: 'rs' },
    { label: 'Go', value: 'go' },
    { label: 'Svelte', value: 'svelte' },
    { label: 'C#', value: 'cs' },
    { label: 'Kotlin', value: 'kt' }
  ];

  const avatars: Record<string, string> = {
    sarah: 'https://i.pravatar.cc/32?img=1',
    marcus: 'https://i.pravatar.cc/32?img=2',
    aisha: 'https://i.pravatar.cc/32?img=3',
    tom: 'https://i.pravatar.cc/32?img=4',
    lisa: 'https://i.pravatar.cc/32?img=5',
    james: 'https://i.pravatar.cc/32?img=6'
  };

  let filterValue = $state<string | null>(null);
  let customValue = $state<string | null>(null);
  let assigneeValue = $state<string | null>(null);
  let timezoneValue = $state<string | null>(null);
  let skillsValue = $state<string[]>(['ts', 'svelte']);
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Per-option disabled"
      description="Disable individual options while the rest of the list stays selectable. Keyboard navigation skips disabled options — useful for assignee pickers where someone is on leave."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Combobox
        options={teamMembers}
        bind:value={assigneeValue}
        placeholder="Assign to…"
        clearable
      />
    </CodeExample>

    <CodeExample
      title="Multi-select with tags"
      description="Pass `multiple` to bind an array of values. Picks render as removable tag chips below the search input, the listbox stays open across selections, Backspace on an empty field removes the last tag, and `maxItems` caps the count — non-selected options grey out once the cap is reached."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Combobox
        options={languages}
        multiple
        bind:value={skillsValue}
        maxItems={5}
        placeholder="Add skills…"
        clearable
      />
    </CodeExample>

    <CodeExample
      title="Helper, error & required"
      description="Combobox follows the same form-field contract as Input and Select — label, helper, error, and required all work as expected. `error` overrides `helper` when both are set."
      isolate
      previewClass="flex flex-col gap-4 max-w-xs"
    >
      <Combobox
        label="Timezone"
        options={timezones}
        bind:value={timezoneValue}
        placeholder="Search…"
        helper="We use this to schedule meetings"
        required
        clearable
      />
      <Combobox
        label="Primary language"
        options={languages}
        error="Please select your primary language"
        placeholder="Search…"
      />
    </CodeExample>

    <CodeExample
      title="Custom filter"
      description="Replace the default case-insensitive contains-match with your own predicate — here, strict `startsWith` matching for command-style input."
      isolate
      previewClass="flex flex-col gap-4 max-w-xs"
    >
      <Combobox
        options={languages}
        bind:value={filterValue}
        placeholder="Type to match…"
        filter={(opt: ComboboxOption, q: string) =>
          opt.label.toLowerCase().startsWith(q.toLowerCase())}
      />
    </CodeExample>

    <CodeExample
      title="Custom option renderer"
      description="Use the `customOption` snippet for rich list items — avatars, badges, secondary descriptions, status indicators."
      isolate
      previewClass="flex flex-col gap-4 max-w-sm"
    >
      <Combobox options={teamMembers} bind:value={customValue} placeholder="Search team…" clearable>
        {#snippet customOption(opt: ComboboxOption, isSelected: boolean)}
          <div class="flex w-full items-center gap-3">
            <Avatar src={avatars[opt.value]} size="xs" />
            <div class="flex flex-1 items-center gap-2 truncate">
              <span class="truncate text-sm">{opt.label.split(' — ')[0]}</span>
              <Badge size="xs" variant="soft" intent={isSelected ? 'success' : 'neutral'}>
                {opt.label.split(' — ')[1]}
              </Badge>
            </div>
            {#if isSelected}
              <span class="text-primary text-xs">✓</span>
            {/if}
          </div>
        {/snippet}
      </Combobox>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Command Palette"
      description="A Spotlight-style command palette built with slotClasses on the base and input slots."
      isolate
      previewClass="flex flex-col items-center gap-4 max-w-lg w-full mx-auto"
    >
      <Combobox
        options={[
          { label: '⌘K  Open Command Palette', value: 'cmd-k' },
          { label: '⌘P  Quick Open File', value: 'cmd-p' },
          { label: '⌘⇧P  Show All Commands', value: 'cmd-shift-p' },
          { label: '⌘B  Toggle Sidebar', value: 'cmd-b' },
          { label: '⌘J  Toggle Terminal', value: 'cmd-j' },
          { label: '⌘,  Open Settings', value: 'cmd-comma' }
        ]}
        placeholder="Type a command…"
        size="lg"
        slotClasses={{
          base: 'w-full',
          input:
            'rounded-xl shadow-[var(--blocks-shadow-lg)] ring-2 ring-primary/20 focus-visible:ring-primary/50 transition-all',
          listbox: 'rounded-xl shadow-[var(--blocks-shadow-lg)]'
        }}
      />
    </CodeExample>

    <CodeExample
      title="Glassmorphism"
      description="Frosted glass input for hero sections or overlay contexts."
      isolate
      previewClass="flex flex-col items-center gap-4 max-w-md w-full mx-auto rounded-xl bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 py-10"
    >
      <Combobox
        options={timezones}
        placeholder="Select your timezone…"
        unstyled
        slotClasses={{
          base: 'relative w-full',
          input:
            'w-full rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-white placeholder-white/50 shadow-lg backdrop-blur-md transition-all focus-visible:border-white/40 focus-visible:bg-white/15 focus-visible:outline-none',
          listbox:
            'absolute z-50 mt-2 w-full rounded-xl border border-white/20 bg-white/10 p-1 shadow-xl backdrop-blur-xl max-h-60 overflow-y-auto',
          option:
            'flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-white/80 cursor-pointer transition-colors hover:bg-white/15',
          optionActive: 'bg-white/20 text-white',
          optionSelected: 'text-white font-medium',
          noResults: 'px-4 py-3 text-center text-white/50 text-sm',
          chevron:
            'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none'
        }}
      />
    </CodeExample>

    <CodeExample
      title="Terminal / Monospace"
      description="Fully unstyled rebuild with a terminal aesthetic."
      isolate
      previewClass="flex flex-col items-center gap-4 max-w-md w-full mx-auto"
    >
      <Combobox
        options={languages}
        placeholder="$ select --lang"
        unstyled
        slotClasses={{
          base: 'relative w-full font-mono',
          input:
            'w-full bg-neutral-950 text-green-400 border-2 border-green-600/50 rounded-none px-4 py-3 text-sm placeholder:text-green-600/50 focus-visible:outline-none focus-visible:border-green-400',
          listbox:
            'absolute z-50 mt-0 w-full bg-neutral-950 border-2 border-t-0 border-green-600/50 max-h-60 overflow-y-auto',
          option:
            'flex w-full items-center gap-2 px-4 py-2 text-sm text-green-300 cursor-pointer hover:bg-green-900/30',
          optionActive: 'bg-green-800/40 text-green-200',
          optionSelected: 'text-green-100 font-bold',
          noResults: 'px-4 py-3 text-center text-green-700 text-sm',
          chevron:
            'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600/50 pointer-events-none'
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
          The input uses <code class="text-text-primary">role="combobox"</code> with
          <code class="text-text-primary">aria-expanded</code>,
          <code class="text-text-primary">aria-controls</code>, and
          <code class="text-text-primary">aria-autocomplete="list"</code>. The listbox uses
          <code class="text-text-primary">role="listbox"</code>
          and each option uses
          <code class="text-text-primary">role="option"</code> with
          <code class="text-text-primary">aria-selected</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >↓</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >↑</kbd
          >
          to navigate options.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          to select.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >
          to close.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Home</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >End</kbd
          >
          to jump to first / last option. Disabled options are skipped during navigation.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Active Descendant</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Focus stays on the input at all times. The visually highlighted option is communicated via
          <code class="text-text-primary">aria-activedescendant</code>, keeping screen readers
          synchronized without moving DOM focus.
        </p>
      </div>
    </div>
  </div>
</Section>
