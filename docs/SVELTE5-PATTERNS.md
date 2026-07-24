# Svelte 5 — Patterns & Anti-Patterns

Mandatory best practices for the Urbicon UI codebase. This file is the detailed reference for the short section in [`AGENTS.md`](../AGENTS.md#svelte-5--mandatory-patterns).

> **Context:** The review found five recurring anti-patterns (`Math.random()` IDs, `setContext('string')`, `$state(new Map())`, index keys, `class:foo`) in an otherwise fully Svelte-5-migrated codebase. All were fixed — this file prevents regressions. Sources: official Svelte 5 documentation (`mcp__svelte__get-documentation`) + [REVIEW-2026-05.md](archive/2026-05/REVIEW-2026-05.md) phase 5 + appendix A.

## Anti-Patterns (do NOT do)

| Pattern                                                                                                                           | Replacement                                                          | Severity |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| `$:` reactive blocks                                                                                                              | `$derived` / `$effect`                                               | 🔴       |
| `export let foo`                                                                                                                  | `let { foo } = $props()`                                             | 🔴       |
| `$$props` / `$$restProps`                                                                                                         | `let { ...rest } = $props()`                                         | 🔴       |
| `on:click={handler}`                                                                                                              | `onclick={handler}`                                                  | 🔴       |
| `Math.random()` for IDs                                                                                                           | `$props.id()` (see below)                                            | 🔴       |
| `<slot />` / `$$slots` / `<svelte:fragment>`                                                                                      | `{@render children()}` + snippets                                    | 🟠       |
| Stores from `svelte/store` for component state                                                                                    | `class { … = $state(...) }`                                          | 🟠       |
| `setContext('string', …)` (≥ 5.40)                                                                                                | `createContext<T>()`                                                 | 🟠       |
| `$state(new Map())` / `$state(new Set())`                                                                                         | `new SvelteMap(...)` / `new SvelteSet(...)` from `svelte/reactivity` | 🟠       |
| Index as key in `{#each}`                                                                                                        | Stable unique key (ID, ISO date, slug)                              | 🟠       |
| State sync via `$effect` (`foo = bar` inside the effect)                                                                          | `$derived`                                                           | 🟠       |
| `if (browser)` inside `$effect`                                                                                                   | `$effect` runs client-only — the guard is redundant                 | 🟠       |
| `<svelte:component this={X}>`                                                                                                     | `<X />` (Svelte 5 allows dynamic components directly)               | 🟡       |
| `<svelte:self>`                                                                                                                   | `import Self from './ThisComponent.svelte'`                          | 🟡       |
| `use:action`                                                                                                                      | `{@attach …}`                                                        | 🟡       |
| `class:foo={bar}`                                                                                                                 | Array/object in `class={[...]}`                                      | 🟡       |
| `onMount + addEventListener('window', …)`                                                                                         | `<svelte:window onkeydown={…}>`                                      | 🟡       |
| `onMount + matchMedia(…)`                                                                                                         | `new MediaQuery('(...)')` from `svelte/reactivity`                   | 🟡       |
| `console.log($state(...))`                                                                                                        | `$inspect(...)` or `$state.snapshot(...)`                            | 🟡       |
| Late-init singleton (`export const x = new ReactiveClass()`) dereferenced from another module at **module eval** time            | Lazy getter + hoisted function export + proxy facade (see below)    | 🟠       |

## Positive Patterns (do!)

- `let { value = $bindable(false) } = $props()` — two-way binding with a default
- `$derived(expression)` for computed values; `$derived.by(() => …)` for multi-line computations
- `$effect(() => { …DOM…; return () => /* cleanup */; })` — use `onMount` only when the effect truly needs to run exactly once at mount time
- `<script lang="ts" generics="T extends …">` for generic components
- `Snippet<[ArgType]>` for typed snippets
- Class with a `$state` field + `get` properties for compound state (role model: `overlay-stack.svelte.ts`)
- `createContext<T>()` (≥ 5.40) — no string keys
- `<svelte:window onkeydown={…}>`, `<svelte:document>`, `<svelte:head>` for global listeners
- `<svelte:boundary failed={…} pending={…}>` for error/loading boundaries
- `untrack(() => …)` _deliberately_ against effect loops, never as a workaround for broken state

## Library-specific obligations

### IDs — `$props.id()` with the two-step pattern

`$props.id()` may **only** appear as a top-level initializer (`const foo = $props.id()`). Inside a `$props()` destructuring, a template literal, or a function call, the compiler reports `props_id_invalid_placement`.

In components with consumer-passable `id`/`name` props, the two-step pattern is therefore **always** mandatory:

```svelte
<script lang="ts">
  let { id: idProp, name: nameProp, ... }: FooProps = $props();
  const propsId = $props.id();
  const fieldId = $derived(idProp ?? `foo-${propsId}`);
  const labelId = $derived(`${fieldId}-label`);
</script>
```

Never use `Math.random()`, `Date.now()`, or a module-global `let counter = 0` for SSR-relevant IDs — otherwise the consumer gets a hydration mismatch.

### Reactive collections from `svelte/reactivity`

| Instead of                         | Use                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `$state(new Map())`                | `import { SvelteMap } from 'svelte/reactivity'; new SvelteMap()`                                                                      |
| `$state(new Set())`                | `import { SvelteSet } from 'svelte/reactivity'; new SvelteSet()`                                                                      |
| `$state(new Date())`               | `import { SvelteDate } from 'svelte/reactivity'; new SvelteDate()`                                                                    |
| `$state(new URL(...))`             | `import { SvelteURL } from 'svelte/reactivity'; new SvelteURL(...)`                                                                   |
| `onMount + matchMedia(...)`        | `import { MediaQuery } from 'svelte/reactivity'; new MediaQuery('(max-width: 1023px)')` — `query.current` is a reactive `boolean`     |
| `onMount + window-resize-listener` | `import { innerWidth, innerHeight } from 'svelte/reactivity/window'`                                                                  |

Role models in the repo: `Tab.svelte` (`SvelteMap`), `Calendar.svelte` (`SvelteMap`), `Sidebar.svelte` + `Pagination.svelte` (`MediaQuery`, instance-local — deliberately chosen over the module-global `svelte/reactivity/window`).

### Context — `createContext<T>()`, no string keys

```ts
// foo.context.ts
import { createContext } from 'svelte';

export const fooContext = createContext<{
  selected: string;
  select: (id: string) => void;
}>('foo'); // optional debug name

// compound parent:
fooContext.set(value);

// compound child:
const ctx = fooContext.get();
```

`setContext('string-key', …)` / `getContext('string-key')` are forbidden:

1. Magic strings, no compile-time check
2. Type casts (`getContext<T>('foo')`) are unsafe
3. Refactor-hostile (rename does not propagate)

Role models: `Tab/tab.context.ts`, `Accordion/accordion.context.ts`, `Stepper/stepper.context.ts`, `RadioGroup/radioGroup.context.ts`, `SegmentGroup/segmentGroup.context.ts`, `Menu/menu.context.ts`.

#### `createContext` vs. `createOptionalContext`

`createContext<T>()` from `svelte` is the right choice **when the child makes no sense without a parent** (compound pattern). The getter throws `missing_context`, which narrows the return type — a subsequent `ctx.value` is guaranteed to be present.

`createOptionalContext<T>()` from `packages/blocks/src/lib/utils/optional-context.ts` is the right choice **when the child works both with and without a parent**. The getter returns `T | undefined` without throwing — the typical pattern for opt-in wrappers whose presence enriches behavior but is not required:

| Compound pattern (mandatory parent) | Opt-in pattern (optional parent)                      |
| ----------------------------------- | ----------------------------------------------------- |
| `Tab` → `TabItem`                   | `BlocksProvider` → any component (presets, defaults)  |
| `Accordion` → `AccordionItem`       | `IconProvider` → `Icon` (registry override)           |
| `RadioGroup` → `RadioItem`          | `ButtonGroup` → individual `Button` (selection state) |
| `Stepper` → `StepperItem`           | `Calendar` → `CalendarDay` (read-only style context)  |

```ts
// menu.context.ts — compound, throws without a parent
import { createContext } from 'svelte';
export const menuContext = createContext<MenuContextValue>('menu');

// buttonGroup.context.ts — opt-in, undefined without a parent
import { createOptionalContext } from '$lib/utils/optional-context';
export const [getButtonGroupContext, setButtonGroupContext] =
  createOptionalContext<ButtonGroupContextValue>();
```

Rule of thumb: **if the parent's existence already follows from the DOM structure (same file, same component family) → `createContext`. If the parent is a free-standing wrapper the consumer may omit → `createOptionalContext`.** Role models in the repo: `provider/blocks-context.ts`, `primitives/ButtonGroup/buttonGroup.context.ts`, `primitives/Menu/menu.context.ts` (parent value for nested menus), `icons/icon.context.ts`.

### Module-global singletons — avoid eval-time access across module boundaries

A module-global reactive singleton is **fine in itself** — `export const overlayStack = new OverlayStack()`, `toaster`, `mintRegistry` are role models. **One specific combination** becomes dangerous: a late-init singleton (`export const x = new ReactiveClass()`, often at the end of the module) that **another** module dereferences **during its own module eval** — typically an eager registration side effect required for SSR correctness:

```ts
// Dangerous form — i18n had exactly this before WP2 (now solved via getRegistry()):
// my-service.svelte.ts
export const svc = new ReactiveService(); // at end of module → late init

// consumer/index.ts
export const x = createThing('x'); // TOP-LEVEL → svc.register(...) during module eval
```

Under **Vite 8 / Rolldown** the bundler may split statically and dynamically imported modules into chunks such that the consumer side effect runs **before** the singleton chunk. Result (only in the **prod build in the browser**, not in `vite dev`, not in the build exit code):

- `Cannot read properties of undefined (reading 'registerPackage')` — the `const` binding is still in the TDZ/undefined, **or**
- `X is not a constructor` — the reactive class (`SvelteMap`, `ReactiveValue`) in the singleton's constructor is not yet initialized in the chunk order.

**The nuance:** singletons consumed **lazily only** (in component scripts, `$derived`, event handlers — i.e. at render time, after module eval) are safe. `overlayStack`/`toaster` are used exactly this way → not a concern. The trigger is solely **eval-time access from a foreign module**.

**Fix — the core is part 1, the hoisted lazy getter** (role model `packages/i18n/src/lib/i18n/registry.svelte.ts`, `getRegistry()`). **Part 2 (the proxy facade) is optional** — only needed when a value-import API (`import { x }`) must be preserved; i18n removed it in WP2 along with the public singleton, and the registry is now purely internal (only `getRegistry()`):

```ts
// 1. Lazy getter as a HOISTED function declaration — defers the `new` (including
//    its inner SvelteMap/SvelteSet) to first access and is available as a function
//    from module start (a const would be in the TDZ until its line).
let _svc: MyService | undefined;
export function getMyService(): MyService {
  return (_svc ??= new MyService());
}

// 2. Proxy facade: `import { myService }` stays a value (API compat). Bind methods
//    in the get trap to the instance (internal `this`); getters dispatch
//    synchronously so a $state read in `$derived(myService.foo)` stays tracked.
export const myService: MyService = new Proxy({} as MyService, {
  get(_t, p) {
    const inst = getMyService();
    const v = inst[p as keyof MyService];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(inst) : v;
  }
});

// 3. Eval-time access paths (registration) go through getMyService(), NOT through
//    the `myService` const — the hoisted function survives chunk reordering.
export const t = (...a: Parameters<MyService['t']>) => getMyService().t(...a);
```

A characterization test **before** the rework is mandatory when the service is untested — otherwise you refactor resolution/fallback behavior blindly (role model: `packages/i18n/src/lib/i18n/registry.test.ts` + `reactivity.svelte.test.ts`).

### `{@attach}` instead of `use:`

`use:action` is deprecated in 5.x. Migration:

```svelte
<!-- Old -->
<div use:swipeable={{ onSwipeLeft }} />

<!-- New -->
<div {@attach swipeable({ onSwipeLeft })} />
```

Action definitions accordingly move from `(node, params) => { … return { destroy } }` to `(params) => (node) => { … return () => /* cleanup */ }`. Reactivity per attach is the default — restrict it deliberately with `untrack(...)` when needed.

### Stable keys in `{#each}`

```svelte
<!-- ❌ Index key — breaks on reorder/insert -->
{#each items as item, i (i)}

<!-- ✅ Stable key -->
{#each items as item (item.id)}

<!-- ✅ Composite for duplicate slugs -->
{#each links as link, i (`${link.source.id}-${link.target.id}-${i}`)}

<!-- ✅ Date-based (Calendar) -->
{#each days as day (day.toISOString())}
```

Exception: purely static skeletons with `Array(count)` — here the index is semantically the correct stable key (no per-item state).

## Top 5 code smells (grep targets)

For future reviews and pre-merge checks:

```bash
# 1. Math.random for IDs (🔴) — expect 1 hit: utils/id.ts (documented non-component fallback, not a violation)
rg "Math\.random\(\)" packages/

# 2. setContext with a string key (🟠)
rg "setContext\(['\"]" packages/

# 3. Reactive Map/Set without SvelteMap/SvelteSet (🟠)
rg "\\\$state\(new (Map|Set)\(" packages/

# 4. class:foo directives (🟡)
rg "class:[a-z][a-zA-Z]*=" packages/

# 5. Index-as-key (🟠)
rg "\(\s*i\s*\)\s*\}" packages/ -t svelte
```

## Role models in the repo

| Pattern                                                                   | Role-model file                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Class with a `$state` field + **lazily consumed** singleton + `untrack`   | `packages/blocks/src/lib/utils/overlay-stack.svelte.ts`                   |
| Hoisted lazy getter (bundler-order-tolerant, for eval-time registration)  | `packages/i18n/src/lib/i18n/registry.svelte.ts` (`getRegistry()`)         |
| `createContext<T>()` for compounds                                        | `packages/blocks/src/lib/primitives/Tab/tab.context.ts`                   |
| `SvelteMap` + reactive `$effect`                                          | `packages/blocks/src/lib/primitives/Tab/Tab.svelte`                       |
| `MediaQuery` from `svelte/reactivity` (instance-local, deliberately over `svelte/reactivity/window`) | `Sidebar/Sidebar.svelte`, `Pagination/Pagination.svelte`               |
| Generic component                                                         | `packages/blocks/src/lib/primitives/Combobox/Combobox.svelte`             |
| `$props.id()` two-step pattern                                           | every primitive with an `id` prop (e.g. `Checkbox`, `RadioItem`, `FormField`) |
