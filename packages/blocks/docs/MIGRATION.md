# Migrating `@urbicon-ui/blocks`

Breaking changes to the component library, newest first: what moved, what it costs you, and —
where nothing reports the change — what to grep for before you ship.

Only this package. The table's v8 view-state rewrite has its own guide,
[MIGRATION-V8.md](https://github.com/urbicon/ui/blob/main/packages/table/docs/MIGRATION-V8.md),
and ships in the `@urbicon-ui/table` tarball.

## v9

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

**Only one of the four places you can write a slot key is type-checked.** Inline at the call
site, both old keys are a compile error: `slotClasses={{ line: … }}` fails with `'line' does
not exist in type 'Partial<Record<SparklineSlots, string>>'`. The other three were measured
at zero errors:

| where the key sits | why nothing reports it | what to grep for |
| --- | --- | --- |
| a slot map held in a variable | a target whose properties are all optional rejects only an object with *no* key in common, so `{ root, line, point }` passes | `slotClasses` near your sparklines |
| `<BlocksProvider defaults={{ Sparkline: … }}>` | `ComponentDefaults['slotClasses']` is `Record<string, string>` | `Sparkline:` in your provider config |
| `<BlocksProvider presets={{ Sparkline: … }}>` | `ComponentPreset['slotClasses']` is `Record<string, string>` | `Sparkline:` in your provider config |
| a prop-conditional `overrides` rule | `ConditionalOverride['class']` is `Record<string, string>` | `Sparkline:` in your provider config |

The three provider rows are why "grep your markup" is not enough on its own: that config sits
under the string key `'Sparkline'`, and never next to a `<Sparkline>` tag.

A development build reports all four for you. The component checks the *resolved* slot map —
downstream of the instance prop, the defaults, the preset and the overrides alike — and warns
once for each sparkline the stale key reaches:

```
[Sparkline] slotClasses.line no longer resolves: `line` is now `mark`, `point` is now
`endPoint`. Check the instance prop and any <BlocksProvider> defaults, presets or overrides
under the 'Sparkline' key.
```

Production builds drop the check.

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
