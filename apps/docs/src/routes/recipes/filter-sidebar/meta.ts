import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Layout',
  difficulty: 'Intermediate',
  title: 'Filter Sidebar',
  description:
    'A listings page whose filter rail is persistent on desktop and a slide-in overlay behind a funnel button on mobile, built on Sidebar mode="responsive". Search, property type, rent range, bedrooms and amenities narrow the result grid live, with no Apply step.',
  components: [
    'Sidebar',
    'Input',
    'RadioGroup',
    'RadioItem',
    'Slider',
    'SegmentGroup',
    'SegmentItem',
    'Checkbox',
    'Card',
    'Button',
    'Badge'
  ],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Sidebar mode="responsive": one markup, a persistent rail above 1024px and a backdropped overlay below. The open prop governs only the overlay; the desktop rail ignores it.',
    'Live client-side filtering: one $derived recomputes the results on every control change, no Apply step. The overlay\'s "Show N" button only closes it.',
    'Five filter shapes: Input search over title + neighborhood, RadioGroup property type, a range Slider for rent, SegmentGroup bedrooms (3 = 3+), Checkbox amenities (AND-combined).',
    'activeCount drives the Reset button label and disabled state, and the funnel trigger badge on mobile.',
    'The main region is offset by hand: lg:pl-72 matches width="18rem" (the rail is position: fixed). SidebarLayout wires the offset instead.',
    'Empty state with a Reset button when nothing matches.'
  ]
};
