import * as ts from 'typescript';
import type { ExtractionResult, PropInfo, TypeScriptExtractionConfig } from '../../types';
import { TypeScriptBaseExtractor } from './TypeScriptBaseExtractor';

interface PropsExtractionInput {
  filePath: string;
  componentName: string;
  /** Optional list of variant prop keys (from VariantsExtractor) to exclude in Omit<... , keyof Variants> */
  variantKeys?: string[];
}

type PropsDeclaration =
  | { kind: 'interface'; node: ts.InterfaceDeclaration; jsDocHost: ts.InterfaceDeclaration }
  | { kind: 'union'; node: ts.UnionTypeNode; jsDocHost: ts.TypeAliasDeclaration };

/**
 * Extracts props from TypeScript interfaces using AST parsing
 * Supports JSDoc comments, type analysis, and prop categorization
 */
export class PropsExtractor extends TypeScriptBaseExtractor<PropsExtractionInput, PropInfo[]> {
  public config: TypeScriptExtractionConfig;
  private currentVariantKeys: string[] = [];

  constructor(tsConfig?: Record<string, unknown>) {
    super(tsConfig);

    const ext = (tsConfig as { extraction?: { typescript?: TypeScriptExtractionConfig } })
      ?.extraction?.typescript;
    this.config = {
      extractJSDoc: true,
      extractTypeReferences: true,
      extractDefaultValues: true,
      resolveTypeAliases: true,
      includePrivateProps: false,
      ...(ext ?? tsConfig)
    };
  }

  /**
   * Extract props from TypeScript interface
   */
  async extract(input: PropsExtractionInput): Promise<ExtractionResult<PropInfo[]>> {
    const startTime = Date.now();

    if (!this.validateInput(input)) {
      return this.handleError(new Error('Invalid input for props extraction'), input);
    }

    try {
      console.log(`🔍 Extracting props for ${input.componentName} from ${input.filePath}`);

      // Keep variant keys for Omit filtering within this extraction call
      this.currentVariantKeys = Array.isArray(input.variantKeys) ? input.variantKeys : [];

      const sourceFile = await this.getSourceFile(input.filePath);
      if (!sourceFile) {
        return this.handleError(new Error(`Could not load source file: ${input.filePath}`), input);
      }

      // Find the props declaration — either an interface or a
      // type-alias whose RHS is a union (discriminated-union pattern).
      const propsDeclaration = this.findPropsDeclaration(sourceFile, input.componentName);
      if (!propsDeclaration) {
        const warning = this.addWarning(
          'no_props_interface',
          `No ${input.componentName}Props interface found`,
          `Create a ${input.componentName}Props interface to document component properties`
        );
        return this.createSuccessResult([], [warning], input.filePath, Date.now() - startTime);
      }

      console.log(
        `✅ Found ${input.componentName}Props (${
          propsDeclaration.kind === 'interface' ? 'interface' : 'union type alias'
        })`
      );

      // Extract props from interface OR from the union members.
      const props =
        propsDeclaration.kind === 'interface'
          ? await this.extractPropsFromInterface(propsDeclaration.node, sourceFile)
          : await this.extractPropsFromUnion(
              propsDeclaration.node,
              sourceFile,
              propsDeclaration.jsDocHost.name.text
            );

      console.log(`📝 Extracted ${props.length} props from ${input.componentName}Props`);

      const duration = Date.now() - startTime;
      const result = this.createSuccessResult(props, [], input.filePath, duration);
      // Clear per-call state
      this.currentVariantKeys = [];
      return result;
    } catch (error) {
      this.currentVariantKeys = [];
      return this.handleError(error, input);
    }
  }

  /**
   * Extract the component description from the JSDoc on the *Props declaration.
   * Checks @description tag first, then falls back to leading prose text.
   */
  async extractDescription(input: {
    filePath: string;
    componentName: string;
  }): Promise<string | null> {
    const sourceFile = await this.getSourceFile(input.filePath);
    if (!sourceFile) return null;

    const declaration = this.findPropsDeclaration(sourceFile, input.componentName);
    if (!declaration) return null;

    const tagged = this.extractJSDocTag(declaration.jsDocHost, 'description');
    if (tagged) return tagged;

    return this.extractJSDocComment(declaration.jsDocHost);
  }

