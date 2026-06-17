/**
 * Discriminator where one arm carries a multi-literal union — e.g. the
 * Badge case (BadgeStandardProps.variant: 'filled' | 'outlined' | 'soft').
 * The detector must accept this as long as the value-sets across members
 * don't overlap.
 */

interface MultiLiteralDotProps {
  variant: 'dot';
  unique?: never;
}

interface MultiLiteralStandardProps {
  variant?: 'filled' | 'outlined' | 'soft';
  unique?: string;
}

/**
 * @description Multi-literal discriminator fixture.
 */
export type MultiLiteralProps = MultiLiteralDotProps | MultiLiteralStandardProps;
