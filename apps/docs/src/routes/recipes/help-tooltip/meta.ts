export const recipeMeta = {
  title: 'Help Tooltip',
  description:
    'Glossary trigger for domain terms — small info icon next to a label, tooltip with the definition. Pattern for domain apps with specialist vocabulary (heating-cost billing, tax, payroll, insurance). Combines Tooltip + Button (ghost, 2xs) + InfoCircleIcon.',
  components: ['Tooltip', 'Button'],
  features: [
    'Consistent trigger across value types — form labels, table headers, inline text',
    'Tooltip with Floating-UI positioning (placement="top", auto-flip)',
    'Glossary map as the single source of truth (i18n-ready, centrally maintained)',
    'A11y: aria-label on the trigger ("Explanation: HeizKV § 7"), tooltip also reachable via focus',
    'Keyboard: Tab focuses, tooltip appears, Escape closes'
  ]
};
