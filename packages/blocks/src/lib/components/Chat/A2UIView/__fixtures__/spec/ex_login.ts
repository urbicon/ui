/**
 * Mirrored A2UI golden fixture — DO NOT hand-edit; mirror of the upstream file.
 * Source: https://github.com/a2ui-project/a2ui
 *   specification/v0_9_1/catalogs/basic/examples/login.json
 * Licensed under the Apache License, Version 2.0.
 *
 * Contains `checks` (Checkable) and `call` function references — both are
 * unsupported in this subset, so processing this fixture yields the expected
 * warnings (checks ignored), never errors.
 */
export const exLogin = {
  name: 'Login Form with Validation',
  description: 'Example of login form demonstrating validation checks and logic.',
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'gallery-login-form',
        catalogId: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
        sendDataModel: true
      }
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'gallery-login-form',
        components: [
          {
            id: 'root',
            component: 'Card',
            child: 'main-column'
          },
          {
            id: 'main-column',
            component: 'Column',
            children: [
              'header',
              'email-field',
              'password-field',
              'login-btn',
              'divider',
              'signup-text'
            ]
          },
          {
            id: 'header',
            component: 'Column',
            children: ['title', 'subtitle'],
            align: 'center'
          },
          {
            id: 'title',
            component: 'Text',
            text: 'Welcome back',
            variant: 'h2'
          },
          {
            id: 'subtitle',
            component: 'Text',
            text: 'Sign in to your account',
            variant: 'caption'
          },
          {
            id: 'email-field',
            component: 'TextField',
            value: { path: '/email' },
            label: 'Email',
            checks: [
              {
                condition: { call: 'required', args: { value: { path: '/email' } } },
                message: 'Email is required'
              },
              {
                condition: { call: 'email', args: { value: { path: '/email' } } },
                message: 'Please enter a valid email address'
              }
            ]
          },
          {
            id: 'password-field',
            component: 'TextField',
            value: { path: '/password' },
            label: 'Password',
            variant: 'obscured',
            checks: [
              {
                condition: { call: 'required', args: { value: { path: '/password' } } },
                message: 'Password is required'
              },
              {
                condition: { call: 'length', args: { value: { path: '/password' }, min: 8 } },
                message: 'Password must be at least 8 characters long'
              }
            ]
          },
          {
            id: 'login-btn-text',
            component: 'Text',
            text: 'Sign in'
          },
          {
            id: 'login-btn',
            component: 'Button',
            child: 'login-btn-text',
            checks: [
              {
                condition: {
                  call: 'and',
                  args: {
                    values: [
                      { call: 'email', args: { value: { path: '/email' } } },
                      { call: 'length', args: { value: { path: '/password' }, min: 8 } }
                    ]
                  }
                },
                message: 'Please fix errors before signing in'
              }
            ],
            action: {
              event: {
                name: 'login',
                context: { email: { path: '/email' } }
              }
            }
          },
          {
            id: 'divider',
            component: 'Divider'
          },
          {
            id: 'signup-text',
            component: 'Row',
            children: ['no-account', 'signup-link'],
            justify: 'center'
          },
          {
            id: 'no-account',
            component: 'Text',
            text: "Don't have an account?",
            variant: 'caption'
          },
          {
            id: 'signup-link-text',
            component: 'Text',
            text: 'Sign up'
          },
          {
            id: 'signup-link',
            component: 'Button',
            child: 'signup-link-text',
            action: {
              event: {
                name: 'signup',
                context: {}
              }
            }
          }
        ]
      }
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: 'gallery-login-form',
        value: {
          email: '',
          password: ''
        }
      }
    }
  ]
} as const;
