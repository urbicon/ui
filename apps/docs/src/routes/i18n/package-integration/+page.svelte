<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Section, CodeExample } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';

  const navigation = [
    { id: 'why', title: 'Why namespaces', order: 1 },
    { id: 'create', title: 'createPackageI18n', order: 2 },
    { id: 'hook', title: 'The hook pattern', order: 3 },
    { id: 'resolution', title: 'Resolution order', order: 4 },
    { id: 't-component', title: 'The <T> component', order: 5 },
    { id: 'own-package', title: 'Your own package', order: 6 },
    { id: 'validate', title: 'Parity validation', order: 7 }
  ];

  const returnMembers = [
    [
      'useTranslate',
      '() => TypedTranslationFunction<T>',
      'Context-scoped hook. Call during component init; reads the provider locale reactively. Re-exported as use<Package>I18n.'
    ],
    [
      't',
      '(key, params?) => string',
      'Non-hook resolver against the base locale. For module scope / outside a component tree.'
    ],
    ['exists', '(key) => boolean', "Whether the key exists in the package's base-locale bundle."],
    ['getLocales', '() => Locale[]', 'Locales this package has registered (data or loader).'],
    [
      'registerLocale',
      '(locale, bundle) => void',
      'Eagerly + additively register a lazy locale bundle (SSR escape hatch). Call once at server start; throws on an unsupported locale or non-object bundle.'
    ],
    [
      'types',
      'CreatePackageTypes<T>',
      'Phantom carrier for the inferred key/param types (compile-time only).'
    ]
  ];

  const createCode = `// Inside @urbicon-ui/blocks — src/lib/i18n/index.ts
import { createPackageI18n } from '@urbicon-ui/i18n';
import en from '../translations/en';

// Generic over the \`en\` bundle: keys + params flow through to the hook's \`t\`.
// en is the eager base; de is a lazy dynamic-import loader, so English-only
// apps never bundle the de catalog (before it loads, de resolves to en).
export const blocksI18n = createPackageI18n('blocks', { en }, {
  loaders: { de: () => import('../translations/de').then((m) => m.default) }
});

// Re-export the context-scoped hook under a package-specific name.
export const useBlocksI18n = blocksI18n.useTranslate;

// Eager-register de once at server start so a German SSR app renders German on
// the first paint instead of the en fallback (see the SSR note).
export const registerBlocksLocale = (locale, bundle) =>
  blocksI18n.registerLocale(locale, bundle);`;

  const hookCode =
    `<!-- In a blocks component -->
<` +
    `script>
  import { useBlocksI18n } from '$lib';
  const bt = useBlocksI18n(); // call during component init; alias to keep call sites short
</` +
    `script>

<button aria-label={bt('dialog.close')}>×</button>`;

  const tComponentCode =
    `<` +
    `script>
  import { T } from '@urbicon-ui/i18n';
</` +
    `script>

<!-- Declarative translation; re-renders on locale change. -->
<T key="greeting" params={{ name: 'Ada' }} />
<T key="data.loading" package="table" fallback="Loading…" />`;

  const ownPackageCode = `// my-app/src/lib/i18n.ts
import { createPackageI18n } from '@urbicon-ui/i18n';

const en = {
  cart: { empty: 'Your cart is empty', items: '{{count}} items' }
} as const;
const de = {
  cart: { empty: 'Dein Warenkorb ist leer', items: '{{count}} Artikel' }
} as const;

export const shopI18n = createPackageI18n('shop', { en, de });
export const useShopI18n = shopI18n.useTranslate;`;

  const validateCode = `// my-app/src/lib/i18n.test.ts
import { validatePackageTranslations } from '@urbicon-ui/i18n';
import en from '$lib/translations/en';
import de from '$lib/translations/de'; // import lazy bundles directly for the check

it('en/de key parity', () => {
  const { errors } = validatePackageTranslations('blocks', { en, de });
  expect(errors).toEqual([]); // a missing nested key is an error, an extra one a warning
});`;
</script>

<SeoMeta
  title="Package Integration - Localization"
  description="createPackageI18n, namespaced keys, the use<Package>I18n hook pattern, the <T> component, and registering your own package."
/>

<DocsPageLayout
  title="Package Integration"
  description="Each package registers its own namespaced keys into one shared registry, then exposes a typed hook. Your app can do the same."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Localization', href: resolve('/i18n') }]}
