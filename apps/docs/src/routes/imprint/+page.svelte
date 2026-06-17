<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
</script>

<!--
  TODO before launch: replace the [placeholder] entries below with the legally
  valid postal address. Under German law (§ 5 DDG) the site must not go public
  without a complete imprint.
-->

<SeoMeta
  title="Impressum"
  description="Impressum / legal notice for ui.urbicon.de"
  noindex={true}
/>

<div class="mx-auto w-full max-w-2xl px-6 py-16">
  <p class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">// Legal</p>
  <h1 class="text-text-primary mt-5 text-4xl font-bold tracking-tight">
    Impressum<span class="text-primary">|</span>
  </h1>
  <p class="text-text-tertiary mt-4 text-sm leading-relaxed">
    This legal notice is provided in German, as required by German law (§ 5 DDG).
  </p>

  <section class="mt-12">
    <h2 class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">
      // Angaben gemäß § 5 DDG
    </h2>
    <p class="text-text-secondary mt-4 leading-relaxed">
      Felix Urban<br />
      Tannenstr. 27<br />
      40476 Düsseldorf<br />
      Deutschland
    </p>
  </section>

  <section class="mt-10">
    <h2 class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">// Kontakt</h2>
    <p class="text-text-secondary mt-4 leading-relaxed">
      E-Mail: <a href="mailto:info@urbicon.de" class="text-primary hover:underline"
        >info@urbicon.de</a
      >
    </p>
  </section>

  <section class="mt-10">
    <h2 class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">
      // Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
    </h2>
    <p class="text-text-secondary mt-4 leading-relaxed">Felix Urban, Anschrift wie oben.</p>
  </section>
</div>
