<!--
  Internal: the live password-requirements checklist, shared by RegisterPage,
  ResetPasswordPage and AccountSettings. The rules come from the policy the
  server published (`password-policy.ts`), so the list can only ever show what
  the server actually enforces. Not exported from the package.
-->
<script lang="ts">
  import type { AuthLocale } from '../../../i18n/keys.js';
  import {
    activePasswordRules,
    isPasswordRuleMet,
    type PasswordPolicy,
    type PasswordRuleId
  } from '../../../password-policy.js';
  import { slotClass } from '../../utils/slot-class.js';

  interface Props {
    /** The policy in force — from the server, the prop, or the package defaults. */
    policy: PasswordPolicy;
    /** Current field value. */
    password: string;
    /** Merged locale bundle from the calling page. */
    t: AuthLocale;
    /** Id for the field's `aria-describedby`. */
    id: string;
    unstyled?: boolean;
    class?: string;
  }

  let { policy, password, t, id, unstyled = false, class: className }: Props = $props();

  // The locale keys ARE the rule ids: this annotation is what makes a new rule
  // in `PASSWORD_RULES` a compile error until both bundles carry its label.
  const labels: Record<PasswordRuleId, string> = $derived(t.auth.register.requirements);

  const rules = $derived(
    activePasswordRules(policy).map((rule) => ({
      id: rule,
      label:
        rule === 'minLength'
          ? labels.minLength.replace('{n}', String(policy.minLength))
          : labels[rule],
      met: isPasswordRuleMet(rule, password, policy)
    }))
  );

  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<!--
  The checklist is functionality, not decoration: it must survive `unstyled` —
  only the default classes drop. `data-met` carries the pass/fail state
  structurally so unstyled consumers can target it from CSS, and the glyph
  carries it for assistive tech through its own accessible name (a bare ✓/✗ is
  announced in the screen reader's language, not the page's).
-->
<ul
  {id}
  class={cls('flex flex-col gap-0.5 pl-1 text-xs', className)}
  aria-label={t.auth.register.requirementsLabel}
>
  {#each rules as rule (rule.id)}
    <li
      class={unstyled ? undefined : rule.met ? 'text-success-text' : 'text-text-tertiary'}
      data-met={rule.met || undefined}
    >
      <span
        class={cls('mr-1 inline-block w-3')}
        role="img"
        aria-label={rule.met ? t.auth.register.requirementMet : t.auth.register.requirementUnmet}
        >{rule.met ? '✓' : '✗'}</span
      >
      {rule.label}
    </li>
  {/each}
</ul>
