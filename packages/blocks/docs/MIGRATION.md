# Migrating `@urbicon-ui/blocks`

Breaking changes to the component library, newest first: what moved, what it costs you, and —
where nothing reports the change — what to grep for before you ship.

Entries are headed by the release that shipped the change — an 8.x minor until the launch is
announced, see
[VERSIONING.md § The pre-launch window](https://github.com/urbicon/ui/blob/main/docs/VERSIONING.md#the-pre-launch-window).

Only this package. The table's v8 view-state rewrite has its own guide,
[MIGRATION-V8.md](https://github.com/urbicon/ui/blob/main/packages/table/docs/MIGRATION-V8.md),
and ships in the `@urbicon-ui/table` tarball.

## 8.15.0

### `SidebarLayout`'s `sidebar` slot key is now `sidebarPanel`

`<SidebarLayout slotClasses>` forwards each `sidebar`-prefixed key to the `<Sidebar>` it
embeds. Four of them already named the Sidebar slot they reach — `sidebarBackdrop` to
`backdrop`, `sidebarHeader` to `header`, and so on. The fifth, `sidebar`, reached `panel`
under a name that matched nothing.

```svelte
<!-- before -->
<SidebarLayout slotClasses={{ sidebar: 'bg-neutral-900' }} />
```

```svelte
<!-- after -->
<SidebarLayout slotClasses={{ sidebarPanel: 'bg-neutral-900' }} />
```

**A compile error, not a silent no-op**: `sidebar` has left the union, so every call site and
every `<BlocksProvider>` entry naming it fails to build. Grep for `sidebar:` *inside a
`slotClasses` object* — the snippet props `sidebar`, `sidebarHeader` and `sidebarFooter` are a
different namespace and are unchanged.

The rename is what makes the forwarding derivable: the union is now
`` `sidebar${Capitalize<SidebarSlots>}` `` and the runtime map walks the same slot config, so
the two halves cannot disagree. Under the old hand-written pairing, three edits compiled while
reaching no element — a mistyped source key, a swapped pair, and a deleted line.

### `<BlocksProvider>` slot names are checked against the component

`defaults` and `presets` took any string as a slot name under any component name. A key the
component cannot paint reached no element, changed no markup, and read exactly like a rule
that was simply not matched. Both records — and the `class` record inside an `overrides`
rule — now take the slot names of the component their key names.

```svelte
<!-- before: compiled, painted nothing -->
<BlocksProvider defaults={{ LineChart: { slotClasses: { arc: 'fill-brand' } } }}>
```

```svelte
<!-- after: `arc` is a donut's wedge; a line chart paints `mark` and `point` -->
<BlocksProvider defaults={{ LineChart: { slotClasses: { mark: 'stroke-brand' } } }}>
```

**A key that never resolved is now a compile error**, which is the change: the same
narrowing a component's own `slotClasses` prop already had, on the surface a project
configures once. Expect it to fire on config written before this release, at the keys that
were doing nothing.

The names come from each component's `slotClasses` prop, so the provider admits exactly what
the call site admits — no more and no less. That includes the slots a component reads past
the `tv()` config the cascade resolves under its name — `NumberInput`'s `stepper` and
`stepperButton`, which `Input`'s config never declares; `SidebarLayout`'s five `sidebar*` keys
and `Guide`'s `next`, `prev` and `skip`, which their own configs do not; `base` on `Popover` and
`Separator`, whose configs carry no slot map at all — and it excludes what a component
deliberately leaves out: `SegmentGroup` has no `item`, because `SegmentItem` owns that one.

**A wrapper of your own keeps compiling.** A name this package does not export takes any slot
key, because its slots live in your markup where nothing here can see them — so
`defaults={{ MoneyField: … }}` beside `resolveSlotClasses(config, 'MoneyField', …)` is
unaffected, as are the components of `@urbicon-ui/auth`. The cost is that a **mistyped
component name** is indistinguishable from one of those: `defaults={{ Butoon: … }}` is still
accepted and still reaches nobody.

Two names are worse than that, because the compiler *confirms* them. `CalendarHeader` and
`FormField` declare a `slotClasses` prop but never resolve it through the provider —
`CalendarHeader` takes its classes off the Calendar context, `FormField` reads its own prop
directly — so an entry under either narrows to the right slot names, completes in your editor,
and reaches no element. Neither accepted provider configuration before this release either;
style them at the call site.

**Where it is blind.** These records are weak types — every property optional — so the base
rule is that only an object with *no* key in common is rejected. What catches a wrong key
*beside* a right one is excess-property checking, and that applies to a **fresh object
literal**. How your config reaches the attribute therefore decides how much of it is checked:

| how the config reaches the provider | wrong key alone | wrong key beside a right one |
| --- | --- | --- |
| written inline in the attribute | error | error |
| inline but spread in — `{ mark: 'ok', ...rest }` | error | **accepted** |
| a plain `const`, no type annotation | error | **accepted** |
| a `const` with `satisfies Record<string, ComponentDefaults>` | error | **accepted** |
| a `const` with `as const` | error | **accepted** |
| returned from a function | error | **accepted** |
| a `const` annotated `Record<string, ComponentDefaults>` or `PresetMap` | **accepted** | **accepted** |

Measured on `<BlocksProvider defaults={{ LineChart: … }}>`, every cell. The
wrong-key-*beside*-a-right-one column needs excess-property checking, which only reaches a
**fresh object literal** written into the attribute; without it the weak-type rule is all that is
left, and that rejects only an object sharing *no* key with the target. Rows three to six are one
way of losing it — they put the record in a variable first, `satisfies` and `as const` included,
which check the value and still leave a variable behind. Row two loses it for a second reason:
excess-property checking does not apply to properties brought in by a spread, so a fresh literal
in the attribute is not enough on its own.

**The last row is the one that costs you the most.** `Record<string, ComponentDefaults>` was
this prop's own type until this release, and `PresetMap` is still exported — so annotating a
theme module with either is the natural thing to reach for, and it turns the check off
completely, including the wrong-key-alone case every other row still catches. There is no
diagnostic; the annotation widens the key type back to `string` before the provider ever sees
it.

**Write `satisfies` where you would have written the annotation.** It does not buy back the
last column — it checks against `ComponentDefaults<string>`, where any slot name is legal, and
hands on a variable — but it keeps the literal keys, so the provider still narrows per
component and the wrong-key-alone case is reported again:

```ts
// no check at all
export const theme: Record<string, ComponentDefaults> = { LineChart: { … } };
// the alone column back
export const theme = { LineChart: { … } } satisfies Record<string, ComponentDefaults>;
```

For the full check, write the object into the attribute.

### A wrapper's `overrides` match the state its inner component is in — `wrapperActiveProps` is gone

`NumberInput`, `CurrencyInput`, `LocaleSwitcher` and `ConfirmDialog` are wrappers: each hands
the styling contract to one component (`Input`, `Select`, `Dialog`) and resolves the cascade
under its own name, so a preset written for the number field does not dress every text field.

That resolution used to happen **in the wrapper**, which runs before the component it wraps.
It could only rebuild that component's variants out of what its caller had written, filling
the rest in from the inner `tv()` config's defaults — and three kinds of axis are not
reconstructable that way. Two of them made a rule paint a state the component was never in,
which looks like a success. **Eight axes change their answer**, measured:

| kind | axis | before | now |
| --- | --- | --- | --- |
| derived — computed inside | `tier`, in a `commit` tier context | `{ tier: 'modify' }` fired; `{ tier: 'commit' }` did not | the rendered tier answers |
| derived — computed inside | `messageType`, on `<NumberInput error="…">` | `{ messageType: 'helper' }` fired; `{ messageType: 'error' }` did not | `error` answers |
| derived — computed inside | `hasRightIcon`, on every `<NumberInput>` and `<CurrencyInput>` | `{ hasRightIcon: false }` fired on **every** one of them | the rendered field answers — `true` wherever a stepper or a suffix symbol is drawn |
| derived — computed inside | `hasLeftIcon`, e.g. `<CurrencyInput symbolPosition="prefix">` | `{ hasLeftIcon: false }` fired even with a left symbol | `true` wherever a left icon or symbol is drawn |
| coerced | `error` (a `string` prop, a boolean axis) | `{ error: 'too large' }` fired; `{ error: true }` never did | `{ error: true }` fires, the string does not |
| owned | `open` on Select | `{ open: false }` fired even while open | the listbox state answers |
| per slot call | `iconPosition` on Input | fired under the wrapper's name, never under `Input` | fires under neither |
| per slot call | `selected` on Select | fired under `LocaleSwitcher`, never under `Select` | fires under neither |

The two `has*Icon` rows are the ones most likely to be holding a style up today, because a
wrapper could never write those axis names — its props are `leftIcon` / `rightIcon` — so the
stand-in always answered `false` and a rule keyed on `false` reached **every** instance. It
now reaches none of the ones that draw an icon.

The name now travels **down**: the wrapper passes its name, `preset` and instance
`slotClasses` to the component it wraps, and that component resolves the cascade against the
variants it is actually rendering with. The rung order is unchanged —
`Input.defaults → Input.overrides → Input.preset → Input.preset.overrides` and then the
wrapper's own four rungs and its instance `slotClasses` last — so `defaults: { Input: … }`
still reaches the field inside a `<NumberInput>`, and a preset registered for `NumberInput`
still reaches no plain `<Input>`.

**What it costs you.** Nothing at a call site. A rule you wrote under a wrapper's name against
one of the axes above changes its answer — always to the answer the plain inner component
already gave, so the fix is to write the rule the way you would write it under `Input`,
`Select` or `Dialog`.

`wrapperActiveProps` is **removed** from the package root; a call to it is a compile error.
It only ever existed to build that stand-in condition object. If you wrote your own wrapper
with it, `resolveSlotClasses` is unchanged and still exported — hand it the condition object
you want matched instead of the helper's reconstruction:

<!-- typecheck -->
```ts
import {
  getBlocksConfig,
  getTierContext,
  resolveSlotClasses,
  inputVariants
} from '@urbicon-ui/blocks';

const config = getBlocksConfig();
const tierCtx = getTierContext();
const variant = 'outlined';
const size = 'md';
const disabled = false;
const error: string | undefined = undefined;
const leftIcon: unknown = undefined;
const tier: 'commit' | 'modify' | undefined = undefined;
const preset: string | undefined = undefined;
const slotClassesProp: Record<string, string> | undefined = undefined;

const slotClasses = resolveSlotClasses(
  config,
  'MoneyField',
  preset,
  // Was `wrapperActiveProps(inputVariants.config, { variant, size, disabled })`.
  // Name the axes you can speak for; the resolver answers the rest from the config.
  {
    variant,
    size,
    disabled,
    // The two coerced/derived axes are yours to compute — `error` is a `string`
    // prop and a boolean axis, `messageType` follows from it. `DatePicker` in
    // this package writes exactly this pair.
    error: !!error,
    messageType: error ? 'error' : 'helper',
    // `hasLeftIcon` is `!!leftIcon` inside Input — nothing else feeds it.
    hasLeftIcon: !!leftIcon,
    // And the tier context is public.
    tier: tier ?? tierCtx?.tier ?? 'modify'
  },
  slotClassesProp,
  inputVariants.config
);
```

**What you can still reach, and the two things you cannot.** The mechanism the library's own
wrappers now use is internal, but most of what it buys them is not: an axis the inner component
*derives from a value you hold* you can derive too, as above. `hasLeftIcon` belongs in that
group — it is `!!leftIcon` and nothing else feeds it, so a wrapper holding that prop writes the
axis exactly.

Two stay out of reach. `open` on `Select` is the inner component's own runtime state and nothing
above it can read it. `hasRightIcon` is the boundary case, and not for the reason it looks like:
with `clearable` set and a value present, Input renders a clear button, and that **creates** a
right icon where the wrapper passed none — measured, `<Input clearable value="x">` with no
`rightIcon` is `hasRightIcon: true`, so a wrapper writing `!!rightIcon` answers `false` for a
field that is `true`. Swapping a passed `rightIcon` *for* the clear button is not a divergence:
the axis reads `true` either way. For those two, register the rule under the inner component's
own name (`Input`, `Select`) and keep your wrapper's name for the unconditional `slotClasses`
and presets.

### Conditional `overrides` match the variants a component names

A `overrides` rule used to be matched against the raw object a component happened to hand the
resolver. It is now matched against that component's **effective** variants: every axis the
component names, at its value, or at its `tv()` config's `defaultVariants` value where it
named the axis but left it `undefined`.

**Rules that used to do nothing now fire**, and that is the point of the change. Counting
(component, prop) pairs over `disabled`, `readonly` and `error` — the three a project-wide
rule reaches for — the `false` side matched on **12 pairs before and 47 after**, across 27
components, with none lost. It was unmatchable on the other 35 because a component carried
`disabled: disabled || undefined` and the matcher saw no `disabled` at all. The same holds
for any axis a call site left at its default: `{ size: 'md' }` now matches a component
nobody passed a `size` to.

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

The two Stepper axes are renamed to the props they describe. **Two failure modes, neither of
them silent:**

- `stepperVariants({ stepState: … })` and the `StepperVariants` type are compile errors — both
  are exported, so TypeScript names the line.
- An `overrides` rule written as `{ stepState: 'active' }` still compiles: the index signature
  accepts any key. It stops matching, and a development build reports it:

```
[BlocksProvider] The `overrides` rule under defaults for component "Stepper" conditions on
"stepState", which is neither one of the variant props this rule is matched against nor an
axis of the `tv()` config behind them. Keys that can match here: orientation, size, variant,
tier, disabled, clickable. That config also declares optionalNote, state, separatorComplete,
handed to a slot function per element rather than carried per component; …
```

**Read the two lists as the different things they are.** `stepperVariants` declares `state`,
but `Stepper` hands it to a slot function per step rather than carrying it for itself — so
`{ state: 'active' }` under the `Stepper` key matches nothing either, and that rule belongs
under `StepperStep`. Only the keys after *"Keys that can match here"* are worth rewriting to.

The report needs the component to render under the provider, so a rule under a component that
no page you opened mounts stays quiet. Grep for `stepState` and `stepDisabled` across your own
source, including the string keys inside `defaults` / `presets`.

### `resolveSlotClasses()` takes the component's `tv()` config

Only affects you if you wrote your own wrapper around a blocks component; the components
themselves are updated. The call gains a required sixth argument, so an old five-argument call
is a compile error rather than a silent behaviour change:

```svelte
<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '@urbicon-ui/blocks';
  import { inputVariants } from '@urbicon-ui/blocks';

  const config = getBlocksConfig();
  const slotClasses = $derived(
    resolveSlotClasses(
      config,
      'MoneyField',
      preset,
      { variant, size, disabled },
      slotClassesProp,
      inputVariants.config // ← new: the config the axes above belong to
    )
  );
</script>
```

Pass the config the condition object's axes come from — for a wrapper that is the **inner**
component's config. Nothing checks that pairing, so a mismatched config silently matches rules
against the wrong axes.

### Sparkline took the charts' slot names

Two `slotClasses` keys on `<Sparkline>` are spelled differently. `root`, `svg` and `area` are
unchanged.

| before | after | reaches |
| --- | --- | --- |
| `line` | `mark` | the stroked trend path |
| `point` | `endPoint` | the one dot at the last value, drawn with `showEndPoint` |

```svelte
<!-- before -->
<Sparkline data={values} area showEndPoint
  slotClasses={{ line: 'opacity-70', point: 'stroke-surface-base stroke-[2px]' }} />
```

```svelte
<!-- after -->
<Sparkline data={values} area showEndPoint
  slotClasses={{ mark: 'opacity-70', endPoint: 'stroke-surface-base stroke-[2px]' }} />
```

`mark` is what `<LineChart>` and `<AreaChart>` already call their stroked series path, so a
sparkline and a line chart now take the same key for the same thing. One place it does not
carry over unchanged: on `<AreaChart>` `mark` is folded onto the filled band as well as the
top edge, so an entry there reaches two paths per series — use `areaOutline` for the edge
alone and `area` for the band. A sparkline's `mark` reaches the trend path only; its band is
`area`.

The end marker did **not** become `point`. On a chart `point` is one circle per series *and*
datum under `showPoints` — three series over twelve values is 36 circles — while on a
sparkline it is a single circle at the last value. Reusing the word would have made a class
written for one read as portable to the other while landing on a different number of
elements, and nothing reports that: the key resolves either way.

**Five places can carry a slot key, and written inline every one of them is reported.** Each
old key fails against the same slot names: `'line' does not exist in type
'Partial<Record<SparklineSlots, string>>'`. Measured, all five:

| where the key sits | written inline | reached through a variable |
| --- | --- | --- |
| the `slotClasses` prop | error | only if no key is in common |
| `defaults={{ Sparkline: { slotClasses } }}` | error | only if no key is in common |
| `defaults={{ Sparkline: { overrides } }}` (its `class` record) | error | only if no key is in common |
| `presets={{ Sparkline: { … : { slotClasses } } }}` | error | only if no key is in common |
| `presets={{ Sparkline: { … : { overrides } } }}` | error | only if no key is in common |

The second column is one rule, not five: a target whose properties are all optional rejects
only an object with *no* key in common, and the excess-property check that catches a wrong key
*beside* a right one applies to a fresh object literal. So `{ root, line, point }` written into
the attribute is an error, and the same object held in a `const` is not. One form is quieter
still — a `const` annotated `Record<string, ComponentDefaults>` or `PresetMap` reports nothing
at all; see the table under
[`<BlocksProvider>` slot names are checked against the component](#blocksprovider-slot-names-are-checked-against-the-component).

**One grep finds all five: `Sparkline`.** Not `Sparkline:` — a formatter set to
`quoteProps: "consistent"` quotes every key in an object as soon as one of them needs it, so
your provider config may well read `'Sparkline':`, and a computed `[SPARKLINE]:` key misses
too. And not `slotClasses`, which never appears in an `overrides` rule: those write `class:`.

The four provider rows are also why grepping your markup alone is not enough for the cases the
second column lets through. That config sits under the string key `'Sparkline'`, nowhere near a
`<Sparkline>` tag.

A development build reports all five for you. The component checks the *resolved* slot map,
downstream of every source, and warns when a sparkline mounts with a stale key in reach:

```
[Sparkline] slotClasses.line no longer resolves: `line` is now `mark`, `point` is now
`endPoint`. Check the instance prop and any <BlocksProvider> defaults, presets or overrides
under the 'Sparkline' key.
```

The check runs at mount. Changing a provider config under an already-mounted sparkline
restyles it without warning again, so re-mount — or reload — after editing one. Production
builds drop the check entirely.

Reading the *resolved* map is what buys the four provider rows, and it is also the check's one
blind spot: a stale key inside an `overrides` rule is only in the resolved map when that rule
**matches**. A rule whose condition is never true carries its stale key silently — measured,
by keying one on an axis `Sparkline` does not name. That costs nothing here, because the rule
does nothing either; but it means the warning answers "a stale key is reaching this
sparkline", not "your config has no stale keys". The grep above is what answers the second.

## 8.14.0

### `class` is its own source in the class fold

An instance `class` and a `slotClasses` entry that reach the same element used to land in the
attribute together, and the stylesheet's emit order decided which one painted. `class` is now
the strongest source of the cascade (`defaults.slotClasses → … → instance.slotClasses → class`)
in its own right: where the two collide in the same Tailwind bucket, only the `class` one
survives.

```svelte
<EmptyState class="py-4" slotClasses={{ base: 'py-8' }} />
<!-- 8.13: class="… sm:py-20 py-8 py-4" — the stylesheet decides -->
<!-- 8.14: class="… sm:py-20 py-4"      — py-8 is stripped -->
```

**Nothing reports this.** Both props type-check exactly as before, and the resolver drops a
stripped class without a word; the only signal is visual, on an element that carried both. Grep
for `class=` beside `slotClasses=` on the same element, `class={` included. A `slotClasses`
entry that reaches the element through a `<BlocksProvider>` `defaults` or `presets` block is
folded into the same resolved record before `class` meets it, so an instance `class` strips it
the same way — that pair does not show up in the markup grep. Where the two collide, the value
you see now is the `class` one; if it was the other you wanted, move it into `class` or drop the
`class` half.

Within one prop nothing changed: `class="rounded-md rounded-t-none"` is still one source, so an
author-paired set survives, and so does a `slotClasses` string with two classes in one bucket.

**Restart the dev server after upgrading.** A server that was already running keeps serving
what it already transformed — the pre-bundle in `node_modules/.vite` on the client, its module
cache on the server — so the old fold stays in effect until you restart it.

### An instance `unstyled` reaches the components it renders

`<DatePicker unstyled>` stripped its own root and left the `<Input>` it renders with every
default class, where `<BlocksProvider unstyled>` stripped both. Every component that declares
`unstyled` and renders another public component now forwards the flag, so the instance flag and
the provider flag remove the same thing. `<Skeleton unstyled>` also lost its `gap-2`: the gap
moved into the slot base so that a documented instance prop no longer loses to a provider
default, and `unstyled` now removes it like every other default.

**Nothing reports this either** — the flag type-checks as before, and the embedded control
simply renders bare. Grep for `unstyled` on `DatePicker`, `DateRangePicker`, `ConfirmDialog`,
`Pagination`, `Menu`, `CommandPalette`, `FileUpload`, `AvatarGroup`, `Guide`, `CalendarHeader`,
`PlannerHeader`, `ResourceTimelineHeader`, the Chat family (`ChatMessage`, `ChatMessageList`,
`CitationChip`, `ReasoningDisclosure`, `ToolCallCard`, `A2UIView`) and on `Skeleton`. If the
embedded control was meant to keep its look, write the classes you want back through
`slotClasses`, or hand the control in as `children` where the component takes them — the flag
never reaches those.

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
