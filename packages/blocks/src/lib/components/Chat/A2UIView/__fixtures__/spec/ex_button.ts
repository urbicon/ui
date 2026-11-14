/**
 * Mirrored A2UI golden fixture — DO NOT hand-edit; mirror of the upstream file.
 * Source: https://github.com/a2ui-project/a2ui
 *   catalogs/basic/v1/examples/scaffold-interactive-button.json
 * Licensed under the Apache License, Version 2.0.
 */
export const exButton = {
  name: 'Interactive Button',
  description: 'Simple example demonstrating basic catalog components.',
  messages: [
    {
      version: '1.0',
      createSurface: {
        surfaceId: 'gallery-interactive-button',
        catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'
      }
    },
    {
      version: '1.0',
      updateComponents: {
        surfaceId: 'gallery-interactive-button',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['title', 'action_button'],
            justify: 'center',
            align: 'center'
          },
          {
            id: 'title',
            component: 'Text',
            text: 'Click the button below',
            variant: 'body'
          },
          {
            id: 'action_button',
            component: 'Button',
            child: 'button_label',
            variant: 'primary',
            action: {
              event: {
                name: 'button_clicked',
                context: {}
              }
            }
          },
          {
            id: 'button_label',
            component: 'Text',
            text: 'Click Me'
          }
        ]
      }
    }
  ]
} as const;
