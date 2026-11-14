/**
 * Mirrored A2UI golden fixture — DO NOT hand-edit; mirror of the upstream file.
 * Source: https://github.com/a2ui-project/a2ui
 *   catalogs/basic/v1/examples/scaffold-simple-text.json
 * Licensed under the Apache License, Version 2.0.
 */
export const exSimpleText = {
  name: 'Simple Text',
  description: 'Simple example demonstrating basic catalog components.',
  messages: [
    {
      version: '1.0',
      createSurface: {
        surfaceId: 'gallery-simple-text',
        catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'
      }
    },
    {
      version: '1.0',
      updateComponents: {
        surfaceId: 'gallery-simple-text',
        components: [
          {
            id: 'root',
            component: 'Text',
            text: '# Hello, Minimal Catalog!'
          }
        ]
      }
    }
  ]
} as const;
