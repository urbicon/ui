import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Marketing',
  difficulty: 'Beginner',
  title: 'Pricing Cards',
  description: 'Three-tier pricing with SegmentGroup billing toggle and feature comparison.',
  components: ['Card', 'Badge', 'Button', 'Separator', 'SegmentGroup', 'Tooltip'],
  features: [
    'SegmentGroup toggle for annual/monthly billing',
    'Three-tier plan comparison with feature lists',
    'Highlighted recommended plan with scale effect',
    'Tooltip details on premium features',
    'Responsive grid layout',
    '20% annual savings indicator'
  ]
};
