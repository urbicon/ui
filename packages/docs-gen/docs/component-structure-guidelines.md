# Component Structure & JSDoc Guidelines (docs-gen)

For the full component structure standard (folder layout, index.ts pattern, variants.ts pattern, compound components, JSDoc quality, example guidelines), see the authoritative reference:

**[docs/ComponentStructureStandard.md](../../../docs/ComponentStructureStandard.md)**

## docs-gen Specific Notes

The following conventions ensure reliable, generic extraction by docs-gen without hardcoding.

### Variants File (`tv()`)

- `defaultVariants` must be defined (no hidden defaults outside the file)
- Naming: `const <Component>Variants = tv({...})` or `variants`
- Export: `type <Component>Variants = VariantProps<typeof <Component>Variants>`
- Compound variants are supported; they are not separately displayed at this time

### Props Interfaces

- Interface name: `<Component>Props`
- Inheritance: `extends <Component>Variants`, then `extends Omit<...>` for local props minus variant keys, then HTML attributes
- JSDoc per property: 1-2 sentence description, `@default` if applicable (must be consistent with `defaultVariants`), `@since` for new/moved fields, `@see` for links

### Documentation Links

- External: `@see https://...`
- Internal types: linked automatically (local types → `#type-<Name>`)
- HTML attributes: MDN link added automatically
- Svelte built-ins (`Snippet`, `ComponentEvents`) are linked automatically

### Anti-Patterns

- No heuristics for defaults outside the `tv()` file
- No state synchronization via effects – in Svelte 5, use reactive state directly in context
- No hidden re-exports without actual definitions (extractors do not follow re-exports in V2)