>
  <Section id="why" title="Why namespaces">
    <p class="text-text-secondary mb-4">
      Blocks, table, and auth each ship their own translation keys. Registering them under a
      namespace (<code>blocks.*</code>, <code>table.*</code>, <code>auth.*</code>) into
      <strong>one</strong>
      shared registry gives consumers a single merged translation surface with no key collisions — and
      lets your own app keys live alongside the library's.
    </p>
  </Section>

  <Section id="create" title="createPackageI18n">
    <p class="text-text-secondary mb-4">
      The factory registers the bundles at module init and returns a small typed object. Its
      signature is <code>createPackageI18n(name, {'{ en, …otherLocales }'}, options?)</code> —
      <code>en</code>
      is required (the base), other eager locales are checked against its structure, and
      <code>options.loaders</code> opts into
      <a class="text-primary hover:underline" href={resolve('/i18n/lazy-loading')}>code-splitting</a
      >.
    </p>
    <CodeExample code={createCode} language="typescript" preview={false} />

    <div class="border-border-subtle mt-4 overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface-subtle border-border-subtle border-b">
            <th class="text-text-primary px-4 py-2 text-left font-medium">Returns</th>
            <th class="text-text-primary px-4 py-2 text-left font-medium">Signature</th>
            <th class="text-text-primary hidden px-4 py-2 text-left font-medium md:table-cell"
              >Description</th
            >
          </tr>
        </thead>
        <tbody>
          {#each returnMembers as [name, sig, desc] (name)}
            <tr class="border-border-subtle border-b last:border-0">
              <td class="text-text-primary px-4 py-2 font-mono text-xs">{name}</td>
              <td class="text-text-secondary px-4 py-2 font-mono text-xs">{sig}</td>
              <td class="text-text-tertiary hidden px-4 py-2 text-xs md:table-cell">{desc}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Section>

  <Section id="hook" title="The hook pattern">
    <p class="text-text-secondary mb-4">
      <code>useTranslate</code> is re-exported as <code>use&lt;Package&gt;I18n</code> and aliased to
      a two-letter local in components (<code>bt</code> / <code>tt</code> / <code>dt</code>). It
      reads the context locale <strong>at call time</strong>, so wrapping it in markup or
      <code>$derived</code>
      re-renders on a locale switch.
    </p>
    <CodeExample code={hookCode} language="svelte" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      The hook must be called during component initialisation (like every Svelte context read), then
      reused — don't call <code>useBlocksI18n()</code> inside an event handler or loop body.
    </p>
  </Section>

  <Section id="resolution" title="Resolution order">
    <p class="text-text-secondary mb-4">For a package hook, a key resolves in this order:</p>
    <ol class="text-text-secondary mb-4 list-decimal space-y-1 pl-5 text-sm">
      <li>the package namespace in the <strong>active</strong> locale,</li>
      <li>the package namespace in the package's <strong>base/fallback</strong> locale,</li>
      <li>the <strong>global</strong> namespace (shared keys registered without a package).</li>
    </ol>
    <p class="text-text-tertiary text-xs">
      A key that resolves nowhere returns the key string itself (fail-honest) — so a missing
      translation is visible, never silently blank.
    </p>
  </Section>

  <Section id="t-component" title="The <T> component">
    <p class="text-text-secondary mb-4">
      For declarative one-off translations in markup, <code>&lt;T&gt;</code> wraps
      <code>useI18n().t</code>. Props: <code>key</code>, optional <code>params</code>,
      <code>fallback</code> (shown when the key is missing), <code>package</code> (namespace), and
      <code>options</code>.
    </p>
    <CodeExample code={tComponentCode} language="svelte" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      <code>&lt;T&gt;</code> is convenient but untyped (its <code>key</code> is a plain string). In library
      and app components, prefer the typed hook so keys autocomplete and typos fail to compile.
    </p>
  </Section>

  <Section id="own-package" title="Registering your own package">
    <p class="text-text-secondary mb-4">
      Your app is just another package. Call <code>createPackageI18n</code> with a unique name and your
      own bundles, export the hook, and read it exactly like the library packages — all under the same
      provider.
    </p>
    <CodeExample code={ownPackageCode} language="typescript" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      Pick a namespace that won't collide with <code>blocks</code> / <code>table</code> /
      <code>auth</code>. The docs site you're reading does exactly this under the <code>app</code>
      namespace.
    </p>
  </Section>

  <Section id="validate" title="Parity validation (CI)">
    <p class="text-text-secondary mb-4">
      <code>validatePackageTranslations</code> does a recursive deep-key diff across a package's
      locale bundles — a missing nested key is an error, an extra one a warning. Wire it into a
      vitest test to fail CI on drift. It complements the compile-time parity the generic factory
      enforces for eager bundles, and covers lazy/dynamic ones (see
      <a class="text-primary hover:underline" href={resolve('/i18n/typed-keys')}>Type Safety</a>).
    </p>
    <CodeExample code={validateCode} language="typescript" preview={false} />
  </Section>
</DocsPageLayout>
