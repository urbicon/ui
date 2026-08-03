<!-- urbicon-ignore raw-tailwind-color — the 15 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Avatar, Badge, Combobox, Kbd } from '@urbicon-ui/blocks';
  import type { ComboboxOption } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

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

  // ── Async search (queryFn) demo ─────────────────────────────────────────
  // Deterministic in-memory mock backend: a fixed city list, a constant
  // artificial latency, and a request counter. No network, no Math.random —
  // the same demo-fetcher pattern as the Table server-mode demo
  // (/table/remote-data) and the e2e remote fixture.
  const cities: ComboboxOption[] = [
    'Amsterdam',
    'Athens',
    'Barcelona',
    'Berlin',
    'Bern',
    'Bratislava',
    'Brussels',
    'Bucharest',
    'Budapest',
    'Copenhagen',
    'Dublin',
    'Hamburg',
    'Helsinki',
    'Lisbon',
    'Ljubljana',
    'London',
    'Madrid',
    'Munich',
    'Oslo',
    'Paris',
    'Prague',
    'Reykjavik',
    'Rome',
    'Stockholm',
    'Vienna',
    'Warsaw',
    'Zagreb',
    'Zurich'
  ].map((name) => ({ label: name, value: name.toLowerCase() }));

  const CITY_LATENCY_MS = 450;
  let cityValue = $state<string | null>(null);
  let cityRequests = $state(0);
  let cityError = $state<string | undefined>(undefined);

  // Reject on abort so a superseded request never resolves — the same shape a
  // real `fetch(url, { signal })` produces. The Combobox swallows these
  // AbortError rejections; only genuine failures reach `onError`.
  function delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    });
  }

  async function searchCities(query: string, signal: AbortSignal): Promise<ComboboxOption[]> {
    cityRequests += 1;
    await delay(CITY_LATENCY_MS, signal);
    const q = query.trim().toLowerCase();
    if (q === 'error') throw new Error('Simulated 500 from the mock API');
    cityError = undefined;
    const matches = q ? cities.filter((c) => c.label.toLowerCase().includes(q)) : cities;
    return matches.slice(0, 8);
  }

  const asyncScriptOpen = '<' + 'script lang="ts">';
  const asyncScriptClose = '</' + 'script>';
  const asyncSearchCode = `${asyncScriptOpen}
  import { Combobox, type ComboboxOption } from '@urbicon-ui/blocks';

  let city = $state<string | null>(null);
  let searchError = $state<string | undefined>(undefined);

  // Forward the signal to fetch: when a newer query supersedes this request,
  // the Combobox aborts it and the browser cancels the HTTP request. Aborted
  // rejections are swallowed — only real failures reach onError.
  async function searchCities(query: string, signal: AbortSignal): Promise<ComboboxOption[]> {
    searchError = undefined;
    const res = await fetch(\`/api/cities?q=\${encodeURIComponent(query)}\`, { signal });
    if (!res.ok) throw new Error(\`Search failed with \${res.status}\`);
    const results = await res.json();
    return results.map((c) => ({ label: c.name, value: c.id }));
  }
${asyncScriptClose}

<Combobox
  label="City"
  queryFn={searchCities}
  debounceMs={300}
  loadingText="Searching cities…"
  bind:value={city}
  error={searchError}
  onError={() => (searchError = 'Search failed — previous results are kept')}
  clearable
/>`;
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
        label="Assignee"
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
        label="Skills"
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
        label="Language"
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
      <Combobox
        label="Team member"
        options={teamMembers}
        bind:value={customValue}
        placeholder="Search team…"
        clearable
      >
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

<!-- ─── Async Search ─── -->