  /**
   * Extract all @tag values from the *Props declaration JSDoc.
   */
  async extractTags(input: { filePath: string; componentName: string }): Promise<string[]> {
    const sourceFile = await this.getSourceFile(input.filePath);
    if (!sourceFile) return [];

    const declaration = this.findPropsDeclaration(sourceFile, input.componentName);
    if (!declaration) return [];

    return this.extractJSDocTagAll(declaration.jsDocHost, 'tag');
  }

  /**
   * Extract all @related values from the *Props declaration JSDoc.
   */
  async extractRelated(input: { filePath: string; componentName: string }): Promise<string[]> {
    const sourceFile = await this.getSourceFile(input.filePath);
    if (!sourceFile) return [];

    const declaration = this.findPropsDeclaration(sourceFile, input.componentName);
    if (!declaration) return [];

    return this.extractJSDocTagAll(declaration.jsDocHost, 'related');
  }

  /**
   * Extract the `@stability` tag from the *Props declaration JSDoc.
   * Accepts `experimental | beta | stable | deprecated`; unknown
   * values are dropped so a typo doesn't silently propagate into the
   * Editorial badge.
   */
  async extractStability(input: {
    filePath: string;
    componentName: string;
  }): Promise<'experimental' | 'beta' | 'stable' | 'deprecated' | null> {
    const sourceFile = await this.getSourceFile(input.filePath);
    if (!sourceFile) return null;

    const declaration = this.findPropsDeclaration(sourceFile, input.componentName);
    if (!declaration) return null;

    const raw = this.extractJSDocTag(declaration.jsDocHost, 'stability');
    if (!raw) return null;

    const normalised = raw.trim().toLowerCase();
    if (
      normalised === 'experimental' ||
      normalised === 'beta' ||
      normalised === 'stable' ||
      normalised === 'deprecated'
    ) {
      return normalised;
    }
    return null;
  }

  // ==========================================
  // DECLARATION DISCOVERY
  // ==========================================

  /**
   * Locate the component's props declaration. Either:
   *   - an `interface FooProps { ... }`            → kind: 'interface'
   *   - a `type FooProps = A | B | …`              → kind: 'union'
   *
   * `node` is the AST node whose members get walked for props; `jsDocHost`
   * is the declaration that owns the leading JSDoc block (for an interface
   * they're the same; for a union the JSDoc lives on the type-alias, not
   * on the `UnionTypeNode` itself). Other type-alias shapes (intersection,
   * single reference, mapped types, etc.) aren't supported here and fall
   * through to `null`.
   */
  private findPropsDeclaration(
    sourceFile: ts.SourceFile,
    componentName: string
  ): PropsDeclaration | null {
    const possibleNames = [
      `${componentName}Props`,
      `I${componentName}Props`,
      `${componentName}Properties`
    ];

    for (const name of possibleNames) {
      const iface = this.findInterface(sourceFile, name);
      if (iface) return { kind: 'interface', node: iface, jsDocHost: iface };

      const alias = this.findTypeAlias(sourceFile, name);
      if (alias && ts.isUnionTypeNode(alias.type)) {
        return { kind: 'union', node: alias.type, jsDocHost: alias };
      }
    }

    return null;
  }

  // ==========================================
  // PROPS EXTRACTION
  // ==========================================

