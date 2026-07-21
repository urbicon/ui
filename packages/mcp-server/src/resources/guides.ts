import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadPackageGuide } from '../data/guide-loader.js';
import type { TemplateSections } from '../data/template-loader.js';
import { loadTemplateSections } from '../data/template-loader.js';

/**
 * The seven guide surfaces. Six slice a `## …` section out of the template
 * bundle ({@link TemplateSections}); the auth guide is a canonical package
 * guide served verbatim from the bundle's `guides/auth.md` (the tarball-shipped
 * `packages/auth/docs/AUTH.md` — one source, all channels, docs/DOCS-SURFACES.md).
 * The `urbicon` CLI lists every bundled package guide dynamically
 * (`urbicon guide`); this static list names the ones the server advertises.
 */
const GUIDE_RESOURCES: (
  | { id: string; name: string; source: 'template'; key: keyof TemplateSections }
  | { id: string; name: string; source: 'package-guide'; slug: string }
)[] = [
  {
    id: 'api-grammar',
    name: 'API Grammar Guide',
    source: 'template',
    key: 'api-grammar'
  },
  {
    id: 'component-families',
    name: 'Component Families Guide',
    source: 'template',
    key: 'component-families'
  },
  {
    id: 'tokens',
    name: 'Design Tokens Guide',
    source: 'template',
    key: 'tokens'
  },
  {
    id: 'design-quality',
    name: 'Design Quality Guide',
    source: 'template',
    key: 'design-quality'
  },
  {
    id: 'customization',
    name: 'Customization Guide',
    source: 'template',
    key: 'customization'
  },
  {
    id: 'style-patterns',
    name: 'Style Patterns Guide',
    source: 'template',
    key: 'style-patterns'
  },
  {
    id: 'auth',
    name: 'Auth Reference',
    source: 'package-guide',
    slug: 'auth'
  }
];

/**
 * Register one `urbicon://guide/<id>` resource per {@link GUIDE_RESOURCES} entry.
 * Each read resolves its content lazily (template slice or bundled package
 * guide) and degrades to a "not found" note if the content is missing.
 */
export function registerGuideResources(server: McpServer): void {
  for (const guide of GUIDE_RESOURCES) {
    server.resource(`guide-${guide.id}`, `urbicon://guide/${guide.id}`, async (uri) => {
      let content: string | null;
      if (guide.source === 'template') {
        const sections = await loadTemplateSections();
        content = sections[guide.key] || null;
      } else {
        content = await loadPackageGuide(guide.slug);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content ?? `Guide "${guide.id}" not found.`
          }
        ]
      };
    });
  }
}
