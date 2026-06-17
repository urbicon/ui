import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TemplateSections } from '../data/template-loader.js';
import { loadTemplateSections } from '../data/template-loader.js';

const GUIDE_RESOURCES: { id: string; name: string; key: keyof TemplateSections }[] = [
  {
    id: 'api-grammar',
    name: 'API Grammar Guide',
    key: 'api-grammar'
  },
  {
    id: 'component-families',
    name: 'Component Families Guide',
    key: 'component-families'
  },
  {
    id: 'tokens',
    name: 'Design Tokens Guide',
    key: 'tokens'
  },
  {
    id: 'design-quality',
    name: 'Design Quality Guide',
    key: 'design-quality'
  },
  {
    id: 'customization',
    name: 'Customization Guide',
    key: 'customization'
  },
  {
    id: 'style-patterns',
    name: 'Style Patterns Guide',
    key: 'style-patterns'
  },
  {
    id: 'auth-setup',
    name: 'Auth Setup Guide',
    key: 'auth-setup'
  }
];

export function registerGuideResources(server: McpServer): void {
  for (const guide of GUIDE_RESOURCES) {
    server.resource(`guide-${guide.id}`, `urbicon://guide/${guide.id}`, async (uri) => {
      const sections = await loadTemplateSections();
      const content = sections[guide.key];

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content || `Guide section "${guide.id}" not found.`
          }
        ]
      };
    });
  }
}