  /**
   * Extract props from a discriminated-union type alias.
   *
   * Algorithm (generic — no hard-coded discriminator name):
   *   1. Resolve each union member to a local interface. Members that
   *      can't be resolved (anonymous type literals, external refs,
   *      intersections, etc.) are dropped with a warning.
   *   2. Extract props from each resolved interface (reusing the
   *      interface path so heritage / Omit / variants are honoured).
   *   3. Detect the discriminator: a property that exists in every
   *      member with a single string-literal type, and whose literal
   *      value differs across members.
   *   4. Merge the per-member prop sets:
   *      - Props that appear in every member → unconditional.
   *      - Props that appear in only some members → `conditionalOn`
   *        records the discriminator and the values where they apply.
   *      - The discriminator prop itself is collapsed into one entry
   *        whose `values` array enumerates every literal it can take.
   */
  private async extractPropsFromUnion(
    union: ts.UnionTypeNode,
    sourceFile: ts.SourceFile,
    aliasName: string
  ): Promise<PropInfo[]> {
    const memberProps: Array<{ memberName: string; props: PropInfo[] }> = [];

    for (const memberType of union.types) {
      const resolved = this.resolveUnionMemberInterface(memberType, sourceFile);
      if (!resolved) {
        console.log(`⚠️ Skipping un-resolvable union member: ${memberType.getText().slice(0, 60)}`);
        continue;
      }
      const props = await this.extractPropsFromInterface(resolved.iface, sourceFile);
      memberProps.push({ memberName: resolved.name, props });
    }

    if (memberProps.length === 0) {
      return [];
    }
    if (memberProps.length === 1) {
      // Degenerate single-member union — treat as plain interface.
      return memberProps[0]?.props ?? [];
    }

    // Build a "prop name → values seen per member" map.
    //
    // A `never` declaration counts as "not present in this variant" —
    // it's the discriminated-union idiom for forbidding a property on
    // a specific arm (`children?: never`). We still keep the
    // occurrence around in case it's the only one we have, but it
    // doesn't gate `conditionalOn` membership.
    const presence = new Map<string, Map<string, PropInfo>>();
    const everPresent = new Map<string, PropInfo>();
    for (const { memberName, props } of memberProps) {
      for (const prop of props) {
        everPresent.set(prop.name, prop);
        if (prop.type === 'never') continue;
        let byMember = presence.get(prop.name);
        if (!byMember) {
          byMember = new Map();
          presence.set(prop.name, byMember);
        }
        byMember.set(memberName, prop);
      }
    }

    // Seed any properties that only appeared as `never` declarations
    // (no real-typed occurrence anywhere) — they exist syntactically
    // but should be reported as never-typed.
    for (const [name, prop] of everPresent) {
      if (!presence.has(name)) {
        presence.set(name, new Map([['__never__', prop]]));
      }
    }

    const memberCount = memberProps.length;

    // Find the discriminator: the prop that exists in every member with
    // a single distinct string-literal type per member.
    const discriminator = this.detectDiscriminator(presence, memberProps);

    const merged: PropInfo[] = [];
    for (const [name, byMember] of presence) {
      const occurrences = Array.from(byMember.values());
      // Membership counts only real members (skip the `__never__`
      // sentinel that holds purely-never declarations).
      const realMemberKeys = Array.from(byMember.keys()).filter((k) => k !== '__never__');
      const isUnconditional = realMemberKeys.length === memberCount;

      if (discriminator && name === discriminator.propName) {
        // Collapse the discriminator into one entry whose `values`
        // enumerates every literal it can take, with `type` rebuilt
        // as the union of all member literals.
        const allValues = new Set<string>();
        for (const occ of occurrences) {
          for (const v of occ.values ?? []) allValues.add(v);
        }
        const base = { ...this.pickInformativeOccurrence(occurrences) };
        base.values = Array.from(allValues);
        base.type = base.values.map((v) => `'${v}'`).join(' | ');
        // The discriminator is effectively required only when every
        // member declares it as required. If any arm makes it optional
        // (typically the one with a default literal), consumers can
        // omit it and the type narrows to that arm — so from the
        // public API view it's optional.
        base.required = occurrences.every((occ) => occ.required);
        // Re-source onto the outer alias — the discriminator's sub-
        // interface name is implementation detail (see the same
        // re-source below for non-discriminator props).
        base.source = { type: 'direct', name: aliasName };
        // No conditionalOn — the discriminator is the property that's
        // always present.
        delete base.conditionalOn;
        merged.push(base);
        continue;
      }

      // When a prop is declared as `never` in one member and a real
      // type in another (the `BadgeDotProps.interactive?: never` /
      // `BadgeStandardProps.interactive?: boolean` pattern), prefer
      // the real declaration — it's the one consumers actually use.
      const head = { ...this.pickInformativeOccurrence(occurrences) };
      // From the consumer's point of view every prop on the union is
      // direct on the outer alias — the per-member sub-interfaces are
      // implementation detail. Re-source accordingly so the API surface
      // doesn't leak `BadgeBaseProps` / `BadgeStandardProps` as if the
      // consumer had to know them.
      head.source = { type: 'direct', name: aliasName };
      if (!isUnconditional && discriminator) {
        const applicableValues: string[] = [];
        for (const memberName of realMemberKeys) {
          const values = discriminator.valuesByMember.get(memberName);
          if (values) applicableValues.push(...values);
        }
        head.conditionalOn = {
          propName: discriminator.propName,
          values: Array.from(new Set(applicableValues))
        };
      }
      merged.push(head);
    }

    return this.sortProps(merged);
  }

