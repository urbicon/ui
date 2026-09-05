import * as ts from 'typescript';
import type {
  ExtractionResult,
  InheritanceExtractionConfig,
  InheritanceInfo,
  KnownInterfaceConfig,
  PropInfo
} from '../../types';
import { noJsDocDescription, TypeScriptBaseExtractor } from './TypeScriptBaseExtractor';

interface InheritanceExtractionInput {
  filePath: string;
  componentName: string;
  interfaceName?: string;
}

/**
 * Resolves interface inheritance, including HTML attributes, external types, and Omit patterns
 */
export class InheritanceExtractor extends TypeScriptBaseExtractor<
  InheritanceExtractionInput,
  InheritanceInfo[]
> {
  public config: InheritanceExtractionConfig;
  private knownInterfaces: Map<string, KnownInterfaceConfig>;

  constructor(tsConfig?: Record<string, unknown>) {
    super(tsConfig);

    const ext = (
      tsConfig as { extraction?: { inheritance?: Partial<InheritanceExtractionConfig> } }
    )?.extraction?.inheritance;
    this.config = {
      resolveExternalTypes: true,
      includeHTMLAttributes: true,
      maxDepth: 5,
      knownInterfaces: [],
      ...ext
    };

    // Build known interfaces map
    this.knownInterfaces = new Map();
    this.config.knownInterfaces?.forEach((iface) => {
      this.knownInterfaces.set(iface.name, iface);
    });

    // Add default known interfaces
    this.addDefaultKnownInterfaces();
  }

  /**
   * Extract inheritance information from component interface
   */
  async extract(input: InheritanceExtractionInput): Promise<ExtractionResult<InheritanceInfo[]>> {
    const startTime = Date.now();

    if (!this.validateInput(input)) {
      return this.handleError(new Error('Invalid input for inheritance extraction'), input);
    }

    try {
      console.log(`🔗 Extracting inheritance for ${input.componentName}`);

      const sourceFile = await this.getSourceFile(input.filePath);
      if (!sourceFile) {
        return this.handleError(new Error(`Could not load source file: ${input.filePath}`), input);
      }

      // Find the main interface
      const interfaceName = input.interfaceName || `${input.componentName}Props`;
      const mainInterface = this.findInterface(sourceFile, interfaceName);

      if (!mainInterface) {
        const warning = this.addWarning(
          'no_interface',
          `No ${interfaceName} interface found`,
          `Create a ${interfaceName} interface to document inheritance`
        );
        return this.createSuccessResult([], [warning], input.filePath, Date.now() - startTime);
      }

      console.log(`✅ Found ${interfaceName} interface`);

      // Extract inheritance information
      const inheritance = await this.extractInheritanceFromInterface(mainInterface, sourceFile, 0);

      console.log(`🔗 Extracted ${inheritance.length} inheritance sources`);

      const duration = Date.now() - startTime;
      return this.createSuccessResult(inheritance, [], input.filePath, duration);
    } catch (error) {
      return this.handleError(error, input);
    }
  }

  // ==========================================
  // INHERITANCE EXTRACTION
  // ==========================================

  private async extractInheritanceFromInterface(
    interfaceNode: ts.InterfaceDeclaration,
    sourceFile: ts.SourceFile,
    depth: number
  ): Promise<InheritanceInfo[]> {
    if (depth >= this.config.maxDepth) {
      console.warn(`⚠️  Max inheritance depth (${this.config.maxDepth}) reached`);
      return [];
    }

    const inheritance: InheritanceInfo[] = [];

    if (!interfaceNode.heritageClauses) {
      return inheritance;
    }

    for (const heritageClause of interfaceNode.heritageClauses) {
      for (const heritageType of heritageClause.types) {
        const inheritanceInfo = await this.processHeritageType(heritageType, sourceFile, depth + 1);

        if (inheritanceInfo) {
          inheritance.push(inheritanceInfo);
        }
      }
    }

    return inheritance;
  }

  private async processHeritageType(
    heritageType: ts.ExpressionWithTypeArguments,
    sourceFile: ts.SourceFile,
    depth: number
  ): Promise<InheritanceInfo | null> {
    const typeName = heritageType.expression.getText();
    console.log(`🔍 Processing heritage type: ${typeName} (depth: ${depth})`);

    // Handle different inheritance patterns
    if (this.isOmitPattern(heritageType)) {
      return this.handleOmitPattern(heritageType, sourceFile);
    }

    if (this.isPickPattern(heritageType)) {
      return this.handlePickPattern(heritageType, sourceFile);
    }

    if (this.isHTMLAttributes(typeName)) {
      return this.handleHTMLAttributes(typeName);
    }

    if (this.isKnownInterface(typeName)) {
      return this.handleKnownInterface(typeName);
    }

    // Try to find local interface
    const localInterface = this.findInterface(sourceFile, typeName);
    if (localInterface) {
      return this.handleLocalInterface(localInterface, typeName, sourceFile, depth);
    }

    // Cross-file: resolve an imported base interface through the shared
    // program (package sources only; no-op in single-file mode). Reuses the
    // local-interface path, recursing into the resolved file's own heritage.
    const resolvedInterface = this.resolveCrossFileInterface(heritageType.expression);
    if (resolvedInterface) {
      console.log(
        `🌉 Resolved heritage ${typeName} from ${resolvedInterface.getSourceFile().fileName}`
      );
      const info = await this.handleLocalInterface(
        resolvedInterface,
        typeName,
        resolvedInterface.getSourceFile(),
        depth
      );
      return { ...info, source: 'resolved-interface' };
    }

    // Handle external types if enabled
    if (this.config.resolveExternalTypes) {
      return this.handleExternalType(typeName, heritageType);
    }

    // Create placeholder for unresolved inheritance
    console.log(`❓ Creating placeholder for unresolved type: ${typeName}`);
    return {
      typeName,
      source: 'unknown',
      props: []
    };
  }

  // ==========================================
  // INHERITANCE PATTERN HANDLERS
  // ==========================================

  private handleOmitPattern(
    heritageType: ts.ExpressionWithTypeArguments,
    sourceFile: ts.SourceFile
  ): InheritanceInfo {
    const fullType = heritageType.getText();
    console.log(`✂️ Handling Omit pattern: ${fullType}`);

    // Parse Omit<BaseType, Keys> pattern
    const match = fullType.match(/Omit<([^,]+),\s*([^>]+)>/);
    if (!match) {
      throw new Error(`Invalid Omit pattern: ${fullType}`);
    }

    const baseType = (match[1] || '').trim();
    const omittedKeys = (match[2] || '').trim();

    // Extract omitted key names
    const omittedKeyList = this.parseOmittedKeys(omittedKeys);

    let props: PropInfo[] = [];
    let url: string | undefined;

    // Handle base type
    if (this.isHTMLAttributes(baseType)) {
      const elementType = this.extractElementType(baseType);
      url = `https://developer.mozilla.org/en-US/docs/Web/HTML/Element/${elementType.toLowerCase()}`;

      props = [
        {
          name: `...${elementType}Attributes`,
          type: 'HTMLAttributes',
          required: false,
          description: `HTML ${elementType.toLowerCase()} attributes${omittedKeyList.length > 0 ? ` (excluding: ${omittedKeyList.join(', ')})` : ''}`,
          source: {
            type: 'inherited',
            name: baseType,
            package: 'svelte/elements'
          }
        }
      ];
    } else if (!/\bkeyof\b/.test(omittedKeys)) {
      // Interface base with literal omit keys — declared in this file or
      // resolved across files through the shared program (e.g.
      // Omit<InputProps, 'type' | …>). A `keyof` omit *is* enumerable here —
      // `resolveHeritageKeyLiterals` answers it — but the entry stays empty
      // until #167: this list and the props list feed `usedByProps`
      // independently, so filling it in makes every type a member names count
      // twice (measured on Menu: MintProp 1 → 2, joining the two literal-key
      // components that already double-count).
      const baseInterface =
        this.findInterface(sourceFile, baseType) ?? this.resolveOmitBaseInterface(heritageType);
      if (baseInterface) {
        const omitted = new Set(omittedKeyList);
        for (const member of baseInterface.members) {
          if (!ts.isPropertySignature(member)) continue;
          const prop = this.extractPropFromMember(member);
          if (!prop || omitted.has(prop.name)) continue;
          prop.source = { type: 'inherited', name: fullType };
          props.push(prop);
        }
      }
    }

    return {
      typeName: fullType,
      source: 'omit-pattern',
      props,
      ...(url ? { url } : {})
    };
  }

  /**
   * `Pick<Base, 'a' | 'b'>` — the counterpart to `handleOmitPattern`. Before
   * this existed the clause fell through to `handleExternalType`, which
   * recorded the *utility type* as the inheritance source: one entry named
   * `Pick` holding one prop named `...Pick`, with the picked members nowhere.
   *
   * Members come from the checker where a program is available (the only route
   * that sees through a tv() variant alias in the base) and from the base
   * interface's own members otherwise.
   */
  private handlePickPattern(
    heritageType: ts.ExpressionWithTypeArguments,
    sourceFile: ts.SourceFile
  ): InheritanceInfo {
    const fullType = heritageType.getText();
    console.log(`🎯 Handling Pick pattern: ${fullType}`);

    const baseType = this.heritageBaseTypeText(heritageType) ?? '';
    const pickedKeys = new Set(this.parseOmittedKeys(this.heritageKeyArgText(heritageType)));
    const props: PropInfo[] = [];

    // A tv() variant alias base contributes no *inherited* props: the axes are
    // reported by the variants pass, and PropsExtractor decides which of them
    // stay public. `handleOmitPattern` leaves `Omit<XVariants, …>` empty for the
    // same reason — listing them here would show every picked axis twice.
    if (/Variants$|VariantProps$/.test(baseType)) {
      return { typeName: fullType, source: 'pick-pattern', props };
    }

    const resolved = this.resolveHeritageMembersViaChecker(heritageType);
    if (resolved) {
      for (const member of resolved) {
        // Documentation from the declaration, shape from the checker — see
        // PropsExtractor.propFromResolvedMember for why the two must not be
        // taken from the same place.
        const documented = member.declaration
          ? this.extractPropFromMember(member.declaration)
          : null;
        props.push({
          ...(documented ?? { description: `Inherited from ${baseType}.` }),
          name: member.name,
          type: member.type,
          required: !member.optional,
          ...(member.values.length > 0 ? { values: member.values } : {}),
          source: { type: 'inherited', name: fullType }
        });
      }
    } else {
      const baseInterface =
        this.findInterface(sourceFile, baseType) ?? this.resolveOmitBaseInterface(heritageType);
      for (const member of baseInterface?.members ?? []) {
        if (!ts.isPropertySignature(member)) continue;
        const prop = this.extractPropFromMember(member);
        if (!prop || !pickedKeys.has(prop.name)) continue;
        prop.source = { type: 'inherited', name: fullType };
        props.push(prop);
      }
    }

    return { typeName: fullType, source: 'pick-pattern', props };
  }

  private handleHTMLAttributes(typeName: string): InheritanceInfo {
    console.log(`🌐 Handling HTML attributes: ${typeName}`);

    const elementType = this.extractElementType(typeName);
    const url = `https://developer.mozilla.org/en-US/docs/Web/HTML/Element/${elementType.toLowerCase()}`;

    const props: PropInfo[] = [
      {
        name: `...${elementType}Attributes`,
        type: 'HTMLAttributes',
        required: false,
        description: `All standard HTML ${elementType.toLowerCase()} attributes`,
        source: {
          type: 'inherited',
          name: typeName,
          package: 'svelte/elements',
          ...(url ? { url } : {})
        }
      }
    ];

    return {
      typeName,
      source: 'html-attributes',
      props,
      ...(url ? { url } : {})
    };
  }

  private handleKnownInterface(typeName: string): InheritanceInfo {
    const knownInterface = this.knownInterfaces.get(typeName);
    if (!knownInterface) {
      throw new Error(`handleKnownInterface called for unknown interface: ${typeName}`);
    }
    console.log(`📚 Handling known interface: ${typeName} from ${knownInterface.package}`);

    const props: PropInfo[] = [
      {
        name: `...${typeName}`,
        type: typeName,
        required: false,
        description: knownInterface.description || `Properties from ${typeName}`,
        source: {
          type: 'inherited',
          name: typeName,
          package: knownInterface.package,
          ...(knownInterface.url ? { url: knownInterface.url } : {})
        }
      }
    ];

    return {
      typeName,
      source: knownInterface.package,
      props,
      ...(knownInterface.url ? { url: knownInterface.url } : {})
    };
  }

  private async handleLocalInterface(
    interfaceNode: ts.InterfaceDeclaration,
    typeName: string,
    sourceFile: ts.SourceFile,
    depth: number
  ): Promise<InheritanceInfo> {
    console.log(`📋 Handling local interface: ${typeName}`);

    const props: PropInfo[] = [];

    // Extract props from local interface
    for (const member of interfaceNode.members) {
      if (ts.isPropertySignature(member)) {
        const prop = this.extractPropFromMember(member);
        if (prop) {
          prop.source = {
            type: 'inherited',
            name: typeName
          };
          props.push(prop);
        }
      }
    }

    // Recursively extract inheritance from this interface
    const nestedInheritance = await this.extractInheritanceFromInterface(
      interfaceNode,
      sourceFile,
      depth
    );

    // Flatten nested inheritance props
    nestedInheritance.forEach((inheritance) => {
      props.push(...inheritance.props);
    });

    return {
      typeName,
      source: 'local-interface',
      props
    };
  }

  private handleExternalType(
    typeName: string,
    heritageType: ts.ExpressionWithTypeArguments
  ): InheritanceInfo {
    console.log(`🌍 Handling external type: ${typeName}`);

    // Try to resolve common external types
    const packageName = this.getPackageForType(typeName);
    const url = this.getUrlForType(typeName);
    // A generic utility type describes its base, never itself — `...Partial`
    // is as useless a prop name as the `...Pick` this class of bug was named
    // for. Name the placeholder after what is being transformed.
    const placeholderName = TypeScriptBaseExtractor.isUtilityTypeName(typeName)
      ? (this.heritageBaseTypeText(heritageType) ?? typeName)
      : typeName;

    const props: PropInfo[] = [
      {
        name: `...${placeholderName}`,
        type: typeName,
        required: false,
        description: `Properties inherited from ${placeholderName}`,
        source: {
          type: 'inherited',
          name: typeName,
          ...(packageName ? { package: packageName } : {}),
          ...(url ? { url } : {})
        }
      }
    ];

    return {
      typeName,
      source: packageName || 'external',
      props,
      ...(url ? { url } : {})
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private isOmitPattern(heritageType: ts.ExpressionWithTypeArguments): boolean {
    return heritageType.expression.getText().startsWith('Omit');
  }

  private isPickPattern(heritageType: ts.ExpressionWithTypeArguments): boolean {
    return heritageType.expression.getText() === 'Pick' && !!heritageType.typeArguments?.length;
  }

  private isHTMLAttributes(typeName: string): boolean {
    return typeName.includes('HTML') && typeName.includes('Attributes');
  }

  private isKnownInterface(typeName: string): boolean {
    return this.knownInterfaces.has(typeName);
  }

  private extractElementType(typeName: string): string {
    const match = typeName?.match(/HTML(\w+)Attributes/);
    return match?.[1] ? match[1] : 'Element';
  }

  private parseOmittedKeys(omittedKeys: string): string[] {
    // Handle union types: 'key1' | 'key2' | 'key3'
    const keys = omittedKeys
      .split('|')
      .map((key) => key.trim().replace(/['"]/g, ''))
      .filter((key) => key.length > 0);

    return keys;
  }

  private getPackageForType(typeName: string): string | undefined {
    const packageMap: Record<string, string> = {
      Snippet: 'svelte',
      ComponentEvents: 'svelte',
      MintProp: '@urbicon-ui/blocks',
      ComponentIntent: '@urbicon-ui/blocks',
      ComponentSize: '@urbicon-ui/blocks',
      HTMLButtonAttributes: 'svelte/elements',
      HTMLInputAttributes: 'svelte/elements',
      HTMLDivAttributes: 'svelte/elements'
    };

    return packageMap[typeName];
  }

  private getUrlForType(typeName: string): string | undefined {
    // Urbicon token/interaction types map to the real `/customization/tokens`
    // reference (the old `/docs/design-tokens` + `/docs/mint-system` routes
    // never existed). Keep in sync with APIDataGenerator.getUrbiconTypeLink.
    const urlMap: Record<string, string> = {
      Snippet: 'https://svelte.dev/docs/svelte/snippet',
      ComponentEvents: 'https://svelte.dev/docs/svelte/component-events',
      MintProp: '/customization/tokens#interaction',
      ComponentIntent: '/customization/tokens#colors',
      ComponentSize: '/customization/tokens'
    };

    return urlMap[typeName];
  }

  private extractPropFromMember(member: ts.PropertySignature): PropInfo | null {
    const propName = this.getPropertyName(member);
    if (!propName) return null;

    const propType = this.getTypeString(member.type);
    const isRequired = this.isPropertyRequired(member);
    const description = this.extractJSDocComment(member) || noJsDocDescription(propName);

    return {
      name: propName,
      type: propType,
      required: isRequired,
      description,
      source: { type: 'inherited' } // Will be updated by caller
    };
  }

  private addDefaultKnownInterfaces(): void {
    const defaultInterfaces: KnownInterfaceConfig[] = [
      {
        name: 'Snippet',
        package: 'svelte',
        url: 'https://svelte.dev/docs/svelte/snippet',
        description: 'Svelte snippet for reusable content'
      },
      {
        name: 'ComponentEvents',
        package: 'svelte',
        url: 'https://svelte.dev/docs/svelte/component-events',
        description: 'Svelte component event handlers'
      },
      {
        name: 'MintProp',
        package: '@urbicon-ui/blocks',
        url: '/customization/tokens#interaction',
        description: 'Urbicon Mint micro-interaction system'
      },
      {
        name: 'ComponentIntent',
        package: '@urbicon-ui/blocks',
        url: '/customization/tokens#colors',
        description: 'Urbicon component intent colors'
      },
      {
        name: 'ComponentSize',
        package: '@urbicon-ui/blocks',
        url: '/customization/tokens',
        description: 'Urbicon component sizes'
      }
    ];

    defaultInterfaces.forEach((iface) => {
      this.knownInterfaces.set(iface.name, iface);
    });
  }

  /**
   * Add a known interface configuration
   */
  addKnownInterface(config: KnownInterfaceConfig): void {
    this.knownInterfaces.set(config.name, config);
  }

  /**
   * Clear any caches
   */
  clearCache(): void {
    // No persistent cache in this implementation
  }
}