<Section marker="02" id="async-search" title="Async Search">
  <div class="space-y-8">
    <p class="text-text-secondary text-sm leading-relaxed">
      Pass <code class="text-text-primary">queryFn</code> and the Combobox stops filtering
      client-side: on each query change it calls your async function — debounced by
      <code class="text-text-primary">debounceMs</code> (default 250&thinsp;ms) — and replaces the
      option list with the resolved result.
      <code class="text-text-primary">options</code>, <code class="text-text-primary">groups</code>,
      and <code class="text-text-primary">filter</code> are ignored in this mode — the server does
      the filtering. Requests run only while the listbox is open, and each request receives an
      <code class="text-text-primary">AbortSignal</code> that is aborted the moment a newer query
      supersedes it, so a slow stale response never clobbers a fresh one. While a request is in
      flight the listbox shows <code class="text-text-primary">loadingText</code>; zero matches
      render <code class="text-text-primary">noResultsText</code>. A rejection ends the loading
      state, keeps the previous options in place, and is reported via
      <code class="text-text-primary">onError</code>.
    </p>

    <CodeExample
      title="Server-side search"
      description="The live demo runs against a deterministic in-memory mock backend with 450 ms of artificial latency (no real network requests) — the code shows the real fetch-based consumer pattern. Type “ber” and watch the loading row, try a query with no match for the empty state, or type “error” to trigger a simulated server failure surfaced via `onError`."
      code={asyncSearchCode}
    >
      <div class="flex max-w-sm flex-col gap-3">
        <Combobox
          label="City"
          queryFn={searchCities}
          debounceMs={300}
          loadingText="Searching cities…"
          noResultsText="No matching cities"
          placeholder="Type to search…"
          helper="Try “ber”, a nonsense query, or “error” for a simulated failure"
          error={cityError}
          onError={() => (cityError = 'Search failed — previous results are kept')}
          bind:value={cityValue}
          clearable
        />
        <p class="text-text-tertiary text-xs">
          Requests sent: {cityRequests} · Mock latency: {CITY_LATENCY_MS}&thinsp;ms · Debounce:
          300&thinsp;ms
        </p>
      </div>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      For values that are pre-selected before any search has run — an edit form binding
      <code class="text-text-primary">value</code> on mount — pass
      <code class="text-text-primary">seedOptions</code> so the selection renders its label instead
      of the raw value. The same mock-backend pattern drives the Table's server mode; see
      <a href={resolve('/table/remote-data')} class="text-primary hover:underline">Remote Data</a>.
    </p>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
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
        aria-label="Command palette"
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
        aria-label="Timezone"
        options={timezones}
        placeholder="Select your timezone…"
        unstyled
        slotClasses={{
          base: 'relative w-full',
          input:
            'w-full rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-white placeholder-white/50 shadow-lg backdrop-blur-md transition-all focus-visible:border-white/40 focus-visible:bg-white/15 focus-visible:outline-none',
          listbox:
            'absolute z-[var(--z-dropdown)] mt-2 w-full rounded-xl border border-white/20 bg-white/10 p-1 shadow-xl backdrop-blur-xl max-h-60 overflow-y-auto',
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
        aria-label="Language"
        options={languages}
        placeholder="$ select --lang"
        unstyled
        slotClasses={{
          base: 'relative w-full font-mono',
          input:
            'w-full bg-neutral-950 text-green-400 border-2 border-green-600/50 rounded-none px-4 py-3 text-sm placeholder:text-green-600/50 focus-visible:outline-none focus-visible:border-green-400',
          listbox:
            'absolute z-[var(--z-dropdown)] mt-0 w-full bg-neutral-950 border-2 border-t-0 border-green-600/50 max-h-60 overflow-y-auto',
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

    <p class="text-text-secondary text-sm leading-relaxed">
      A search-field skin used in more than one place — command palette, hero search — is better
      registered as a <code class="text-text-primary">BlocksProvider</code> preset (<code
        class="text-text-primary">presets.Combobox</code
      >) than repeated <code class="text-text-primary">slotClasses</code>. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        The input uses <code class="text-text-primary">role="combobox"</code> with
        <code class="text-text-primary">aria-expanded</code>,
        <code class="text-text-primary">aria-controls</code>, and
        <code class="text-text-primary">aria-autocomplete="list"</code>. The listbox uses
        <code class="text-text-primary">role="listbox"</code>
        and each option uses
        <code class="text-text-primary">role="option"</code> with
        <code class="text-text-primary">aria-selected</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="↓" />
        /
        <Kbd keys="↑" />
        to navigate options.
        <Kbd keys="Enter" />
        to select.
        <Kbd keys="Escape" />
        to close.
        <Kbd keys="Home" />
        /
        <Kbd keys="End" />
        to jump to first / last option. Disabled options are skipped during navigation.
      </p>
    </Note>
    <Note title="Active Descendant">
      <p>
        Focus stays on the input at all times. The visually highlighted option is communicated via
        <code class="text-text-primary">aria-activedescendant</code>, keeping screen readers
        synchronized without moving DOM focus.
      </p>
    </Note>
  </NoteList>
</Section>