  /**
   * Pick the most informative occurrence of a prop across union members.
   * Prefers occurrences whose type isn't `never`, whose description isn't
   * an auto-generated placeholder (`'<name> property'`), and which carry
   * a `defaultValue` over those that don't. This keeps
   * `<Badge variant="dot" removable>` extracting as `removable: boolean`
   * (from `BadgeStandardProps`) rather than `removable?: never` (from
   * `BadgeDotProps`) — and, when collapsing the discriminator, picks the
   * arm whose `@default` JSDoc is set so the docs site renders a real
   * default value in the API table.
   */
  private pickInformativeOccurrence(occurrences: PropInfo[]): PropInfo {
    if (occurrences.length === 0) {
      throw new Error('pickInformativeOccurrence called with no occurrences');
    }
    const ranked = [...occurrences].sort((a, b) => {
      const aPlaceholder = a.type === 'never' ? 2 : 0;
      const bPlaceholder = b.type === 'never' ? 2 : 0;
      const aDoc = a.description.endsWith(' property') ? 1 : 0;
      const bDoc = b.description.endsWith(' property') ? 1 : 0;
      const aNoDefault = a.defaultValue === undefined ? 0.5 : 0;
      const bNoDefault = b.defaultValue === undefined ? 0.5 : 0;
      return aPlaceholder + aDoc + aNoDefault - (bPlaceholder + bDoc + bNoDefault);
    });
    const best = ranked[0];
    if (!best) {
      throw new Error('pickInformativeOccurrence produced an empty ranking');
    }
    return best;
  }

  /**
   * Resolve a union-member type to a local interface declaration. Currently
   * supports plain TypeReferenceNode shapes (`A`, `Foo<T>`). Returns null for
   * anonymous type literals, intersections, external references the file
   * doesn't import directly, etc.
   */
  private resolveUnionMemberInterface(
    memberType: ts.TypeNode,
    sourceFile: ts.SourceFile
  ): { iface: ts.InterfaceDeclaration; name: string } | null {
    if (!ts.isTypeReferenceNode(memberType)) return null;
    const name = memberType.typeName.getText();
    const iface = this.findInterface(sourceFile, name);
    if (!iface) return null;
    return { iface, name };
  }

  /**
   * Detect the discriminator property. A discriminator must:
   *   - exist in every union member,
   *   - have a string-literal-union type in each member (one or more
   *     `'x' | 'y'` values),
   *   - have non-overlapping value-sets across members (so the literal
   *     uniquely identifies which member a value belongs to).
   *
   * Returns null if no such property exists.
   */
  private detectDiscriminator(
    presence: Map<string, Map<string, PropInfo>>,
    memberProps: Array<{ memberName: string; props: PropInfo[] }>
  ): { propName: string; valuesByMember: Map<string, string[]> } | null {
    const memberCount = memberProps.length;
    for (const [propName, byMember] of presence) {
      if (byMember.size !== memberCount) continue;

      const valuesByMember = new Map<string, string[]>();
      let valid = true;
      for (const { memberName } of memberProps) {
        const prop = byMember.get(memberName);
        if (!prop?.values || prop.values.length === 0) {
          valid = false;
          break;
        }
        valuesByMember.set(memberName, prop.values);
      }
      if (!valid) continue;

      // Reject the property if any value appears in more than one member.
      const seen = new Set<string>();
      let overlap = false;
      for (const values of valuesByMember.values()) {
        for (const v of values) {
          if (seen.has(v)) {
            overlap = true;
            break;
          }
          seen.add(v);
        }
        if (overlap) break;
      }
      if (overlap) continue;

      return { propName, valuesByMember };
    }
    return null;
  }

