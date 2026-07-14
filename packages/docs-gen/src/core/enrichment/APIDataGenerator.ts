import type {
  ComponentInfo,
  ComponentStability,
  ComponentStats,
  InheritanceInfo,
  PropInfo,
  VariantInfo
} from '@urbicon-ui/shared-types';
import type { APIData, ComponentAPIData, TypeDefinition } from '../../types';

/**
 * Generates structured API data from enriched component information
 * This is the core of the enrichment phase - converts extraction results to API format
 */
export class APIDataGenerator {
  /**
   * Codeberg (Gitea) source base URL for `sourceHref` construction.
   * Hardcoded rather than derived from a `package.json` repository
   * field because the root-level package has no `repository` entry
   * and only two sub-packages do (`shared-types`, `docs-gen`);
   * deriving from those would couple the link to whichever package
   * happened to be checked first.
   *
   * Gitea/Codeberg URL pattern is `<repo>/src/branch/<branch>/<path>`
   * for source view. We pin to `main` rather than `HEAD` because
   * Codeberg's path resolver does not currently accept `HEAD` as a
   * branch placeholder — if the default branch is ever renamed, this
   * constant has to move with it.
   *
   * If the repo ever moves, change this constant.
   */
  private static readonly SOURCE_BASE_URL = 'https://codeberg.org/urbicon/ui/src/branch/main';

  private generatedTypes = new Set<string>();
  private typeDefinitions: TypeDefinition[] = [];
  private componentSlugs = new Map<string, string>();
  private componentGroups = new Map<string, string | undefined>();
  private routeBasePath: string = '/components';

  /**
   * Generate complete API data structure from rich components
   */
  async generate(
    richComponents: ComponentInfo[],
    options?: { routeBasePath?: string }
  ): Promise<APIData> {
    console.log(`📊 Generating API data for ${richComponents.length} components`);

    const startTime = Date.now();
    const components: Record<string, ComponentAPIData> = {};

    // Reset state for new generation
    this.generatedTypes.clear();
    this.typeDefinitions = [];
    this.componentSlugs.clear();
    this.componentGroups.clear();
    this.routeBasePath = options?.routeBasePath || '/components';

    // Prepare component slugs + groups for linking. The group (primitives /
    // components / undefined) is what turns the flat base into the real route
    // segment — cross-links resolve the *target* component's group, so the
    // whole map has to be built up-front, before any component is processed.
    for (const c of richComponents) {
      this.componentSlugs.set(c.name, this.toSlug(c.name));
      this.componentGroups.set(c.name, this.inferGroupFromPath(c.filePath || ''));
    }

    // Process each component
    for (const component of richComponents) {
      try {
        console.log(`  🔍 Processing ${component.name}...`);

        const apiData = await this.generateComponentAPIData(component);
        components[component.name] = apiData;

        console.log(
          `  ✅ ${component.name}: ${apiData.props.length} props, ${apiData.variants.length} variants`
        );
      } catch (error) {
        console.error(`  ❌ Failed to process ${component.name}:`, error);
        // Continue with other components - create minimal API data
        components[component.name] = this.createFallbackAPIData(component);
      }
    }

    // Generate metadata
    const metadata = {
      generated: new Date().toISOString(),
      version: '2.0.0',
      totalComponents: Object.keys(components).length,
      totalProps: Object.values(components).reduce((sum, comp) => sum + comp.props.length, 0),
      generator: 'docs-gen'
    };

    const duration = Date.now() - startTime;
    console.log(`📊 API data generation complete in ${duration}ms`);
    console.log(
      `   📈 ${metadata.totalComponents} components, ${metadata.totalProps} total props, ${this.typeDefinitions.length} type definitions`
    );

    return {
      components,
      types: this.typeDefinitions,
      metadata
    };
  }

  // ==========================================
  // COMPONENT API DATA GENERATION
  // ==========================================

