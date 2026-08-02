<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Section, CodeExample } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';

  const navigation = [
    { id: 'overview', title: 'Three layers' },
    { id: 'parity', title: 'Parity & quality' },
    { id: 'runtime', title: 'Runtime misses' },
    { id: 'scanning', title: 'Unused & hardcoded' },
    { id: 'ci', title: 'CI integration' }
  ];

  const parityCode = `// translations.test.ts — pure, deterministic, zero false positives.
import { auditTranslations } from '@urbicon-ui/i18n';
import { appTranslations } from '$lib/i18n'; // { en: { … }, de: { … } }

it('translations stay in parity', () => {
  const report = auditTranslations('app', appTranslations);
  expect(report.ok).toBe(true); // true ⇢ no error-severity findings
});

// Each report.findings entry carries a stable \`code\` + severity:
//   missing-key · empty-value · param-mismatch · plural-shape-invalid
//   plural-category-incomplete · value-equals-key · wrong-type   (errors)
//   extra-key · same-as-base (opt-in)                            (warnings)`;

  const collectorCode = `// test setup — catch keys that resolve nowhere at RUNTIME, including the
// dynamically-built keys a static scan can't see.
import { configureI18n, createMissingKeyCollector } from '@urbicon-ui/i18n';

const misses = createMissingKeyCollector();
configureI18n({ onMissingKey: misses.onMissingKey });

// … render pages / run the E2E flow …

expect(misses.isClean()).toBe(true); // nothing rendered as its raw key
// misses.report() → [{ key, locale, packageName?, count }]`;

  const cliCode = `# parity (locale bundles) + unused keys + hardcoded strings — all three
urbicon i18n audit src/ --translations src/lib/translations

# scope to one check; --json for CI; allowlist dynamically-built key families
urbicon i18n unused --dynamic-keys 'errors.*,filter.operators.*' --json
urbicon i18n hardcoded src/ --strict   # gate the advisory lint too`;

  const scannerCode = `// The CLI is the filesystem front end over this pure core. typescript +
// svelte are optional peers, lazily imported only when a scan runs.
import { scanSources, findUnusedKeys, collectDeepKeys } from '@urbicon-ui/i18n/audit';

const { scan } = await scanSources(files); // files: { file, code }[]
const report = findUnusedKeys(collectDeepKeys(enBundle), scan, {
  dynamicKeys: ['errors.*'], // never flagged
  runtimeUsedKeys // optional: keys observed via createMissingKeyCollector
});
// report.unused          → { key, tier: 'confirmed' | 'suspect' }[]
// report.usedButUndefined → keys referenced in code but defined nowhere`;

  const ciCode = `# .github/workflows/i18n.yml — gate translation correctness in CI
- uses: oven-sh/setup-bun@v2
- run: bun install --frozen-lockfile
- run: bunx urbicon i18n audit src/ --translations src/lib/translations`;
</script>

<SeoMeta
  title="Auditing & Quality - Localization"
  description="Find untranslated strings, unused translation keys, and hardcoded UI copy: a data-level parity audit (auditTranslations), a runtime missing-key sink (onMissingKey), and the urbicon i18n source scanner — usable in tests and CI."
/>

<DocsPageLayout
  title="Auditing & Quality"
  description="Three complementary layers catch i18n problems before they ship: a data-level parity audit you assert in a test, a runtime sink that flags raw-key renders, and a source scan for unused keys and hardcoded strings. The first two are dependency-free; the scanner and CLI front them for whole-project checks."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Localization', href: resolve('/i18n') }]}