  private async extractPropsFromInterface(
    propsInterface: ts.InterfaceDeclaration,
    sourceFile: ts.SourceFile
  ): Promise<PropInfo[]> {
    const props: PropInfo[] = [];

    // Extract direct properties from interface
    for (const member of propsInterface.members) {
      if (ts.isPropertySignature(member)) {
        const prop = this.extractPropFromMember(member);
        if (prop) {
          // Mark as direct prop
          prop.source = {
            type: 'direct',
            name: propsInterface.name.text
          };
          props.push(prop);
        }
      }
    }

    console.log(`📝 Extracted ${props.length} direct props`);

    // Process heritage clauses (extends/implements)
    if (propsInterface.heritageClauses) {
      console.log(`🔍 Processing ${propsInterface.heritageClauses.length} heritage clauses...`);

      for (const heritageClause of propsInterface.heritageClauses) {
        for (const heritageType of heritageClause.types) {
          const inheritedProps = await this.extractInheritedProps(heritageType, sourceFile);
          props.push(...inheritedProps);
        }
      }
    }

    // Sort props by category and name
    return this.sortProps(props);
  }

  private extractPropFromMember(member: ts.PropertySignature): PropInfo | null {
    const propName = this.getPropertyName(member);
    if (!propName) return null;

    // Skip private props if configured
    if (!this.config.includePrivateProps && propName.startsWith('_')) {
      return null;
    }

    const propType = this.getTypeString(member.type);
    const isRequired = this.isPropertyRequired(member);

    // Extract JSDoc information
    let description = `${propName} property`;
    let defaultValue: string | undefined;
    let examples: PropInfo['examples'] = [];
    let deprecated: PropInfo['deprecated'];
    let seeAlso: PropInfo['seeAlso'];
    let seeAlsoRefs: PropInfo['seeAlsoRefs'];
    let experimental = false;
    let since: string | undefined;

    if (this.config.extractJSDoc) {
      const jsDocComment = this.extractJSDocComment(member);
      if (jsDocComment) {
        description = jsDocComment;
      }

      // Extract JSDoc tags
      defaultValue = this.extractJSDocTag(member, 'default');
      since = this.extractJSDocTag(member, 'since');

      // Split `@see` into the two jobs it actually serves: a navigable link
      // target (`seeAlso`, rendered as a link) and a prose reference
      // (`seeAlsoRefs`, rendered as literal text). Before this split every
      // `@see` landed in `seeAlso`, where a bare type name silently fell
      // through ApiReference's link branches and was never shown. The rule
      // itself lives on the base extractor — type declarations need it too.
      ({ seeAlso, seeAlsoRefs } = this.extractSeeTags(member));

      const deprecatedInfo = this.extractJSDocTag(member, 'deprecated');
      if (deprecatedInfo) {
        deprecated = {
          message: deprecatedInfo,
          since: since || ''
        };
      }

      const experimentalInfo = this.extractJSDocTag(member, 'experimental');
      if (experimentalInfo) {
        experimental = true;
      }

      // Extract examples from JSDoc
      examples = this.extractJSDocExamples(member);
    }

    // Extract union values for enum-like types
    const values = member.type ? this.extractUnionValues(member.type) : undefined;

    const prop: PropInfo = {
      name: propName,
      type: propType,
      required: isRequired,
      description,
      source: { type: 'direct' } // Will be updated by caller
    };

    // Add optional fields
    if (defaultValue) prop.defaultValue = defaultValue;
    if (values && values.length > 0) prop.values = values;
    if (examples && examples.length > 0) prop.examples = examples;
    if (deprecated) prop.deprecated = deprecated;
    if (experimental) prop.experimental = experimental;
    if (since) prop.since = since;
    if (seeAlso) prop.seeAlso = seeAlso;
    if (seeAlsoRefs) prop.seeAlsoRefs = seeAlsoRefs;

    return prop;
  }

  // ==========================================
  // INHERITANCE HANDLING
  // ==========================================

