<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Section, CodeExample } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';

  const navigation = [
    { id: 'inference', title: 'Key inference', order: 1 },
    { id: 'params', title: 'Param inference', order: 2 },
    { id: 'parity', title: 'Eager vs lazy parity', order: 3 },
    { id: 'utils', title: 'Deep-key utilities', order: 4 },
    { id: 'deprecated', title: 'Deprecations', order: 5 }
  ];

  const inferCode = `const en = {
  dialog: { close: 'Close' },
  greeting: 'Hello {{name}}'
} as const;

const blocks = createPackageI18n('blocks', { en /*, de */ });
const t = blocks.useTranslate(); // inside a component

t('dialog.close');       // ✓ autocompletes
t('dialog.nonexistent'); // ✗ compile error — unknown key`;

  const paramCode = `t('greeting', { name: 'Ada' }); // ✓ param \`name\` inferred from {{name}}
t('greeting');                  // ✗ compile error — missing required param
t('dialog.close');              // ✓ no params — none required`;

  const parityCode = `// Eager: de is checked against the en structure at COMPILE time.
const blocks = createPackageI18n('blocks', { en, de });
//                                                ^ a missing/misspelled key in \`de\`
//                                                  is a type error — parity by construction.

// Lazy: a loader's bundle isn't visible to the type-checker, so parity is a
// RUNTIME check. Pair it with validatePackageTranslations in a test.
const blocks2 = createPackageI18n(
  'blocks',
  { en },
  { loaders: { de: () => import('../translations/de').then((m) => m.default) } }
);`;

  const utilsCode = `import {
  getDeepValue, hasDeepKey, collectDeepKeys,
  type DeepKeys, type DeepValue
} from '@urbicon-ui/i18n';

const en = { dialog: { close: 'Close' } } as const;

type Keys = DeepKeys<typeof en>;            // 'dialog' | 'dialog.close'
type Val = DeepValue<typeof en, 'dialog.close'>; // 'Close'

hasDeepKey(en, 'dialog.close');   // true
getDeepValue(en, 'dialog.close'); // 'Close'
collectDeepKeys(en);              // ['dialog.close'] — leaf paths, for diffing`;

  const deprecatedCode = `// ✗ deprecated — same type safety, more ceremony
const pkg = createTypedPackage('blocks', { en, de });

// ✓ current — createPackageI18n registers AND types directly
const pkg2 = createPackageI18n('blocks', { en, de });`;
</script>

<SeoMeta
  title="Type Safety - Localization"
  description="How keys and params infer from the en bundle, eager vs lazy parity, and the DeepKeys utilities."
/>

<DocsPageLayout
  title="Type Safety"
  description="Keys and their parameters flow from the en bundle straight into the hook's t — typos and missing params are compile errors, not runtime surprises."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Localization', href: resolve('/i18n') }]}
>
  <Section id="inference" title="Key inference">
    <p class="text-text-secondary mb-4">
      <code>createPackageI18n</code> is generic over the <code>en</code> bundle (declared
      <code>&lt;const T&gt;</code>). With <code>as const</code> — or a plain literal object — the
      key type flows straight through to the hook's <code>t</code>, so keys autocomplete and typos
      are compile errors.
    </p>
    <CodeExample code={inferCode} language="typescript" preview={false} />
  </Section>

  <Section id="params" title="Parameter inference">
    <p class="text-text-secondary mb-4">
      Parameters are extracted from the <code>{'{{…}}'}</code> placeholders in each string. A key
      with placeholders <strong>requires</strong> those params; a key without them takes none.
    </p>
    <CodeExample code={paramCode} language="typescript" preview={false} />
  </Section>

  <Section id="parity" title="Eager vs. lazy parity">
    <p class="text-text-secondary mb-4">
      Additional <strong>eager</strong> locales are checked against the <code>en</code> structure,
      so a missing or misspelled key in <code>de</code> is a compile error too — key parity by
      construction. For <strong>lazy</strong> locales the bundle isn't visible to the type-checker,
      so parity becomes a runtime check; pair it with
      <a class="text-primary hover:underline" href={resolve('/i18n/package-integration')}
        ><code>validatePackageTranslations</code></a
      > in a test.
    </p>
    <CodeExample code={parityCode} language="typescript" preview={false} />
  </Section>

  <Section id="utils" title="Deep-key utilities">
    <p class="text-text-secondary mb-4">
      The same machinery that types the keys is exported for your own tooling — the <code
        >DeepKeys</code
      >
      / <code>DeepValue</code> types and their runtime counterparts. Useful for building key diffs, custom
      validators, or typed config readers.
    </p>
    <CodeExample code={utilsCode} language="typescript" preview={false} />
  </Section>

  <Section id="deprecated" title="Deprecations">
    <p class="text-text-secondary mb-4">
      <code>createTypedPackage</code> is <strong>deprecated</strong> —
      <code>createPackageI18n</code>
      gives the same type safety while also registering the bundles, so there's no reason to use the older
      two-step form.
    </p>
    <CodeExample code={deprecatedCode} language="typescript" preview={false} />
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
