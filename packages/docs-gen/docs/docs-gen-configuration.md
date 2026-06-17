# docs-gen Configuration Notes (V2)

## SvelteOutputConfig

- `outputDir`: target directory for generated component pages.
- `packageTargetMap?`: optional mapping from package name to sub-folder inside `outputDir`.
- `routeBasePath?`: base path used to construct internal links to component pages (default: `/components`).
  - Used by API data generator to build `seeAlso` links to `/${routeBasePath}/<component-slug>#api`.

## Enrichment

- Cross-references are embedded directly into API data as `seeAlso` URLs for `PropInfo`.
- Supported link resolutions:
  - Component or `*Props` → `${routeBasePath}/<slug>#api`.
  - Local types (from LocalTypesExtractor) → `${routeBasePath}/<slug>#type-<TypeName>`
  - Svelte built-ins: `Snippet`, `ComponentEvents` → official Svelte docs.
  - HTML attribute types: `HTML*Attributes` → MDN per element.
  - Urbicon tokens: `ComponentIntent`, `ComponentSize`, `MintProp` → internal docs anchors.

## Removed components

- `ExampleValidator` and `CrossReferenceResolver` removed in V2 (Hybrid-Architektur).
  - Deterministische Beispiele werden vom Generator erzeugt; keine Section-Parsing-Validierung mehr.
  - Cross-Referencing erfolgt im `APIDataGenerator` via `seeAlso`.

## Stats
## Types Section

- If local types are detected for a component, an additional `Types` section is rendered automatically.
- The section lists exported `type`/`interface` definitions with code blocks and anchor IDs `type-<Name>`.
- Prop type links (`seeAlso`) to local types will jump to these anchors.


- `enrichedComponents` übernehmen Statistikwerte aus `apiData` (Single Source of Truth).


## API Reference UI (V2)

- Badges in der Namen-Spalte kennzeichnen die Quelle einer Property: `direct`, `variant`, `inherited`.
- Für Variant-Props werden verfügbare Werte im Typ-Feld zusätzlich in einer zweiten Zeile angezeigt.
- Die vollständige Werteliste ist als nativer Tooltip (`title`) hinterlegt.
- `defaultVariants` aus der `tv()`-Config werden als `defaultValue` in der "Default"-Spalte angezeigt.
- Typnamen können über `seeAlso` verlinkt sein (z. B. auf lokale `#type-<Name>`-Anker).