>
  <Section id="overview" intent="primary">
    <p class="text-text-secondary mb-4">
      A key-based i18n system has three distinct failure modes, and one tool rarely covers all
      three. A locale can <strong>fall behind</strong> the base (a key missing, empty, or with the
      wrong interpolation params). A defined key can become <strong>dead</strong> after a rename.
      And UI copy can <strong>bypass</strong> i18n entirely as a literal string. Each needs a different
      lens.
    </p>
    <div class="border-border-subtle bg-surface-elevated mb-4 rounded-2xl border p-6">
      <h4 class="text-text-primary mb-3 text-sm font-semibold">Where each layer lives</h4>
      <ul class="text-text-secondary space-y-2 text-sm">
        <li>
          <strong>Data-level audit</strong> (<code>auditTranslations</code>) and the
          <strong>runtime sink</strong> (<code>onMissingKey</code>) ship from
          <code>@urbicon-ui/i18n</code> — dependency-free, run them in a Vitest test.
        </li>
        <li>
          The <strong>source scanner</strong> is the dev-only <code>@urbicon-ui/i18n/audit</code>
          subpath (<code>typescript</code> + <code>svelte</code> as optional, lazily-imported peers).
        </li>
        <li>
          <code>urbicon i18n</code> (in <code>@urbicon-ui/design</code>) is the filesystem front end
          over all three — the one you run in CI.
        </li>
      </ul>
    </div>
  </Section>

  <Section id="parity" title="1. Parity & quality (data-level)">
    <p class="text-text-secondary mb-4">
      <code>auditTranslations</code> diffs a package's locale bundles. Beyond missing/extra keys it
      sees what a structural diff can't: empty values, interpolation-param drift (<code
        >{'{{name}}'}</code
      >
      present in one locale but not another), value-equals-key placeholders, and malformed or CLDR-incomplete
      <code>_plural</code> objects. It is pure and deterministic — no false positives — so it belongs
      in a test that fails CI on drift.
    </p>
    <CodeExample code={parityCode} language="typescript" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      The richer successor to <code>validatePackageTranslations</code> (kept for back-compat).
      Toggle individual checks or set a base locale via the third options argument;
      <code>same-as-base</code>
      (a target string still identical to the base — probably untranslated) is opt-in because proper nouns
      make it FP-prone.
    </p>
  </Section>

  <Section id="runtime" title="2. Runtime misses">
    <p class="text-text-secondary mb-4">
      A static audit can only see keys that exist as literals. Keys assembled at runtime (<code
        >t(`errors.${'{code}'}`)</code
      >) are invisible to it — but
      <code>onMissingKey</code> catches them where it counts: the moment <code>translate</code>
      resolves a key nowhere and would render its raw string.
      <code>createMissingKeyCollector</code> packages that sink for a test or E2E run.
    </p>
    <CodeExample code={collectorCode} language="typescript" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      Off by default (a provider-less render legitimately misses keys), so it only fires once you
      opt in. Fed back into the scanner as <code>runtimeUsedKeys</code>, the observed keys also
      prove a dynamic key is reachable — shrinking false "unused" reports.
    </p>
  </Section>

  <Section id="scanning" title="3. Unused keys & hardcoded strings">
    <p class="text-text-secondary mb-4">
      <code>urbicon i18n</code> scans your sources (binding-aware, so it follows arbitrarily-named
      <code>useFooI18n()</code> aliases, member calls, and <code>&lt;T key&gt;</code>). It reports
      <strong>unused</strong> keys (defined but referenced nowhere — <code>confirmed</code> when no
      opaque dynamic call could be hiding them, else <code>suspect</code>),
      <strong>used-but-undefined</strong> keys (a typo that renders raw), and
      <strong>hardcoded</strong> UI copy in markup. Run it under Bun (it loads <code>.ts</code> locale
      bundles).
    </p>
    <CodeExample code={cliCode} language="bash" preview={false} />
    <p class="text-text-secondary mt-4 mb-4">
      It gates (exit 1) on parity errors and used-but-undefined keys — the correctness failures.
      Unused keys and hardcoded strings are advisory (add <code>--strict</code> to gate them too), mirroring
      the design gate's correctness-vs-craft split. The same scanning core is importable for programmatic
      use:
    </p>
    <CodeExample code={scannerCode} language="typescript" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      The unused check is biased hard toward "used" — a key is flagged only when no static call, no
      template prefix, no string literal anywhere, no allowlist, and no runtime observation reaches
      it — so a live key is never wrongly proposed for deletion. Declare dynamic families with
      <code>--dynamic-keys</code> to clear the <code>suspect</code> tier.
    </p>
  </Section>

  <Section id="ci" title="CI integration">
    <p class="text-text-secondary mb-4">
      One step gates translation correctness alongside your design gate. <code
        >urbicon init --ci</code
      >
      writes it for you; the standalone form:
    </p>
    <CodeExample code={ciCode} language="yaml" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      Pair it with the <code>auditTranslations</code> test for the data-level checks and a
      <code>createMissingKeyCollector</code> assertion in your E2E run for the dynamic keys — three layers,
      each catching what the others can't.
    </p>
  </Section>
</DocsPageLayout>
