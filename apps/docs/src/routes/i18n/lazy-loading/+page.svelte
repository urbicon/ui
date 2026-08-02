<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Section, CodeExample } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';

  const navigation = [
    { id: 'when', title: 'When to use it' },
    { id: 'loaders', title: 'Registering loaders' },
    { id: 'lifecycle', title: 'Load lifecycle' },
    { id: 'tradeoffs', title: 'Trade-offs' }
  ];

  const loadersCode = `export const blocksI18n = createPackageI18n(
  'blocks',
  { en }, // eager base — stays in the initial bundle, is the fallback
  {
    loaders: {
      de: () => import('../translations/de').then((m) => m.default),
      fr: () => import('../translations/fr').then((m) => m.default)
    }
  }
);`;

  const loadingCode =
    `<` +
    `script>
  import { useI18n } from '@urbicon-ui/i18n';
  const i18n = useI18n();
</` +
    `script>

{#if i18n.isLoading}
  <Spinner aria-label="Loading translations…" />
{/if}`;
</script>

<SeoMeta
  title="Lazy Loading - Localization"
  description="Opt-in locale code-splitting: keep non-base languages out of the initial bundle as dynamic-import chunks."
/>

<DocsPageLayout
  title="Lazy Loading"
  description="By default a package registers all its locale bundles eagerly. Opt into code-splitting to keep non-base languages out of the initial bundle until they're activated."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Localization', href: resolve('/i18n') }]}
>
  <Section id="when" title="When to use it">
    <p class="text-text-secondary mb-4">
      Eager registration ships every locale's strings in the initial bundle. That's simplest and
      right for a handful of languages (<code>en</code>/<code>de</code>). Past that, the inactive
      locales are dead weight on first paint — register them as dynamic-import loaders so only the
      active language is in the initial bundle, and the rest load on activation.
    </p>
  </Section>

  <Section id="loaders" title="Registering loaders">
    <p class="text-text-secondary mb-4">
      Pass <code>options.loaders</code> to <code>createPackageI18n</code>. The bundle in
      <code>translations</code> (typically <code>en</code>) stays eager as the base/fallback; each
      listed locale becomes a dynamic import that Vite/Rollup splits into its own chunk.
    </p>
    <CodeExample code={loadersCode} language="typescript" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      Compile-time key parity is <strong>not</strong> checked for lazy locales — the chunk isn't
      visible to the type-checker. Guard parity at runtime with
      <a class="text-primary hover:underline" href={resolve('/i18n/package-integration')}
        ><code>validatePackageTranslations</code></a
      > in a test.
    </p>
  </Section>

  <Section id="lifecycle" title="Load lifecycle">
    <p class="text-text-secondary mb-4">The provider drives loading automatically:</p>
    <ul class="text-text-secondary mb-4 space-y-2 text-sm">
      <li>
        <strong class="text-text-primary">On mount</strong> it loads the active locale and the
        fallback. (Effects don't run during SSR, so a lazy non-base initial locale renders the
        <em>fallback</em> on the server and the first client paint, then re-resolves reactively once its
        chunk lands.)
      </li>
      <li>
        <strong class="text-text-primary">For SSR</strong>, register the bundle eagerly once at
        server start so the first server render already resolves that locale instead of flashing the
        fallback: <code>packageI18n.registerLocale(locale, bundle)</code> (blocks re-exports it as
        <code>registerBlocksLocale</code>) with the per-locale subpath import (<code
          >@urbicon-ui/blocks/i18n/de</code
        >). Additive — it keeps the eager base — and safe on the module-global registry (static,
        request-identical data).
      </li>
      <li>
        <strong class="text-text-primary">On switch</strong>, <code>setLocale</code> triggers the
        target's loader (not awaited) and flips the locale; the <code>$derived</code> reads re-resolve
        when the chunk arrives.
      </li>
      <li>
        <strong class="text-text-primary">If a load fails</strong> and no data exists for that
        locale,
        <code>load-failed-no-fallback</code> is reported to the
        <a class="text-primary hover:underline" href={resolve('/i18n/provider')}>error sink</a> — the
        loud signal that "the language you switched to can't be rendered."
      </li>
    </ul>
    <p class="text-text-secondary mb-2">
      <code>useI18n().isLoading</code> is <code>true</code> while a lazy load is in flight — wire it to
      a spinner if a switch is perceptible:
    </p>
    <CodeExample code={loadingCode} language="svelte" preview={false} />
  </Section>

  <Section id="tradeoffs" title="Trade-offs">
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-5">
        <h4 class="text-text-primary mb-2 text-sm font-semibold">Eager (default)</h4>
        <ul class="text-text-secondary space-y-1 text-sm">
          <li>Simplest — no extra config.</li>
          <li>Compile-time key parity across all locales.</li>
          <li>No loading state, no flash of fallback.</li>
          <li>Best for a few locales (<code>en</code>/<code>de</code>).</li>
        </ul>
      </div>
      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-5">
        <h4 class="text-text-primary mb-2 text-sm font-semibold">Lazy (opt-in)</h4>
        <ul class="text-text-secondary space-y-1 text-sm">
          <li>Smaller initial bundle — inactive locales excluded.</li>
          <li>Parity is a runtime/CI check, not compile-time.</li>
          <li>
            A lazy non-base initial locale flashes the fallback first (unless eager-registered for
            SSR).
          </li>
          <li>Worth it past a handful of locales.</li>
        </ul>
      </div>
    </div>
  </Section>
</DocsPageLayout>
