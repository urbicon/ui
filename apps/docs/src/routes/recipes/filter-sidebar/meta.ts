import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Layout',
  difficulty: 'Intermediate',
  title: 'Filter Sidebar',
  description:
    'A filterable results page where the filter panel is a persistent left rail on desktop and a slide-in overlay on mobile — the exact lifecycle Sidebar mode="responsive" exists for. No backdrop or focus-trap on the desktop rail (that would be a Drawer); the panel is part of the page shell.',
  components: [
    'Sidebar',
    'Input',
    'RadioGroup',
    'Slider',
    'SegmentGroup',
    'Checkbox',
    'Card',
    'Button',
    'Badge'
  ],
  features: [
    'Persistent on desktop, overlay on mobile via Sidebar mode="responsive" — no backdrop or focus-trap on the desktop rail',
    'Live client-side filtering: a single $derived recomputes the result grid on every control change — no Apply step on desktop',
    'Mixed filter controls — Input search, RadioGroup property type, range Slider for rent, SegmentGroup bedrooms, Checkbox amenities',
    'Mobile funnel trigger opens the same Sidebar as a backdropped overlay; a "Show N results" button dismisses it',
    'Active-filter count drives both the Reset button and the mobile trigger badge',
    'Empty state with a one-tap Reset when no listing matches'
  ]
};
