/**
 * The package barrel, as a type. Nothing is imported at runtime — `typeof
 * import(…)` is a type query, so this file emits no code and adds no edge to
 * the module graph a bundler walks.
 */
type Blocks = typeof import('../index.js');

/**
 * A component's own `slotClasses` keys; `never` for anything that is not one.
 *
 * Matched on the call signature Svelte 5 gives a component — `(internal, props)`
 * — rather than on `Component<any, any, any>`, whose `Exports` and `Bindings`
 * arguments have to be widened to `any` to admit all of them. The `slotClasses`
 * clause is what narrows the match: a plain two-argument function reaches it and
 * then yields `never`, which drops it from the map.
 */
type SlotKeysOf<C> = C extends (internal: never, props: infer P) => unknown
  ? P extends { slotClasses?: infer S }
    ? keyof NonNullable<S> & string
    : never
  : never;

/**
 * Which slot names each component name admits, so that a component narrowing
 * its `slotClasses` prop narrows the same names written through the provider.
 *
 * Both halves are read off the components: the key is the identifier the package
 * barrel exports the component under, the value is the key set of that
 * component's own `slotClasses` prop. Neither can be edited into disagreement
 * with the component, which is the point — `<LineChart slotClasses={{ arc: … }}
 * />` and `defaults={{ LineChart: { slotClasses: { arc: … } } }}` now fail for
 * one reason rather than the first alone.
 *
 * **Deliberately not read from the `tv()` configs.** `SlotNames<typeof
 * xVariants>` answers "what does this config declare", which is a different
 * question, and a differently answered one for 23 of the 88 components that
 * resolve a cascade. 19 have no `xxxVariants` export to reach by that name at
 * all — the five charts among them, one `chartVariants` feeding all five and so
 * naming every chart's slots for each. Four more disagree where both exist:
 * `Popover` and `Separator` hand over a config carrying no `slots`, whose call
 * returns `string` and makes `keyof` the String prototype; `SegmentGroup`
 * excludes `item`, which `SegmentItem` owns; and `SidebarLayout` names five
 * `sidebar*` keys its config never declares. A config-read map would report
 * correct consumer configuration as a typo in every one of them.
 *
 * **The one link not derived** is the string literal a component hands
 * `resolveSlotClasses` / `setWrapperCascade`. It is the export name for all 88,
 * and `component-slots.test.ts` holds it there; a component that passed a
 * different one would fall to the permissive branch of {@link SlotOf} and go
 * unchecked with no error to say so.
 */
export type ComponentSlotMap = {
  [K in keyof Blocks as [SlotKeysOf<Blocks[K]>] extends [never] ? never : K]: SlotKeysOf<Blocks[K]>;
};

/**
 * The slot names a provider entry under `K` may write.
 *
 * A name the library does not know widens to `string`, which is what keeps a
 * consumer's own wrapper working: `resolveSlotClasses(config, 'MoneyField', …)`
 * is a documented path (COMPONENT-API-CONVENTIONS.md → "Writing your own
 * wrapper"), and its slot names live in that consumer's markup, where nothing
 * here can see them.
 *
 * Not distributive: `[K] extends [keyof …]` keeps a union key from being taken
 * apart, so a `Record<string, …>` handed to the provider stays the permissive
 * case instead of resolving per member.
 */
export type SlotOf<K> = [K] extends [keyof ComponentSlotMap] ? ComponentSlotMap[K] : string;
