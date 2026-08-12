<!-- urbicon-ignore raw-tailwind-color — the Customization demo tints the Combobox's input and
     listbox surfaces with `slotClasses`: it keeps the field's radius tier, spacing and keyboard
     behaviour, and only the fill, border and blur are raw — a frosted-glass look the token palette
     has no equivalent for. Every other section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Avatar, Badge, CheckIcon, Combobox, Kbd } from '@urbicon-ui/blocks';
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
  let timezoneValue = $state<string | null>(null);
  let skillsValue = $state<string[]>(['ts', 'svelte']);

  // ── Async search (queryFn) demo ─────────────────────────────────────────
  // Deterministic in-memory mock backend: a fixed city list, a constant
  // artificial latency, and a request counter. No network, no Math.random —
  // the same demo-fetcher pattern as the Table query-function demo
  // (/table/query) and the e2e remote fixture.
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
  // rejections are swallowed; only real failures reach onError.
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
  onError={() => (searchError = 'Search failed. Previous results are kept.')}
  clearable
/>`;
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Each option is an object with a <code class="text-text-primary">label</code> and a
    <code class="text-text-primary">value</code>, and <code class="text-text-primary">options</code>
    is an array of them. Bind a single selection with
    <code class="text-text-primary">bind:value</code> (the picked value, or
    <code class="text-text-primary">null</code> when empty), or pass
    <code class="text-text-primary">multiple</code> to bind an array rendered as removable tags. Reach
    for Combobox over Select when the list is long enough to search or its values load from a server.
    Select suits a short, fixed set.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Multi-select with tags"
      description="Pass `multiple` to bind an array of values. Picks render as removable tag chips and the listbox stays open across selections. `maxItems` caps the count, and Backspace on an empty field removes the last tag."
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
      description="Combobox follows the same form-field contract as Input and Select. `error` overrides `helper` when both are set."
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
      description="Replace the default case-insensitive contains-match with your own predicate. Here, strict `startsWith` matching suits command-style input."
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
      description="Use the `customOption` snippet for rich list items: an avatar, the name, and a role badge on each row."
      isolate
      previewClass="flex flex-col gap-4 w-full max-w-md mx-auto"
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
            <span class="flex-1 truncate text-sm">{opt.label.split(' — ')[0]}</span>
            <Badge
              size="xs"
              variant="soft"
              intent={isSelected ? 'success' : 'neutral'}
              class="shrink-0"
            >
              {opt.label.split(' — ')[1]}
            </Badge>
            {#if isSelected}
              <CheckIcon size={14} class="text-primary shrink-0" />
            {/if}
          </div>
        {/snippet}
      </Combobox>
    </CodeExample>
  </div>
</Section>

<!-- ─── Async Search ─── -->

<Section marker id="async-search" title="Async Search">
  <div class="space-y-8">
    <p class="text-text-secondary text-sm leading-relaxed">
      Pass <code class="text-text-primary">queryFn</code> and the Combobox stops filtering
      client-side. On each query change it calls your async function, debounced by
      <code class="text-text-primary">debounceMs</code> (250&thinsp;ms by default), and replaces the
      option list with the resolved result. In this mode
      <code class="text-text-primary">options</code>,
      <code class="text-text-primary">groups</code> and
      <code class="text-text-primary">filter</code>
      are ignored, since the server does the filtering. Each request receives an
      <code class="text-text-primary">AbortSignal</code> that fires the moment a newer query
      supersedes it, so a slow stale response never overwrites a fresh one. The listbox shows
      <code class="text-text-primary">loadingText</code> while a request is in flight and
      <code class="text-text-primary">noResultsText</code> on zero matches. A rejection ends the
      loading state, keeps the previous options in place, and is reported via
      <code class="text-text-primary">onError</code>.
    </p>

    <CodeExample
      title="Server-side search"
      description="The live demo runs against a deterministic in-memory mock backend with 450 ms of artificial latency and no real network requests. The code shows the real fetch-based consumer pattern."
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
          onError={() => (cityError = 'Search failed. Previous results are kept.')}
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
      For values pre-selected before any search has run (an edit form binding
      <code class="text-text-primary">value</code> on mount), pass
      <code class="text-text-primary">seedOptions</code> so the selection renders its label instead
      of the raw value. The same mock-backend pattern drives the Table's query demo. See
      <a href={resolve('/table/query')} class="text-primary hover:underline">Query Function</a>.
    </p>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Frosted glass"
      description="`slotClasses` tints the input and listbox into a glass look. It keeps the field's radius tier, spacing and keyboard behaviour. Only the fill, border and blur change, in raw colours because glass has no token equivalent."
      isolate
      previewClass="mx-auto flex w-full max-w-md flex-col rounded-xl bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 pt-10 pb-60"
    >
      <Combobox
        aria-label="Timezone"
        options={timezones}
        placeholder="Select your timezone…"
        slotClasses={{
          input:
            'border-white/20 bg-white/10 text-white placeholder:text-white/60 backdrop-blur-md hover:border-white/30 focus-visible:border-white/40 focus-visible:bg-white/15',
          listbox: 'border-white/20 bg-white/10 text-white backdrop-blur-xl',
          option: 'text-white/80',
          optionActive: 'bg-white/20 text-white',
          optionSelected: 'bg-white/15 text-white',
          optionCheck: 'text-white',
          noResults: 'text-white/60',
          chevronButton: 'text-white/60 hover:text-white'
        }}
      />
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