  private async extractInheritedProps(
    heritageType: ts.ExpressionWithTypeArguments,
    sourceFile: ts.SourceFile
  ): Promise<PropInfo[]> {
    const typeName = heritageType.expression.getText();
    console.log(`🔍 Processing inheritance from: ${typeName}`);

    // Handle different inheritance patterns
    if (this.isVariantInterface(typeName)) {
      return this.handleVariantInheritance(typeName);
    }

    if (this.isOmitPattern(heritageType)) {
      return this.handleOmitPattern(heritageType, sourceFile);
    }

    if (this.isHTMLAttributes(typeName)) {
      return this.handleHTMLAttributes(typeName);
    }

    // Try to find local interface
    const localInterface = this.findInterface(sourceFile, typeName);
    if (localInterface) {
      return this.extractPropsFromLocalInterface(localInterface, typeName);
    }

    // Cross-file: resolve an imported base interface through the shared
    // program (e.g. `extends AnimationProps` from $lib/utils). Scoped to
    // the package's own sources; no-op in single-file mode.
    const resolvedInterface = this.resolveCrossFileInterface(heritageType.expression);
    if (resolvedInterface) {
      console.log(`🌉 Resolved ${typeName} from ${resolvedInterface.getSourceFile().fileName}`);
      return this.extractPropsFromLocalInterface(resolvedInterface, typeName);
    }

    // Create placeholder for unknown inheritance
    console.log(`❓ Creating placeholder for unknown inheritance: ${typeName}`);
    return [
      {
        name: `...${typeName}`,
        type: 'inherited',
        required: false,
        description: `Properties inherited from ${typeName}`,
        source: {
          type: 'inherited',
          name: typeName,
          package: this.getPackageForType(typeName) || ''
        }
      }
    ];
  }

  private handleVariantInheritance(typeName: string): PropInfo[] {
    // This will be handled by VariantsExtractor in the coordination phase
    console.log(
      `🎨 Variant inheritance detected: ${typeName} - will be processed by VariantsExtractor`
    );
    return [
      {
        name: `...${typeName}`,
        type: 'VariantProps',
        required: false,
        description: `Styling variants from ${typeName}`,
        source: {
          type: 'variant',
          name: typeName
        }
      }
    ];
  }

  private handleOmitPattern(
    heritageType: ts.ExpressionWithTypeArguments,
    sourceFile: ts.SourceFile
  ): PropInfo[] {
    const fullType = heritageType.getText();
    // Omit pattern detected; filter extracted props based on omitted keys

    // Extract base type and omitted keys
    const match = fullType.match(/Omit<([^,]+),\s*([^>]+)>/);
    if (match?.[1] && match[2]) {
      const baseType = match[1].trim();
      const omittedKeys = match[2].trim();

      if (this.isHTMLAttributes(baseType)) {
        return [
          {
            name: `...${baseType}`,
            type: 'HTMLAttributes',
            required: false,
            description: `HTML attributes${omittedKeys ? ` (excluding: ${omittedKeys})` : ''}`,
            source: {
              type: 'inherited',
              name: fullType,
              package: 'svelte/elements'
            }
          }
        ];
      }

      // *Variants type alias — `findInterface` returns null because
      // *Variants is a `type` alias over `VariantProps<typeof xVariants>`,
      // not an interface. Emit the variant-inheritance placeholder AND
      // omit-markers for each literal-string key in the omitted list.
      // APIDataGenerator filters those markers (and the named keys) out
      // of the final variant-props list so they don't leak into the
      // public API table.
      if (this.isVariantInterface(baseType)) {
        const result: PropInfo[] = this.handleVariantInheritance(baseType);
        const literalKeys = this.extractOmittedLiteralKeys(omittedKeys);
        for (const key of literalKeys) {
          result.push({
            name: `__OMIT_VARIANT__${key}`,
            type: 'omit-marker',
            required: false,
            description: `Suppress variant prop "${key}" from the public API surface (declared via Omit<${baseType}, ...>).`,
            source: { type: 'inherited', name: fullType }
          });
        }
        return result;
      }

      // Local interface Omit pattern, e.g., Omit<MenuSpecificProps, keyof MenuVariants>;
      // cross-file fallback for imported bases, e.g. Omit<InputProps, 'type' | …>
      // (resolved from the package sources via the shared program).
      const baseInterface =
        this.findInterface(sourceFile, baseType) ?? this.resolveOmitBaseInterface(heritageType);
      if (baseInterface) {
        // Extract props from the base interface
        const extracted = this.extractPropsFromLocalInterface(baseInterface, baseType);
        // Blacklist: literal keys named in Omit<…, 'a' | 'b'> plus — when the
        // keys argument references `keyof *Variants` — the variant keys
        // provided by VariantsExtractor.
        const blacklist = new Set(this.extractOmittedLiteralKeys(omittedKeys));
        if (/keyof\s+\w*Variants/.test(omittedKeys)) {
          for (const key of this.currentVariantKeys) blacklist.add(key);
        }

        return extracted
          .filter((p) => !blacklist.has(p.name))
          .map((p) => ({
            ...p,
            source: {
              type: 'inherited',
              name: fullType
            }
          }));
      }
    }

    return [];
  }

