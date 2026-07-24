/**
 * Mirrored A2UI golden fixture — DO NOT hand-edit; mirror of the upstream file.
 * Source: https://github.com/a2ui-project/a2ui
 *   specification/v0_9_1/catalogs/basic/examples/simple_text.json
 * Licensed under the Apache License, Version 2.0.
 */
export const exSimpleText = {
  name: 'Simple Text',
  description: 'Simple example demonstrating basic catalog components.',
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'gallery-simple-text',
        catalogId: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'
      }
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'gallery-simple-text',
        components: [
          {
            id: 'root',
            component: 'Text',
            text: 'Hello, Minimal Catalog!',
            variant: 'h1'
          }
        ]
      }
    }
  ]
} as const;
