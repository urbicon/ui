<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Section, CodeExample } from '@urbicon-ui/docs';
  import { useI18n } from '@urbicon-ui/i18n';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';

  const navigation = [
    { id: 'plurals', title: 'Pluralization', order: 1 },
    { id: 'formatters', title: 'Formatters', order: 2 },
    { id: 'demo', title: 'Live demo', order: 3 }
  ];

  // Real i18n hook — the docs app mounts a provider at its root, so these
  // formatters resolve against the active site locale and re-render on a switch.
  const i18n = useI18n();

  // Fixed inputs → deterministic output, identical on server and client (no
  // hydration mismatch); only the active locale varies.
  const sampleDate = new Date('2026-03-14T15:09:00Z');

  const demoRows = $derived([
    ['formatNumber(1234567.89)', i18n.formatNumber(1234567.89)],
    ["formatNumber(0.4267, { style: 'percent' })", i18n.formatNumber(0.4267, { style: 'percent' })],
    [
      "formatNumber(42, { style: 'currency', currency: 'EUR' })",
      i18n.formatNumber(42, { style: 'currency', currency: 'EUR' })
    ],
    ["formatDate(date, { dateStyle: 'long' })", i18n.formatDate(sampleDate, { dateStyle: 'long' })],
    ["formatRelativeTime(-3, 'day')", i18n.formatRelativeTime(-3, 'day')]
  ]);

  const pluralDataCode = `// translations — provide a \`<key>_plural\` entry as a JSON object of CLDR categories
{
  apple: '{{count}} apple',
  apple_plural: '{"one":"{{count}} apple","other":"{{count}} apples"}'
}`;

  const pluralUseCode =
    `<` +
    `script>
  import { useI18n } from '@urbicon-ui/i18n';
  const i18n = useI18n();
</` +
    `script>

<span>{i18n.plural('apple', { count: 1 })}</span> <!-- 1 apple  -->
<span>{i18n.plural('apple', { count: 3 })}</span> <!-- 3 apples -->`;

  const formatterCode =
    `<` +
    `script>
  import { useI18n } from '@urbicon-ui/i18n';
  const i18n = useI18n();
</` +
    `script>

<p>{i18n.formatNumber(1234.5)}</p>                       <!-- 1,234.5 / 1.234,5 -->
<p>{i18n.formatNumber(42, { style: 'currency', currency: 'EUR' })}</p>
<p>{i18n.formatDate(new Date(), { dateStyle: 'long' })}</p>
<p>{i18n.formatRelativeTime(-3, 'day')}</p>              <!-- 3 days ago -->
<p>{i18n.formatTimeAgo(someDate)}</p>                    <!-- relative to now -->`;
</script>

<SeoMeta
  title="Formatting & Plurals - Localization"
  description="CLDR pluralization via Intl.PluralRules and locale-aware number, date, and relative-time formatting."
/>

<DocsPageLayout
  title="Formatting & Plurals"
  description="Pluralization and number/date formatting go through the platform Intl APIs — correct for any BCP-47 locale, with no bundled CLDR data."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Localization', href: resolve('/i18n') }]}
>
  <Section id="plurals" title="Pluralization">
    <p class="text-text-secondary mb-4">
      <code>plural</code> selects the CLDR category via <code>Intl.PluralRules</code> — correct for
      any BCP-47 locale. Provide a <code>&lt;key&gt;_plural</code> entry as a JSON object of categories:
    </p>
    <CodeExample code={pluralDataCode} language="typescript" preview={false} />
    <CodeExample code={pluralUseCode} language="svelte" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      <code>en</code>/<code>de</code> collapse to <code>one</code>/<code>other</code>; Slavic
      locales add <code>few</code>/<code>many</code>; Arabic uses the full set. Without a
      <code>_plural</code> object the base string is returned as-is — fail-honest, no anglocentric
      <code>+'s'</code> guessing.
    </p>
  </Section>

  <Section id="formatters" title="Formatters">
    <p class="text-text-secondary mb-4">
      <code>formatNumber</code>, <code>formatDate</code>, and <code>formatRelativeTime</code> wrap
      the matching <code>Intl</code> API for the active locale and take the same options it does —
      so anything <code>Intl.NumberFormat</code> / <code>Intl.DateTimeFormat</code> /
      <code>Intl.RelativeTimeFormat</code> accepts works here.
    </p>
    <CodeExample code={formatterCode} language="svelte" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      <code>formatTimeAgo(date)</code> is the exception: it composes a relative string from
      registered
      <code>time.*</code> translation keys (and falls back to <code>formatDate</code> past ~30
      days), so it takes no options and needs those keys registered. The other three are pure
      <code>Intl</code> wrappers.
    </p>
  </Section>

  <Section id="demo" title="Live demo">
    <p class="text-text-secondary mb-4">
      These values are formatted by the real <code>useI18n()</code> hook against the
      <strong>active site locale</strong> (<code class="text-primary">{i18n.locale}</code>). Switch
      the language with the locale switcher in the sidebar and watch them re-render.
    </p>
    <div class="border-border-subtle bg-surface-elevated overflow-x-auto rounded-2xl border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface-subtle border-border-subtle border-b">
            <th class="text-text-primary px-4 py-2 text-left font-medium">Call</th>
            <th class="text-text-primary px-4 py-2 text-left font-medium">Output</th>
          </tr>
        </thead>
        <tbody>
          {#each demoRows as [call, output] (call)}
            <tr class="border-border-subtle border-b last:border-0">
              <td class="text-text-secondary px-4 py-2 font-mono text-xs">{call}</td>
              <td class="text-text-primary px-4 py-2 font-mono text-xs">{output}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
