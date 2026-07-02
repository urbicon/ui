/**
 * Per-slot CSS class overrides for auth page components (LoginPage, RegisterPage, etc.).
 * Each key targets a specific visual area of the page. Only the slots you override are affected.
 *
 * @example
 * ```svelte
 * <LoginPage {t}
 *   slotClasses={{
 *     root: 'bg-gray-50 p-8',
 *     card: 'shadow-xl max-w-lg',
 *     title: 'text-3xl',
 *     submit: 'rounded-full'
 *   }}
 * />
 * ```
 */
export interface AuthPageSlotClasses {
  /** Outermost wrapper element. */
  root?: string;
  /** Card container around the form. */
  card?: string;
  /** Page heading (h1). */
  title?: string;
  /** Form element wrapping all fields. */
  form?: string;
  /** Individual form field (Input). */
  field?: string;
  /** Submit button. */
  submit?: string;
  /** Error alert container. */
  error?: string;
  /** Success message container. */
  success?: string;
  /** Links area below the form (e.g. "Forgot password?"). */
  links?: string;
  /** Password requirements checklist (RegisterPage only). */
  requirements?: string;
}

/**
 * Role option for the InvitationManager menu.
 *
 * @example
 * ```ts
 * const roles: RoleOption[] = [
 *   { value: 'ADMIN', label: 'Administrator' },
 *   { value: 'USER', label: 'User' }
 * ];
 * ```
 */
export interface RoleOption {
  /** Internal value sent to the API. */
  value: string;
  /** Display label shown in the menu. */
  label: string;
}