  private handleHTMLAttributes(typeName: string): PropInfo[] {
    const elementType = this.extractElementType(typeName);

    return [
      {
        name: `...${elementType}Attributes`,
        type: 'HTMLAttributes',
        required: false,
        description: `All standard HTML ${elementType.toLowerCase()} attributes`,
        source: {
          type: 'inherited',
          name: typeName,
          package: 'svelte/elements',
          url: `https://developer.mozilla.org/en-US/docs/Web/HTML/Element/${elementType.toLowerCase()}`
        }
      }
    ];
  }

  private extractPropsFromLocalInterface(
    localInterface: ts.InterfaceDeclaration,
    interfaceName: string
  ): PropInfo[] {
    const props: PropInfo[] = [];

    for (const member of localInterface.members) {
      if (ts.isPropertySignature(member)) {
        const prop = this.extractPropFromMember(member);
        if (prop) {
          prop.source = {
            type: 'inherited',
            name: interfaceName
          };
          props.push(prop);
        }
      }
    }

    // extracted local interface props
    return props;
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private isVariantInterface(typeName: string): boolean {
    return typeName.endsWith('Variants') || typeName.endsWith('VariantProps');
  }

  private isOmitPattern(heritageType: ts.ExpressionWithTypeArguments): boolean {
    return heritageType.expression.getText().startsWith('Omit');
  }

  /**
   * Parse the keys argument of `Omit<X, K>` into a flat string-literal list.
   * Handles `'a'`, `'a' | 'b' | 'c'`, double-quoted, and ignores `keyof T`
   * patterns (those are handled separately via `currentVariantKeys`).
   */
  private extractOmittedLiteralKeys(omittedKeys: string): string[] {
    return Array.from(omittedKeys.matchAll(/['"]([A-Za-z_$][A-Za-z0-9_$]*)['"]/g))
      .map((m) => m[1])
      .filter((k): k is string => Boolean(k));
  }

  private isHTMLAttributes(typeName: string): boolean {
    return typeName.includes('HTML') && typeName.includes('Attributes');
  }

  private extractElementType(typeName: string): string {
    const match = typeName.match(/HTML(\w+)Attributes/);
    return match?.[1] ? match[1] : 'Element';
  }

  private getPackageForType(typeName: string): string | undefined {
    const packageMap: Record<string, string> = {
      Snippet: 'svelte',
      ComponentEvents: 'svelte',
      MintProp: '@urbicon-ui/blocks',
      ComponentIntent: '@urbicon-ui/blocks',
      ComponentSize: '@urbicon-ui/blocks'
    };
    return packageMap[typeName];
  }

  private extractJSDocExamples(member: ts.PropertySignature): PropInfo['examples'] {
    const examples: NonNullable<PropInfo['examples']> = [];

    // Extract @example tags
    const jsDocTags = ts.getJSDocTags(member);
    let exampleCount = 1;

    for (const tag of jsDocTags) {
      if (tag.tagName.text === 'example' && tag.comment) {
        const exampleText = this.getCommentText(tag.comment);
        examples.push({
          title: `Example ${exampleCount}`,
          code: exampleText,
          description: `Usage example for ${this.getPropertyName(member)}`
        });
        exampleCount++;
      }
    }

    return examples;
  }

  private sortProps(props: PropInfo[]): PropInfo[] {
    return props.sort((a, b) => {
      // Within same category, sort required props first
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;

      // Finally, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }

  // ✅ Removed duplicate getCommentText method - now inherited from TypeScriptBaseExtractor

  /**
   * Clear any caches
   */
  clearCache(): void {
    // No persistent cache in this implementation
  }
}