  private async generateComponentAPIData(component: ComponentInfo): Promise<ComponentAPIData> {
    // Process props with cross-references and categorization
    const processedProps = await this.processProps(component.props, component);

    // Surface `Omit<XVariants, 'a' | 'b'>` decisions from PropsExtractor.
    // Marker props with name `__OMIT_VARIANT__<key>` are extracted from
    // the props list here and used to filter the variants pass below, so
    // the keys never enter the public API surface (they're also stripped
    // from the merged output).
    const omittedVariantKeys = new Set<string>();
    for (let i = processedProps.length - 1; i >= 0; i--) {
      const prop = processedProps[i];
      if (prop?.name.startsWith('__OMIT_VARIANT__')) {
        omittedVariantKeys.add(prop.name.slice('__OMIT_VARIANT__'.length));
        processedProps.splice(i, 1);
      }
    }

    // Process variants with examples and categorization, then drop those
    // explicitly omitted via `extends Omit<XVariants, '...' | '...'>`.
    const allProcessedVariants = await this.processVariants(component.variants, component);
    const processedVariants = allProcessedVariants.filter((v) => !omittedVariantKeys.has(v.name));

    // Expose variants as API props (so API table shows available variant options)
    // Deduplicate: only add variant props that don't already exist from TypeScript extraction
    const variantPropsAsProps = this.createVariantPropsForAPI(processedVariants, component);
    const existingPropNames = new Set(processedProps.map((p) => p.name));
    const newVariantProps = variantPropsAsProps.filter((p) => !existingPropNames.has(p.name));
    processedProps.push(...newVariantProps);

    // Process inheritance with resolution and flattening
    const processedInheritance = await this.processInheritance(component.inheritance, component);

    // Integrate and enrich local types if present on component (produced by extraction)
    const compWithLocalTypes = component as unknown as { localTypes?: unknown };
    const localTypeDefs: TypeDefinition[] = Array.isArray(compWithLocalTypes.localTypes)
      ? (compWithLocalTypes.localTypes as TypeDefinition[])
      : [];
    if (localTypeDefs.length > 0) {
      // Reverse index: which props reference which local types
      const usedByMap = new Map<
        string,
        Array<{ component: string; propName: string; source: string }>
      >();
      const considerProps = [
        ...processedProps,
        ...processedInheritance.flatMap((inh: InheritanceInfo) => inh.props || [])
      ];
      for (const p of considerProps as (PropInfo & {
        type?: string;
        name?: string;
        source?: { type?: string };
      })[]) {
        const base = this.getBaseType(p.type || '');
        if (!base) continue;
        if (localTypeDefs.some((t) => t.name === base)) {
          const list = usedByMap.get(base) || [];
          list.push({
            component: component.name,
            propName: p.name,
            source: p?.source?.type || 'direct'
          });
          usedByMap.set(base, list);
        }
      }

      for (const td of localTypeDefs as (TypeDefinition & {
        scope?: string;
        usedByProps?: unknown[];
        usedByCount?: number;
        category?: string;
      })[]) {
        // annotate scope/category and usedBy — the extractor marks
        // program-resolved definitions as 'imported'; everything else is local
        td.scope = td.scope ?? 'local';
        td.usedByProps = usedByMap.get(td.name) || [];
        td.usedByCount = Array.isArray(td.usedByProps) ? td.usedByProps.length : 0;
        const defStr = String(td.definition || '');
        // `SlotNames<…>` aliases (`XSlots`) are tv()-machinery like the
        // `VariantProps<…>` aliases — categorized 'variant' so type surfaces
        // (llm.txt Types section) list business types only.
        const looksLikeVariant =
          defStr.includes('VariantProps<') ||
          defStr.includes('SlotNames<') ||
          /Variants?$/.test(td.name) ||
          /Slots$/.test(td.name);
        const looksLikeProps = td.type === 'interface' && /Props$/.test(td.name);
        td.category = looksLikeProps ? 'props' : looksLikeVariant ? 'variant' : 'helper';

        if (!this.generatedTypes.has(td.name)) {
          this.typeDefinitions.push(td);
          this.generatedTypes.add(td.name);
        }
      }
    }

    // Generate examples list exclusively from extraction phase (no fallbacks)
    const componentWithExamples = component as ComponentInfo & { interfaceExamples?: string[] };
    const examplesFromExtractor: string[] = Array.isArray(componentWithExamples.interfaceExamples)
      ? componentWithExamples.interfaceExamples
      : [];
    const examples = this.dedupeExamples(
      examplesFromExtractor.map((ex: string) => this.sanitizeExampleCode(ex))
    );

    // Calculate component statistics
    const stats = this.calculateComponentStats(
      processedProps,
      processedVariants,
      processedInheritance
    );

    // Pull through Editorial-doc-page metadata from the rich
    // ComponentInfo. Stability defaults to 'stable' so the badge can
    // render unconditionally without each component needing a JSDoc
    // tag; `sourceHref` and `relatedComponents` stay optional because
    // missing data should be silently invisible rather than show a
    // stub link / empty RELATED block.
    const stability: ComponentStability = component.stability ?? 'stable';
    const sourceHref = this.buildSourceHref(component.filePath || '');
    const relatedComponents = Array.isArray(component.relatedComponents)
      ? component.relatedComponents.filter((name) => name && name !== component.name)
      : [];

    // Slot names lifted from the tv() `slots:` keys during extraction (attached
    // to the rich component alongside interfaceExamples/localTypes). Carried
    // onto the API surface so both catalog generators read one authoritative
    // source instead of regex-guessing the slotClasses prop type.
    const componentWithSlots = component as ComponentInfo & { slots?: string[] };
    const slots = Array.isArray(componentWithSlots.slots)
      ? componentWithSlots.slots.filter((s) => s?.trim())
      : [];

    const group = this.inferGroupFromPath(component.filePath || '');

    return {
      name: component.name,
      props: processedProps,
      variants: processedVariants,
      inheritance: processedInheritance,
      examples,
      stats,
      ...(group !== undefined ? { group } : {}),
      stability,
      ...(slots.length > 0 ? { slots } : {}),
      ...(sourceHref ? { sourceHref } : {}),
      ...(relatedComponents.length > 0 ? { relatedComponents } : {}),
      types: localTypeDefs
    };
  }

