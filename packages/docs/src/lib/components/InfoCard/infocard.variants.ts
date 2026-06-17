import { tv, type VariantProps } from '@urbicon-ui/blocks';

/**
 * InfoCard renders as an inline note: no surrounding border and no
 * bg-{intent}-50 fill, just a left accent border in the intent color.
 * Title and body use the standard text tokens so the note sits quietly
 * within the reading flow.
 */
export const infoCardVariants = tv({
  slots: {
    container: ['border-l-2 pl-4 py-2 my-4'],
    header: ['flex items-center gap-2 mb-1'],
    icon: ['text-base flex-shrink-0 opacity-70'],
    title: ['font-semibold text-text-primary'],
    content: ['leading-relaxed text-text-secondary']
  },
  variants: {
    intent: {
      info: { container: 'border-l-info' },
      primary: { container: 'border-l-primary' },
      secondary: { container: 'border-l-secondary' },
      success: { container: 'border-l-success' },
      warning: { container: 'border-l-warning' },
      danger: { container: 'border-l-danger' },
      neutral: { container: 'border-l-border-default' },
      example: { container: 'border-l-success' },
      playground: { container: 'border-l-primary' },
      api: { container: 'border-l-border-default' }
    },
    size: {
      sm: { container: 'text-xs py-1.5' },
      md: { container: 'text-sm py-2' },
      lg: { container: 'text-base py-3' }
    }
  },
  defaultVariants: {
    intent: 'info',
    size: 'md'
  }
});

export type InfoCardVariantProps = VariantProps<typeof infoCardVariants>;
