<script lang="ts">
  import { page } from '$app/state';
  import { SITE_NAME, SITE_URL, DEFAULT_TITLE, DEFAULT_DESCRIPTION, OG_IMAGE_PATH } from './seo';

  interface Props {
    /** Page title without the site suffix — becomes "<title> – Urbicon UI". Without the prop: the site's default title. */
    title?: string;
    description?: string;
    /** og:type — doc pages are "website"; "article" for changelog-style content. */
    ogType?: 'website' | 'article';
    /** Exclude the page from indexing (e.g. legal notice/privacy policy). */
    noindex?: boolean;
  }

  let {
    title,
    description = DEFAULT_DESCRIPTION,
    ogType = 'website',
    noindex = false
  }: Props = $props();

  const fullTitle = $derived(title ? `${title} – ${SITE_NAME}` : DEFAULT_TITLE);
  const canonical = $derived(new URL(page.url.pathname, SITE_URL).href);
  const ogImage = `${SITE_URL}${OG_IMAGE_PATH}`;
</script>

<svelte:head>
  <title>{fullTitle}</title>
  {#if noindex}
    <meta name="robots" content="noindex" />
  {/if}
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content={ogType} />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={fullTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImage} />
</svelte:head>
