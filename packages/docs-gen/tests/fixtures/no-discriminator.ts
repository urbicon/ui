/**
 * Union where no property qualifies as a discriminator — both arms share
 * the same string-literal values on `mode`, so the value-sets overlap and
 * detectDiscriminator should reject. Expected behaviour: props merged
 * without conditionalOn, since we can't tell which arm a prop belongs to.
 */

interface NoDiscriminatorAProps {
  mode?: 'edit' | 'view';
  alpha?: string;
}

interface NoDiscriminatorBProps {
  mode?: 'edit' | 'view';
  beta?: number;
}

/**
 * @description Test fixture for union without a discriminator.
 */
export type NoDiscriminatorProps = NoDiscriminatorAProps | NoDiscriminatorBProps;
