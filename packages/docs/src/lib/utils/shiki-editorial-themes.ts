import type { ThemeRegistrationRaw } from 'shiki';

export const editorialLight: ThemeRegistrationRaw = {
  name: 'editorial-light',
  type: 'light',
  colors: {
    'editor.background': '#fbfaf6',
    'editor.foreground': '#2a2926'
  },
  settings: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#b8b5ad', fontStyle: 'italic' }
    },
    {
      scope: ['string', 'string.quoted'],
      settings: { foreground: '#8b6834' }
    },
    {
      scope: ['constant.numeric', 'constant.language'],
      settings: { foreground: '#8b6834' }
    },
    {
      scope: ['keyword', 'storage.type', 'storage.modifier'],
      settings: { foreground: '#48453e' }
    },
    {
      scope: ['entity.name.tag', 'support.class.component', 'punctuation.definition.tag'],
      settings: { foreground: '#4d7a3a' }
    },
    {
      scope: ['entity.other.attribute-name', 'entity.other.attribute-name.svelte'],
      settings: { foreground: '#6e6b64' }
    },
    {
      scope: ['variable', 'variable.other', 'meta.object-literal.key'],
      settings: { foreground: '#2a2926' }
    },
    {
      scope: ['entity.name.function', 'support.function'],
      settings: { foreground: '#5a5744' }
    },
    {
      scope: ['entity.name.type', 'support.type'],
      settings: { foreground: '#6b5a3e' }
    },
    {
      scope: ['punctuation', 'meta.brace', 'punctuation.separator', 'punctuation.terminator'],
      settings: { foreground: '#9a968e' }
    },
    {
      scope: ['meta.tag.start', 'meta.tag.end'],
      settings: { foreground: '#9a968e' }
    }
  ]
};

export const editorialDark: ThemeRegistrationRaw = {
  name: 'editorial-dark',
  type: 'dark',
  colors: {
    'editor.background': '#232220',
    'editor.foreground': '#f0ede5'
  },
  settings: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#5a574f', fontStyle: 'italic' }
    },
    {
      scope: ['string', 'string.quoted'],
      settings: { foreground: '#d4a855' }
    },
    {
      scope: ['constant.numeric', 'constant.language'],
      settings: { foreground: '#d4a855' }
    },
    {
      scope: ['keyword', 'storage.type', 'storage.modifier'],
      settings: { foreground: '#c8c3b8' }
    },
    {
      scope: ['entity.name.tag', 'support.class.component', 'punctuation.definition.tag'],
      settings: { foreground: '#8bc878' }
    },
    {
      scope: ['entity.other.attribute-name', 'entity.other.attribute-name.svelte'],
      settings: { foreground: '#a5a299' }
    },
    {
      scope: ['variable', 'variable.other', 'meta.object-literal.key'],
      settings: { foreground: '#f0ede5' }
    },
    {
      scope: ['entity.name.function', 'support.function'],
      settings: { foreground: '#c4c0a8' }
    },
    {
      scope: ['entity.name.type', 'support.type'],
      settings: { foreground: '#c4a872' }
    },
    {
      scope: ['punctuation', 'meta.brace', 'punctuation.separator', 'punctuation.terminator'],
      settings: { foreground: '#7a776e' }
    },
    {
      scope: ['meta.tag.start', 'meta.tag.end'],
      settings: { foreground: '#7a776e' }
    }
  ]
};
