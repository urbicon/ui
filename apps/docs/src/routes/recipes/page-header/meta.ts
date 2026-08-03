import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Layout',
  difficulty: 'Beginner',
  title: 'Page Header',
  description:
    'Top-of-page heading pattern with eyebrow, title, subtitle, and action area. Pure Tailwind composition — no library component needed. Four variants for list pages, detail pages with breadcrumb, tabbed pages, and form pages.',
  components: ['Button', 'Badge', 'Breadcrumb', 'Tab'],
  features: [
    'List-page header with eyebrow, title, subtitle, and a primary action on the right',
    'Detail-page header with a leading Breadcrumb above the title',
    'Tab-page header where the heading row sits above a Tab strip',
    'Form-page header with secondary actions (Cancel/Save) on the right',
    'Responsive layout — actions wrap below the heading on narrow viewports',
    'Heading-level prop pattern (h1 vs h2 vs h3) for nesting inside larger layouts'
  ]
};
