# Migrating `@urbicon-ui/blocks`

Breaking changes to the component library, newest first: what moved, what it costs you, and —
where nothing reports the change — what to grep for before you ship.

Only this package. The table's v8 view-state rewrite has its own guide,
[MIGRATION-V8.md](https://github.com/urbicon/ui/blob/main/packages/table/docs/MIGRATION-V8.md),
and ships in the `@urbicon-ui/table` tarball.

## v9

### Conditional `overrides` match the variants a component names

A `overrides` rule used to be matched against the raw object a component happened to hand the
resolver. It is now matched against that component's **effective** variants: every axis the
component names, at its value, or at its `tv()` config's `defaultVariants` value where it
named the axis but left it `undefined`.

**Rules that used to do nothing now fire.** That is the point of the change — `{ disabled:
false }`, `{ readonly: false }` and `{ error: false }` were unmatchable on 19 components,
because a component carried `disabled: disabled || undefined` and the matcher saw no
`disabled` at all. The same for any axis a call site left at its default: `{ size: 'md' }`
now matches a component nobody passed a `size` to.

**Nothing reports this.** Not the compiler — `ConditionalOverride`'s index signature accepts
any key — and not the runtime, which skips a non-matching rule without a word. The only
signal is visual. Before you ship, walk the `overrides:` arrays in your `defaults` and
`presets` and ask of each rule: *is this condition true of more components than I meant?* The
two that changed most:

- a rule keyed on a value that is also the config default (`{ variant: 'outlined' }` where
  `outlined` is the default) now matches every instance, not only the ones that spelled it out;
- a rule keyed on `false` for a boolean axis now matches, where it previously never did.

Rules keyed on an axis the component does **not** name still match nothing — that is
deliberate, and it is what keeps a rule on `SegmentItem`'s `disabled` from painting the
sibling that is not disabled.

### `stepState` → `state`, `stepDisabled` → `disabled`

The two Stepper axes are renamed to the props they describe. **Two failure modes, one of them
silent:**

- `stepperVariants({ stepState: … })` and the `StepperVariants` type are compile errors — both
  are exported, so TypeScript names the line.
- An `overrides` rule written as `{ stepState: 'active' }` is a **silent no-op**: the index
  signature accepts the old key and the rule simply stops matching.

Grep for `stepState` and `stepDisabled` across your own source, including the string keys
inside `defaults` / `presets`.

### `resolveSlotClasses()` takes the component's `tv()` config

Only affects you if you wrote your own wrapper around a blocks component; the components
themselves are updated. The call gains a required sixth argument, so an old five-argument call
is a compile error rather than a silent behaviour change:

```svelte
<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses, wrapperActiveProps } from '@urbicon-ui/blocks';
  import { inputVariants } from '@urbicon-ui/blocks';

  const config = getBlocksConfig();
  const slotClasses = $derived(
    resolveSlotClasses(
      config,
      'MoneyField',
      preset,
      wrapperActiveProps(inputVariants.config, { variant, size, disabled }),
      slotClassesProp,
      inputVariants.config // ← new: the config the axes above belong to
    )
  );
</script>
```

Pass the config the condition object's axes come from — for a wrapper that is the **inner**
component's config, the same one `wrapperActiveProps` gets. Nothing checks that pairing, so a
mismatched config silently matches rules against the wrong axes.

### The shadow scale left the colour namespace

The five box-shadow steps are declared as `--blocks-shadow-scale-xs` …
`--blocks-shadow-scale-lg`. They were `--color-shadow-xs` … `--color-shadow-lg`.

**Nothing changes unless your own theme overrides a step.** Every value is identical, the
layering is unchanged — `interaction.css` still republishes each step as
`--blocks-shadow-<step>` on `:root` — and so is the name your markup uses:
`shadow-[var(--blocks-shadow-md)]` and `--blocks-shadow-tint` are untouched.

If you do override one, move it:

```css
/* before */
@theme {
  --color-shadow-md: 0 10px 15px -3px oklch(0.22 0.03 55 / 0.18);
}
```

```css
/* after */
@theme {
  --blocks-shadow-scale-md: 0 10px 15px -3px oklch(0.22 0.03 55 / 0.18);
}
```

Nothing reports the old spelling — not CSS, not TypeScript — and leaving it behind costs more
than the override it stops feeding. `--color-*` is the namespace Tailwind mints a colour
utility from for every key in it, so a `--color-shadow-md` still sitting in your theme
re-creates, inside your build, the exact defect this release removes: Tailwind emits
`.text-shadow-md { color: var(--color-shadow-md) }` after `.text-primary`, a multi-layer
shadow list is invalid at computed-value time as a `color`, and on an inherited property
invalid means `inherit` rather than "ignored" — so `text-primary text-shadow-md` renders the
parent element's colour. **Grep for `--color-shadow-` before you ship.**

Why the steps did not move into `--shadow-*`, Tailwind's own box-shadow namespace: this scale
sits one rung off it — `base`/`md`/`lg` carry the geometry Tailwind ships as `md`/`lg`/`xl` —
so a step there would silently retune `shadow-md` and `shadow-lg` for every consumer.
`--blocks-*` is the library's own prefix and mints no utility at all.