  /**
   * Builds a GitHub blob URL for the component's source file.
   * Walks back from the absolute filesystem path to the first
   * `packages/...` segment, then appends that to the repo base URL.
   * Returns undefined when no `packages/` segment is present (e.g.
   * an app-level component or a synthetic test fixture).
   *
   * Paths that traverse `node_modules` are rejected outright so a
   * hoisted-dependency fixture (or a future glob that accidentally
   * pulls in a vendored copy) doesn't render as a 404 link to a
   * non-existent file in the upstream repo.
   */
  private buildSourceHref(filePath: string): string | undefined {
    if (!filePath) return undefined;
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.includes('/node_modules/')) return undefined;
    const match = normalized.match(/(packages\/.+)$/);
    if (!match) return undefined;
    return `${APIDataGenerator.SOURCE_BASE_URL}/${match[1]}`;
  }

  // ==========================================
  // PROPS PROCESSING
  // ==========================================

  private async processProps(props: PropInfo[], component: ComponentInfo): Promise<PropInfo[]> {
    const processedProps: PropInfo[] = [];

    for (const prop of props) {
      const processedProp = await this.processProp(prop, component);
      processedProps.push(processedProp);

      // Extract type definitions from complex props
      this.extractTypeDefinitions(prop, component);
    }

    // Sort props by category and importance
    return this.sortPropsForAPI(processedProps);
  }

  private async processProp(prop: PropInfo, component: ComponentInfo): Promise<PropInfo> {
    const processedProp: PropInfo = { ...prop };

    // Ensure source.name is set (required by ApiReference)
    if (!processedProp.source.name) {
      processedProp.source.name = `${component.name}Props`;
    }

    // Enhance description with context if needed
    if (prop.description.length < 20) {
      processedProp.description = this.enhancePropertyDescription(prop, component);
    }

    // Add seeAlso for known types/components if not provided via JSDoc
    if (!processedProp.seeAlso) {
      const link = this.resolveTypeLink(prop.type, component);
      if (link) processedProp.seeAlso = link;
    }

    // Link placeholder/inherited variant aggregates to the Variants section
    if (
      (processedProp.name?.startsWith('...') && processedProp.source?.type === 'variant') ||
      processedProp.type === 'VariantProps'
    ) {
      const slug = this.componentSlugs.get(component.name) || this.toSlug(component.name);
      processedProp.seeAlso = `${this.routeForComponent(component.name, slug)}#variants`;
    }

    // If local type is referenced, add a direct anchor for UI (TypeCell will prefer seeAlso, then typeAnchor)
    try {
      const base = this.getBaseType(prop.type || '');
      if (base) {
        const componentWithLocalTypes = component as ComponentInfo & {
          localTypes?: TypeDefinition[];
        };
        const localTypeNames: Set<string> = new Set(
          Array.isArray(componentWithLocalTypes.localTypes)
            ? componentWithLocalTypes.localTypes.map((t) => t.name)
            : []
        );
        if (localTypeNames.has(base)) {
          const slug = this.componentSlugs.get(component.name) || this.toSlug(component.name);
          (processedProp as PropInfo & { typeAnchor?: string; typePreview?: string }).typeAnchor =
            `${this.routeForComponent(component.name, slug)}#type-${base}`;
          const td = componentWithLocalTypes.localTypes?.find((t) => t?.name === base);
          if (td?.definition) {
            // Keep preview compact (first ~15 lines)
            const raw = String(td.definition);
            const lines = raw.split(/\r?\n/).slice(0, 15).join('\n');
            (
              processedProp as PropInfo & { typeAnchor?: string; typePreview?: string }
            ).typePreview = lines;
          }
        }
      }
    } catch {
      // ignore resolution failures
    }

    // Add usage examples if missing
    const examples = this.generatePropExamples(prop, component);
    if (examples && examples.length > 0) {
      processedProp.examples = examples;
    }

    return processedProp;
  }

  private enhancePropertyDescription(prop: PropInfo, component: ComponentInfo): string {
    const descriptions: Record<string, string> = {
      class: `Additional CSS classes to apply to the ${component.name} component`,
      children: `Content to render inside the ${component.name} component`,
      variant: `Visual style variant for the ${component.name} component`,
      size: `Size variant that controls dimensions and spacing of the ${component.name}`,
      intent: `Color and semantic meaning variant for the ${component.name}`,
      disabled: `Whether the ${component.name} is disabled and non-interactive`,
      loading: `Whether the ${component.name} is in a loading state`,
      mint: `Micro-interaction configuration for enhanced user experience`
    };

    return (
      descriptions[prop.name] ||
      `${prop.name.charAt(0).toUpperCase() + prop.name.slice(1)} property for the ${component.name} component`
    );
  }

  private resolveTypeLink(type: string, component: ComponentInfo): string | undefined {
    const base = this.getBaseType(type);
    if (!base) return undefined;

    // Local type definitions for this component
    const componentWithLocalTypes = component as ComponentInfo & { localTypes?: TypeDefinition[] };
    const localTypeNames: Set<string> = new Set(
      Array.isArray(componentWithLocalTypes.localTypes)
        ? componentWithLocalTypes.localTypes.map((t) => t.name)
        : []
    );

    if (localTypeNames.has(base)) {
      const slug = this.componentSlugs.get(component.name) || this.toSlug(component.name);
      return `${this.routeForComponent(component.name, slug)}#type-${base}`;
    }

    // Component name or *Props → component page
    const compName = base.endsWith('Props') ? base.slice(0, -'Props'.length) : base;
    const slug = this.componentSlugs.get(compName);
    if (slug !== undefined) {
      return `${this.routeForComponent(compName, slug)}#api`;
    }

    // External types
    const external = this.getExternalTypeLink(base);
    if (external) return external;

    // Urbicon tokens
    const urbicon = this.getUrbiconTypeLink(base);
    if (urbicon) return urbicon;

    return undefined;
  }

  private getBaseType(type: string): string | null {
    if (!type) return null;
    const first = (type.split('|')[0] || '').trim();
    const noGenerics = first.replace(/<.*>/, '').replace(/\[\]$/, '').trim();
    const primitives = [
      'string',
      'number',
      'boolean',
      'undefined',
      'null',
      'void',
      'any',
      'never',
      'unknown'
    ];
    if (!noGenerics || primitives.includes(noGenerics) || /^['"]/.test(noGenerics)) return null;
    return noGenerics;
  }

  private toSlug(input: string): string {
    return input
      .replace(/([a-z0-9])(\p{Lu})/gu, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Build the doc-route URL for a component, mirroring the on-disk layout the
   * API/LLM generators write to: `<routeBasePath>/<group>/<slug>` (or
   * `<routeBasePath>/<slug>` when the component has no group).
   *
   * This is why a single flat base is wrong for the blocks target — its
   * primitives live under `/blocks/primitives/<slug>` and its components under
   * `/blocks/components/<slug>`, so the group segment has to come from the
   * (target) component, not from the run-wide base.
   */
  private routeForComponent(name: string, slug: string): string {
    const base = this.routeBasePath.replace(/\/$/, '');
    const group = this.componentGroups.get(name);
    return group ? `${base}/${group}/${slug}` : `${base}/${slug}`;
  }

  private inferGroupFromPath(filePath: string): string | undefined {
    try {
      const lower = String(filePath || '').toLowerCase();
      if (lower.includes('/primitives/')) return 'primitives';
      if (lower.includes('/components/')) return 'components';
      return undefined;
    } catch {
      return undefined;
    }
  }

  private getExternalTypeLink(typeName: string): string | undefined {
    const svelteMap: Record<string, string> = {
      Snippet: 'https://svelte.dev/docs/svelte/snippet',
      ComponentEvents: 'https://svelte.dev/docs/svelte/component-events'
    };
    if (svelteMap[typeName]) return svelteMap[typeName];

    if (/^HTML\w+Attributes$/.test(typeName)) {
      const el = typeName
        .replace(/^HTML/, '')
        .replace(/Attributes$/, '')
        .toLowerCase();
      return `https://developer.mozilla.org/en-US/docs/Web/HTML/Element/${el}`;
    }

    const mdnMap: Record<string, string> = {
      // DOM core
      Event: 'https://developer.mozilla.org/en-US/docs/Web/API/Event',
      HTMLElement: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement',
      Element: 'https://developer.mozilla.org/en-US/docs/Web/API/Element',
      Node: 'https://developer.mozilla.org/en-US/docs/Web/API/Node',
      Document: 'https://developer.mozilla.org/en-US/docs/Web/API/Document',
      // Events
      MouseEvent: 'https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent',
      KeyboardEvent: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent',
      FocusEvent: 'https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent',
      PointerEvent: 'https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent',
      InputEvent: 'https://developer.mozilla.org/en-US/docs/Web/API/InputEvent',
      WheelEvent: 'https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent',
      // HTML elements (common)
      HTMLButtonElement: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement',
      HTMLInputElement: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement',
      HTMLDivElement: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLDivElement',
      HTMLAnchorElement: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement',
      HTMLSpanElement: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLSpanElement',
      HTMLUListElement: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLUListElement',
      HTMLLIElement: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLLIElement',
      HTMLTextAreaElement: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement'
    };
    if (mdnMap[typeName]) return mdnMap[typeName];
    return undefined;
  }

  private getUrbiconTypeLink(typeName: string): string | undefined {
    // Real doc routes (the previous `/docs/design-tokens` + `/docs/mint-system`
    // targets never existed — `/docs` only hosts the docs-package components).
    // The token reference lives at `/customization/tokens`; intents are the
    // "Color System" section (`#colors`) and Mint rides the "Motion & Depth"
    // interaction layer (`#interaction`). There is no dedicated Mint page, and
    // ComponentSize has no size-specific anchor, so both fall back to the page.
    const map: Record<string, string> = {
      ComponentIntent: '/customization/tokens#colors',
      ComponentSize: '/customization/tokens',
      MintProp: '/customization/tokens#interaction'
    };
    return map[typeName];
  }

  private generatePropExamples(prop: PropInfo, component: ComponentInfo): PropInfo['examples'] {
    const examples: NonNullable<PropInfo['examples']> = [];

    // Generate basic usage example
    if (prop.type.includes('boolean')) {
      examples.push({
        title: `Enable ${prop.name}`,
        code: `<${component.name} ${prop.name} />`,
        description: `Enable the ${prop.name} property`
      });
    } else if (prop.type.includes('string')) {
      const exampleValue = this.generateExampleValue(prop.name, prop.type);
      examples.push({
        title: `Set ${prop.name}`,
        code: `<${component.name} ${prop.name}="${exampleValue}" />`,
        description: `Set the ${prop.name} property`
      });
    }

    return examples.length > 0 ? examples : undefined;
  }

  private generateExampleValue(propName: string, propType: string): string {
    // Extract union values if available
    const unionMatch = propType.match(/'([^']+)'/g);
    if (unionMatch && unionMatch.length > 0) {
      return unionMatch[0].replace(/'/g, '');
    }

    // Default values based on prop name
    const defaultValues: Record<string, string> = {
      variant: 'filled',
      size: 'md',
      intent: 'primary',
      class: 'custom-class',
      href: '/example',
      type: 'button',
      placeholder: 'Enter text...'
    };

    return defaultValues[propName] || 'example';
  }

  // ==========================================
  // VARIANTS PROCESSING
  // ==========================================

  private async processVariants(
    variants: VariantInfo[],
    component: ComponentInfo
  ): Promise<VariantInfo[]> {
    const processedVariants: VariantInfo[] = [];

    for (const variant of variants) {
      const processedVariant = await this.processVariant(variant, component);
      processedVariants.push(processedVariant);
    }

    return processedVariants.sort((a, b) => {
      // Sort by importance: intent > variant > size > others
      const order = ['intent', 'variant', 'size'];
      const aIndex = order.indexOf(a.name);
      const bIndex = order.indexOf(b.name);

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      return a.name.localeCompare(b.name);
    });
  }

  private async processVariant(
    variant: VariantInfo,
    component: ComponentInfo
  ): Promise<VariantInfo> {
    const processedVariant: VariantInfo = { ...variant };

    // Generate examples if missing
    const examples = this.generateVariantExamples(variant, component);
    if (examples && examples.length > 0) {
      processedVariant.examples = examples;
    }

    // Ensure default value is set only if explicitly provided upstream
    if (!variant.defaultValue) {
      // No heuristic defaults here. Respect tv() defaultVariants only.
    }

    return processedVariant;
  }

  private enhanceVariantDescription(variant: VariantInfo, component: ComponentInfo): string {
    const descriptions: Record<string, string> = {
      intent: `Controls the color theme and semantic meaning of the ${component.name}. Affects the overall appearance and user perception.`,
      variant: `Controls the visual style and presentation of the ${component.name}. Determines the component's visual treatment.`,
      size: `Controls the dimensions, padding, and text size of the ${component.name}. Affects the component's physical footprint.`,
      placement: `Controls the positioning and alignment of the ${component.name} relative to its container or trigger element.`,
      state: `Controls the visual state representation of the ${component.name} to communicate status to users.`
    };

    const baseDescription =
      descriptions[variant.name] ||
      `Controls the ${variant.name} behavior and appearance of the ${component.name} component.`;

    const valuesList =
      variant.values.length <= 4
        ? variant.values.join(', ')
        : `${variant.values.slice(0, 3).join(', ')}, and ${variant.values.length - 3} more`;

    return `${baseDescription} Available options: ${valuesList}.`;
  }

  private generateVariantExamples(
    variant: VariantInfo,
    component: ComponentInfo
  ): VariantInfo['examples'] {
    return variant.values.slice(0, 3).map((value: string) => ({
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1), // Add required label property
      description: `${component.name} with ${variant.name} set to "${value}"`,
      code: `<${component.name} ${variant.name}="${value}">${component.name} content</${component.name}>`
    }));
  }

  // ==========================================
  // VARIANTS AS API PROPS (FLATTENED VIEW)
  // ==========================================

  private createVariantPropsForAPI(variants: VariantInfo[], component: ComponentInfo): PropInfo[] {
    const props: PropInfo[] = [];

    for (const v of variants) {
      // Build a union type from values
      const unionType =
        v.values && v.values.length > 0
          ? v.values.map((val: string) => `'${val}'`).join(' | ')
          : 'string';
      const description = this.enhanceVariantDescription(v, component);

      const prop: PropInfo = {
        name: v.name,
        type: unionType,
        required: false,
        description,
        ...(v.defaultValue !== undefined && v.defaultValue !== ''
          ? { defaultValue: v.defaultValue }
          : {}),
        // expose raw values for UI rendering (e.g., tooltip/second line)
        ...(Array.isArray(v.values) && v.values.length > 0 ? { values: v.values } : {}),
        source: {
          type: 'variant',
          name: `${component.name}Variants`
        }
      };

      props.push(prop);
    }

    return props;
  }

  // Removed heuristic default inference

  // ==========================================
  // INHERITANCE PROCESSING
  // ==========================================

  private async processInheritance(
    inheritance: InheritanceInfo[],
    component: ComponentInfo
  ): Promise<InheritanceInfo[]> {
    const processedInheritance: InheritanceInfo[] = [];

    for (const inheritanceItem of inheritance) {
      const processedItem = await this.processInheritanceItem(inheritanceItem, component);
      processedInheritance.push(processedItem);
    }

    return processedInheritance;
  }

  private async processInheritanceItem(
    inheritance: InheritanceInfo,
    component: ComponentInfo
  ): Promise<InheritanceInfo> {
    const processedItem: InheritanceInfo = { ...inheritance };

    // Resolve URLs for better documentation
    if (!inheritance.url && this.canResolveURL(inheritance.typeName)) {
      processedItem.url = this.resolveInheritanceURL(inheritance.typeName);
    }

    // Process inherited props
    processedItem.props = await Promise.all(
      inheritance.props.map((prop: PropInfo) => this.processProp(prop, component))
    );

    return processedItem;
  }

  private canResolveURL(typeName: string): boolean {
    return (
      typeName.includes('HTML') || typeName.includes('Svelte') || typeName.includes('@urbicon-ui')
    );
  }

  private resolveInheritanceURL(typeName: string): string {
    const urlMap: Record<string, string> = {
      HTMLButtonAttributes: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button',
      HTMLInputAttributes: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input',
      HTMLDivAttributes: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/div',
      Snippet: 'https://svelte.dev/docs/svelte/snippet',
      ComponentEvents: 'https://svelte.dev/docs/svelte/component-events'
    };

    return urlMap[typeName] || '#';
  }

  // ==========================================
  // STATISTICS & METADATA
  // ==========================================

  private calculateComponentStats(
    props: PropInfo[],
    variants: VariantInfo[],
    _inheritance: InheritanceInfo[]
  ): ComponentStats {
    const directProps = props.filter((p) => p.source.type === 'direct');
    const variantProps = props.filter((p) => p.source.type === 'variant');
    const inheritedProps = props.filter((p) => p.source.type === 'inherited');

    return {
      totalProps: props.length,
      directProps: directProps.length,
      variantProps: variantProps.length + variants.length,
      inheritedProps: inheritedProps.length
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private sanitizeExampleCode(code: string): string {
    if (!code) return '';
    const lines = String(code)
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\*\s?/, ''));
    while (lines.length > 0 && lines[0]?.trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();
    return lines.join('\n');
  }

  private dedupeExamples(examples: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ex of examples) {
      const key = ex.replace(/\s+/g, '').toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(ex);
      }
    }
    return out;
  }

  private sortPropsForAPI(props: PropInfo[]): PropInfo[] {
    return props.sort((a, b) => {
      // Required props first
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;

      // Alphabetical within same requirement
      return a.name.localeCompare(b.name);
    });
  }

  private isComplexType(type: string): boolean {
    return (
      type.includes('<') ||
      type.includes('=>') ||
      type.includes('|') ||
      type.includes('&') ||
      type.includes('[]')
    );
  }

  private extractTypeDefinitions(prop: PropInfo, component: ComponentInfo): void {
    // Extract complex type definitions for the types array
    if (!this.isComplexType(prop.type)) return;

    // Create a safe alias name for the complex type, e.g. ButtonLoadingPlacement
    const toPascalCase = (input: string): string =>
      input
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');

    const aliasName = `${component.name}${toPascalCase(prop.name)}`;

    if (this.generatedTypes.has(aliasName)) return;

    this.typeDefinitions.push({
      name: aliasName,
      type: 'type',
      definition: prop.type,
      package: component.packageName,
      documentation: `Type definition for ${prop.name} property`
    });
    this.generatedTypes.add(aliasName);
  }

  private createFallbackAPIData(component: ComponentInfo): ComponentAPIData {
    return {
      name: component.name,
      props: [],
      variants: [],
      inheritance: [],
      examples: [],
      stats: {
        totalProps: 0,
        directProps: 0,
        variantProps: 0,
        inheritedProps: 0
      }
    };
  }
}
