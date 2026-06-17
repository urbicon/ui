#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

class I18nAnalyzer {
  constructor() {
    this.translations = new Map(); // packageName -> { locale -> { key -> value } }
    this.usedKeys = new Set();
    this.keyUsages = new Map(); // key -> [{ file, line, context }]
    this.translationFiles = new Map(); // file -> { package, locale }
    this.allKeys = new Set();
    this.packageKeys = new Map(); // packageName -> Set of keys
    this.hardcodedStrings = new Map(); // string -> [{ file, line, context, isWrapped }]
    this.translationValues = new Map(); // value -> [{ key, package, locale }]
    this.showDebug = true; // Show debug information by default
    this.outputLimit = null; // No output limit by default
  }

  // Find all translation files in the workspace using Bun's native glob
  async findTranslationFiles(directories) {
    const patterns = [
      '**/translations/*.ts',
      '**/lib/translations/*.ts',
      '**/src/lib/translations/*.ts',
      '**/src/lib/system/I18n/translations/*.ts'
    ];

    const files = new Set();

    await Promise.all(
      directories.flatMap((dir) =>
        patterns.map(async (pattern) => {
          const fullPattern = join(dir, pattern);
          try {
            const glob = new Bun.Glob(pattern);
            const matches = await Array.fromAsync(
              glob.scan({
                cwd: dir,
                absolute: true,
                onlyFiles: true
              })
            );

            const filtered = matches.filter(
              (file) =>
                !file.includes('node_modules') &&
                !file.includes('/dist/') &&
                !file.includes('/build/') &&
                file.includes('/src/') &&
                !file.endsWith('.d.ts')
            );
            filtered.forEach((file) => {
              files.add(file);
            });
          } catch (error) {
            console.warn(
              `${colors.yellow}Warning: Could not glob ${fullPattern}: ${error.message}${colors.reset}`
            );
          }
        })
      )
    );

    return Array.from(files);
  }

  // Extract package name from file path
  getPackageFromPath(filePath) {
    if (filePath.includes('/blocks/')) return 'blocks';
    if (filePath.includes('/table/')) return 'table';
    if (filePath.includes('/packages/')) {
      const match = filePath.match(/\/packages\/([^/]+)\//);
      return match ? match[1] : 'unknown';
    }
    return 'unknown';
  }

  // Flatten nested object to dot notation
  flattenObject(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (typeof value === 'string') {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  // Parse translation file with support for export default and dot-notation keys
  parseTranslationFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const locale = basename(filePath, '.ts');
      const packageName = this.getPackageFromPath(filePath);

      this.translationFiles.set(filePath, { package: packageName, locale });

      const keys = new Map();

      // Try to evaluate the file as JavaScript object
      try {
        // Clean TypeScript syntax and prepare for evaluation
        const cleanContent = content
          .replace(/export\s+default\s+/g, '') // Remove export default
          .replace(/export\s+(const|let|var)\s+/g, 'const ') // Remove export
          .replace(/import\s+.*?from\s+.*?['"]\s*;?\s*/g, '') // Remove imports
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
          .replace(/\/\/.*$/gm, '') // Remove line comments
          .replace(/\s+as\s+const\s*;?\s*$/, '') // Remove TypeScript 'as const'
          .trim();

        // Handle different export patterns
        let objectCode;

        // Pattern 1: export default { ... }
        const exportDefaultMatch = cleanContent.match(/^{\s*([\s\S]*)\s*}$/);
        if (exportDefaultMatch) {
          objectCode = `{${exportDefaultMatch[1]}}`;
        } else {
          // Pattern 2: const name = { ... }; export default name;
          const constMatch = cleanContent.match(
            /(?:const|let|var)\s+(\w+)\s*=\s*({[\s\S]*?});?\s*$/m
          );
          if (constMatch) {
            objectCode = constMatch[2];
          } else {
            throw new Error('No recognizable object pattern found');
          }
        }

        if (objectCode) {
          // Safely evaluate the object
          const translationObject = new Function(`return ${objectCode}`)();

          // Flatten nested objects to dot notation
          // e.g. { accessibility: { avatar: 'Avatar' } } → { 'accessibility.avatar': 'Avatar' }
          const flattened = this.flattenObject(translationObject);

          for (const [key, value] of Object.entries(flattened)) {
            keys.set(key, value);
            this.allKeys.add(key);

            if (!this.packageKeys.has(packageName)) {
              this.packageKeys.set(packageName, new Set());
            }
            this.packageKeys.get(packageName).add(key);
          }

          const relativePath = relative(process.cwd(), filePath);
          console.log(
            `  ${colors.gray}${relativePath}: found ${keys.size} keys (dot-notation parsed)${colors.reset}`
          );
        }
      } catch (evalError) {
        // Enhanced regex fallback for dot-notation keys
        console.warn(
          `${colors.yellow}Warning: Could not evaluate ${filePath}, using enhanced regex: ${evalError.message}${colors.reset}`
        );

        // Enhanced patterns for dot-notation keys like 'accessibility.avatar': 'Avatar'
        const patterns = [
          // Single quotes: 'accessibility.avatar': 'Avatar'
          /'([^']+)'\s*:\s*'([^']*)'/g,
          // Double quotes: "accessibility.avatar": "Avatar"
          /"([^"]+)"\s*:\s*"([^"]*)"/g,
          // Template literals: 'key': `value`
          /'([^']+)'\s*:\s*`([^`]*)`/g,
          // Mixed quotes: "key": 'value'
          /"([^"]+)"\s*:\s*'([^']*)'/g,
          /'([^']+)'\s*:\s*"([^"]*)"/g
        ];

        for (const pattern of patterns) {
          for (const match of content.matchAll(pattern)) {
            const key = match[1];
            const value = match[2];

            if (key && value !== undefined) {
              keys.set(key, value);
              this.allKeys.add(key);

              if (!this.packageKeys.has(packageName)) {
                this.packageKeys.set(packageName, new Set());
              }
              this.packageKeys.get(packageName).add(key);
            }
          }
        }

        const relativePath = relative(process.cwd(), filePath);
        console.log(
          `  ${colors.gray}${relativePath}: found ${keys.size} keys (regex fallback)${colors.reset}`
        );
      }

      // Store in translations map
      if (!this.translations.has(packageName)) {
        this.translations.set(packageName, new Map());
      }
      this.translations.get(packageName).set(locale, keys);

      // Build reverse lookup for translation values
      for (const [key, value] of keys) {
        if (!this.translationValues.has(value)) {
          this.translationValues.set(value, []);
        }
        this.translationValues.get(value).push({ key, package: packageName, locale });
      }

      return keys;
    } catch (error) {
      console.warn(
        `${colors.yellow}Warning: Could not parse ${filePath}: ${error.message}${colors.reset}`
      );
      return new Map();
    }
  }

  // Find all source files to analyze
  async findSourceFiles(directories) {
    const patterns = ['**/*.svelte', '**/*.ts', '**/*.js', '**/*.vue'];

    const files = new Set();

    await Promise.all(
      directories.flatMap((dir) =>
        patterns.map(async (pattern) => {
          try {
            const glob = new Bun.Glob(pattern);
            const matches = await Array.fromAsync(
              glob.scan({
                cwd: dir,
                absolute: true,
                onlyFiles: true
              })
            );

            const filtered = matches.filter(
              (file) =>
                !file.includes('node_modules') &&
                !file.includes('/dist/') &&
                !file.includes('/build/') &&
                !file.includes('/.svelte-kit/') &&
                !file.includes('/translations/') &&
                !file.includes('/scripts/') &&
                !file.endsWith('.d.ts') &&
                !file.includes('.test.') &&
                !file.includes('.spec.') &&
                file.includes('/src/')
            );

            filtered.forEach((file) => {
              files.add(file);
            });
          } catch (error) {
            console.warn(
              `${colors.yellow}Warning: Could not glob ${pattern} in ${dir}: ${error.message}${colors.reset}`
            );
          }
        })
      )
    );

    return Array.from(files);
  }

  // Analyze source file for translation key usage with enhanced patterns
  analyzeSourceFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Enhanced patterns to find translation usage - more comprehensive
      const wrappedPatterns = [
        // Standard patterns: t('key'), t("key"), t(`key`)
        /\bt\s*\(\s*(['"`])([^'"`]+)\1[^)]*\)/g,
        // Package-specific functions: bt('key'), tt('key'), blocksT('key'), etc.
        /\b(?:bt|tableT|tt|blocksT|docsT|td|componentsT)\s*\(\s*(['"`])([^'"`]+)\1[^)]*\)/g,
        // i18n.t('key') - common pattern
        /\bi18n\.t\s*\(\s*(['"`])([^'"`]+)\1[^)]*\)/g,
        // T component in Svelte: <T key="value" />
        /<T[^>]+key\s*=\s*(['"`])([^'"`]+)\1[^>]*>/g,
        // Destructured t function: const { t } = ...; t('key')
        /(?:const|let|var)\s*{\s*t\s*}[\s\S]*?\bt\s*\(\s*(['"`])([^'"`]+)\1[^)]*\)/g,
        // $t store in Svelte: $t('key')
        /\$t\s*\(\s*(['"`])([^'"`]+)\1[^)]*\)/g
      ];

      for (const pattern of wrappedPatterns) {
        for (const match of content.matchAll(pattern)) {
          const key = match[2];
          const lineNumber = content.substring(0, match.index).split('\n').length;
          const line = lines[lineNumber - 1]?.trim() || '';

          // Skip empty keys or obvious false positives
          if (!key || key.length === 0) continue;

          this.usedKeys.add(key);

          if (!this.keyUsages.has(key)) {
            this.keyUsages.set(key, []);
          }

          this.keyUsages.get(key).push({
            file: filePath,
            line: lineNumber,
            context: line,
            isWrapped: true
          });

          // Debug output for found keys (only if debug enabled)
          if (this.showDebug && key.includes('accessibility.avatar')) {
            const relativePath = relative(process.cwd(), filePath);
            console.log(
              `  ${colors.cyan}DEBUG: Found key '${key}' in ${relativePath}:${lineNumber}${colors.reset}`
            );
            console.log(`  ${colors.gray}Context: ${line}${colors.reset}`);
          }
        }
      }

      // Find hardcoded strings for Svelte files only
      if (filePath.endsWith('.svelte')) {
        this.findHardcodedStrings(filePath, content, lines);
      }
    } catch (error) {
      console.warn(
        `${colors.yellow}Warning: Could not analyze ${filePath}: ${error.message}${colors.reset}`
      );
    }
  }

  // Find hardcoded strings that should be translated
  findHardcodedStrings(filePath, content, lines) {
    const hardcodedPatterns = [
      // Strings in HTML content: >text<
      />([^<>{}\n]{3,50})</g,
      // Strings in attributes
      /(?:aria-label|title|placeholder|alt)\s*=\s*['"`]([^'"`]{3,50})['"`]/g,
      // Strings in Svelte interpolation: {text}
      /{\s*['"`]([^'"`]{3,50})['"`]\s*}/g
    ];

    for (const pattern of hardcodedPatterns) {
      for (const match of content.matchAll(pattern)) {
        const text = match[1].trim();

        if (this.shouldSkipString(text)) continue;

        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNumber - 1]?.trim() || '';

        const isWrapped = this.isStringWrapped(content, match.index);

        if (!this.hardcodedStrings.has(text)) {
          this.hardcodedStrings.set(text, []);
        }

        this.hardcodedStrings.get(text).push({
          file: filePath,
          line: lineNumber,
          context: line,
          isWrapped
        });
      }
    }
  }

  shouldSkipString(text) {
    if (text.length < 3 || text.length > 50) return true;

    const skipPatterns = [
      /^[a-z][a-zA-Z]*$/,
      /^[A-Z_]+$/,
      /[{}[\]()]/,
      /^[0-9.]+$/,
      /@|#|\$|%|&|\||=/,
      /^https?:/,
      /^\w+\.\w+/,
      /^\s*$/,
      /class|function|const|let|var|if|else|return|import|export/,
      /^[a-z]+[A-Z]/,
      /\s*\|\s*/,
      /^[a-z]+\(/,
      /^aria-/,
      /Enter|Escape|Delete|Backspace/
    ];

    return skipPatterns.some((pattern) => pattern.test(text));
  }

  isStringWrapped(content, stringIndex) {
    const beforeString = content.substring(Math.max(0, stringIndex - 50), stringIndex);

    const wrapperPatterns = [
      /\bt\s*\(\s*['"`]?$/,
      /\btableT\s*\(\s*['"`]?$/,
      /\bi18n\.t\s*\(\s*['"`]?$/,
      /<T[^>]*key\s*=\s*['"`]?$/
    ];

    return wrapperPatterns.some((pattern) => pattern.test(beforeString));
  }

  // Improved unused key detection
  findUnusedKeys() {
    const unusedKeys = new Map();

    for (const [packageName, packageKeySet] of this.packageKeys) {
      const unused = [];

      for (const key of packageKeySet) {
        // Check various usage patterns:
        // 1. Direct usage: t('accessibility.avatar')
        // 2. Package prefixed: t('blocks.accessibility.avatar')
        // 3. Cross-package usage: blocksT('accessibility.avatar')

        const isUsed =
          this.usedKeys.has(key) ||
          this.usedKeys.has(`${packageName}.${key}`) ||
          this.isKeyCrossPackageUsed(packageName, key);

        if (!isUsed) {
          unused.push(key);
        }
      }

      if (unused.length > 0) {
        unusedKeys.set(packageName, unused);
      }
    }

    return unusedKeys;
  }

  isKeyCrossPackageUsed(packageName, key) {
    // Check if any usage includes this package.key combination
    for (const usedKey of this.usedKeys) {
      if (usedKey === `${packageName}.${key}`) {
        return true;
      }

      if (usedKey.includes('.') && usedKey.endsWith(`.${key}`)) {
        const keyParts = usedKey.split('.');
        if (keyParts.length >= 2) {
          const possiblePackage = keyParts[0];
          if (possiblePackage === packageName) {
            return true;
          }
        }
      }
    }

    if (this.keyUsages.has(key)) {
      for (const usage of this.keyUsages.get(key)) {
        if (
          usage.context.includes(`${packageName}.`) ||
          usage.context.includes(`'${packageName}.${key}'`) ||
          usage.context.includes(`"${packageName}.${key}"`)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  // Find missing translations with proper cross-package lookup
  findMissingTranslations() {
    const missing = new Map();

    const allLocales = new Set();
    for (const [, localeMap] of this.translations) {
      for (const locale of localeMap.keys()) {
        allLocales.add(locale);
      }
    }

    for (const usedKey of this.usedKeys) {
      if (usedKey.includes('${') || usedKey.includes('`') || usedKey.includes('{{')) continue;

      // FIRST: check as a global key across all packages
      this.checkGlobalKeyAvailability(usedKey, allLocales, missing);

      // ADDITIONALLY: also check package-specific logic (if needed)
      // But remove the "continue" that prevents the global check!
      if (usedKey.includes('.') && this.isExplicitPackageReference(usedKey)) {
        // Only for real package-specific keys not found globally
        // This logic is optional and could even be removed
      }
    }

    return missing;
  }

  isExplicitPackageReference(key) {
    const parts = key.split('.');
    if (parts.length < 2) return false;

    const possiblePackage = parts[0];
    return this.translations.has(possiblePackage);
  }

  checkExplicitPackageKey(usedKey, allLocales, missing) {
    const parts = usedKey.split('.');
    const packageName = parts[0];
    const keyPart = parts.slice(1).join('.');

    const packageTranslations = this.translations.get(packageName);
    if (!packageTranslations) {
      for (const locale of allLocales) {
        this.addMissingKey(missing, locale, usedKey);
      }
      return;
    }

    for (const locale of allLocales) {
      const localeKeys = packageTranslations.get(locale);
      if (!localeKeys?.has(keyPart)) {
        this.addMissingKey(missing, locale, usedKey);
      }
    }
  }

  checkGlobalKeyAvailability(usedKey, allLocales, missing) {
    for (const locale of allLocales) {
      let foundInAnyPackage = false;

      for (const [, localeMap] of this.translations) {
        const localeKeys = localeMap.get(locale);
        if (localeKeys?.has(usedKey)) {
          foundInAnyPackage = true;
          break;
        }
      }

      if (!foundInAnyPackage) {
        this.addMissingKey(missing, locale, usedKey);
      }
    }
  }

  addMissingKey(missing, locale, key) {
    if (!missing.has(locale)) {
      missing.set(locale, []);
    }

    if (!missing.get(locale).includes(key)) {
      missing.get(locale).push(key);
    }
  }

  // Generate hardcoded strings report
  generateHardcodedStringsReport() {
    if (this.hardcodedStrings.size === 0) return;

    console.log(`\n${colors.bright}${colors.magenta}🔤 Hardcoded Strings Analysis${colors.reset}`);
    console.log(`${colors.gray}${'─'.repeat(45)}${colors.reset}`);

    const unwrappedStrings = new Map();
    const wrappedStrings = new Map();

    for (const [text, usages] of this.hardcodedStrings) {
      const unwrapped = usages.filter((u) => !u.isWrapped);
      const wrapped = usages.filter((u) => u.isWrapped);

      if (unwrapped.length > 0) {
        unwrappedStrings.set(text, unwrapped);
      }
      if (wrapped.length > 0) {
        wrappedStrings.set(text, wrapped);
      }
    }

    if (unwrappedStrings.size > 0) {
      console.log(
        `\n${colors.bright}${colors.red}🚨 Unwrapped Strings (Need Translation)${colors.reset}`
      );
      console.log(
        `${colors.gray}These strings should be wrapped in translation functions:${colors.reset}\n`
      );

      for (const [text, usages] of unwrappedStrings) {
        console.log(`${colors.red}📍 "${text}"${colors.reset}`);

        const possibleTranslations = this.findPossibleTranslations(text);
        if (possibleTranslations.length > 0) {
          console.log(`  ${colors.cyan}💡 Possible translations found:${colors.reset}`);
          for (const trans of possibleTranslations) {
            console.log(
              `    ${colors.gray}${trans.package}.${trans.locale}:${colors.reset} ${colors.green}'${trans.key}'${colors.reset}`
            );
          }
        }

        for (const usage of usages.slice(0, 3)) {
          const relativePath = relative(process.cwd(), usage.file);
          console.log(`  ${colors.gray}used in: ${relativePath}:${usage.line}${colors.reset}`);
          console.log(
            `  ${colors.gray}context: ${usage.context.substring(0, 80)}...${colors.reset}`
          );
        }

        if (usages.length > 3) {
          console.log(`  ${colors.gray}... and ${usages.length - 3} more locations${colors.reset}`);
        }
        console.log('');
      }
    }

    if (wrappedStrings.size > 0) {
      console.log(
        `\n${colors.bright}${colors.green}✅ Wrapped Strings (Already Translated)${colors.reset}`
      );
      console.log(
        `${colors.gray}These strings are already in translation functions:${colors.reset}\n`
      );

      const sortedWrapped = Array.from(wrappedStrings.entries())
        .sort(([, a], [, b]) => b.length - a.length)
        .slice(0, 5);

      for (const [text, usages] of sortedWrapped) {
        console.log(
          `  ${colors.green}✓${colors.reset} "${text}" ${colors.gray}(${usages.length} uses)${colors.reset}`
        );
      }
    }

    console.log(`\n${colors.bright}📊 Hardcoded Strings Summary:${colors.reset}`);
    console.log(
      `  • ${colors.red}${unwrappedStrings.size} strings need translation wrapping${colors.reset}`
    );
    console.log(`  • ${colors.green}${wrappedStrings.size} strings already wrapped${colors.reset}`);
    console.log(
      `  • ${colors.blue}${this.hardcodedStrings.size} total strings analyzed${colors.reset}`
    );
  }

  findPossibleTranslations(text) {
    const matches = [];

    if (this.translationValues.has(text)) {
      matches.push(...this.translationValues.get(text));
    }

    for (const [value, translations] of this.translationValues) {
      if (value !== text && this.stringSimilarity(text, value) > 0.8) {
        matches.push(
          ...translations.map((t) => ({ ...t, similarity: this.stringSimilarity(text, value) }))
        );
      }
    }

    return matches.slice(0, 3);
  }

  stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Generate detailed report with debug information
  generateReport(unusedKeys, missingTranslations) {
    console.log(`\n${colors.bright}${colors.blue}🌍 I18n Analysis Report${colors.reset}`);
    console.log(`${colors.gray}${'='.repeat(50)}${colors.reset}\n`);

    const totalUnused = Array.from(unusedKeys.values()).reduce((sum, keys) => sum + keys.length, 0);
    const totalMissing = Array.from(missingTranslations.values()).reduce(
      (sum, keys) => sum + keys.length,
      0
    );

    console.log(`${colors.bright}📊 Summary:${colors.reset}`);
    console.log(`  • ${colors.red}${totalUnused} unused keys${colors.reset}`);
    console.log(`  • ${colors.yellow}${totalMissing} missing translations${colors.reset}`);
    console.log(`  • ${colors.green}${this.usedKeys.size} keys in use${colors.reset}`);
    console.log(`  • ${colors.blue}${this.allKeys.size} total keys${colors.reset}`);
    console.log(
      `  • ${colors.magenta}${this.translations.size} packages analyzed${colors.reset}\n`
    );

    // Debug information for troubleshooting (optional)
    if (this.showDebug) {
      console.log(`${colors.bright}${colors.cyan}🔍 Debug Information${colors.reset}`);
      console.log(`${colors.gray}${'─'.repeat(40)}${colors.reset}`);

      // Show all found translation keys for debugging
      console.log(`\n${colors.cyan}Found Translation Keys:${colors.reset}`);
      for (const [packageName, packageKeySet] of this.packageKeys) {
        console.log(
          `  ${colors.cyan}${packageName}:${colors.reset} ${Array.from(packageKeySet).slice(0, 5).join(', ')}${packageKeySet.size > 5 ? '...' : ''} (${packageKeySet.size} total)`
        );
      }

      // Show used keys that contain 'accessibility' for debugging
      console.log(`\n${colors.cyan}Used Keys (accessibility.* sample):${colors.reset}`);
      const accessibilityKeys = Array.from(this.usedKeys).filter((key) =>
        key.includes('accessibility')
      );
      if (accessibilityKeys.length > 0) {
        for (const key of accessibilityKeys.slice(0, 10)) {
          console.log(`  ${colors.green}✓${colors.reset} ${key}`);
        }
      } else {
        console.log(`  ${colors.yellow}No accessibility keys found in usage${colors.reset}`);
      }
    }

    // Unused keys report
    if (totalUnused > 0) {
      console.log(`\n${colors.bright}${colors.red}🗑️  Unused Translation Keys${colors.reset}`);
      console.log(`${colors.gray}${'─'.repeat(40)}${colors.reset}`);

      for (const [packageName, keys] of unusedKeys) {
        console.log(
          `\n${colors.bright}📦 Package: ${colors.cyan}${packageName}${colors.reset} ${colors.gray}(${keys.length} unused)${colors.reset}`
        );

        // Respect output limit if set
        const keysToShow = this.outputLimit ? keys.slice(0, this.outputLimit) : keys;
        const remainingKeys = this.outputLimit ? Math.max(0, keys.length - this.outputLimit) : 0;

        for (const key of keysToShow) {
          console.log(`  ${colors.red}✗${colors.reset} ${key}`);

          // Check if this key exists in usedKeys (debugging mismatch)
          if (this.usedKeys.has(key)) {
            console.log(
              `    ${colors.yellow}⚠ Actually found in usedKeys - possible bug!${colors.reset}`
            );
          }

          for (const [filePath, info] of this.translationFiles) {
            if (info.package === packageName) {
              const relativePath = relative(process.cwd(), filePath);
              console.log(`    ${colors.gray}defined in: ${relativePath}${colors.reset}`);
              break;
            }
          }
        }

        if (remainingKeys > 0) {
          console.log(
            `  ${colors.gray}... and ${remainingKeys} more keys (use --limit to see more or remove --limit to see all)${colors.reset}`
          );
        }
      }
    }

    // Missing translations report
    if (totalMissing > 0) {
      console.log(`\n${colors.bright}${colors.yellow}⚠️  Missing Translations${colors.reset}`);
      console.log(`${colors.gray}${'─'.repeat(50)}${colors.reset}`);

      for (const [locale, keys] of missingTranslations) {
        console.log(
          `\n${colors.yellow}🔤 Locale: ${locale}${colors.reset} ${colors.gray}(${keys.length} missing)${colors.reset}`
        );

        // Respect output limit if set
        const keysToShow = this.outputLimit ? keys.slice(0, this.outputLimit) : keys;
        const remainingKeys = this.outputLimit ? Math.max(0, keys.length - this.outputLimit) : 0;

        for (const key of keysToShow) {
          console.log(`    ${colors.yellow}⚠${colors.reset}  ${key}`);

          if (this.keyUsages.has(key)) {
            const usages = this.keyUsages.get(key).slice(0, 2); // Still limit usage examples to 2 per key
            for (const usage of usages) {
              const relativePath = relative(process.cwd(), usage.file);
              console.log(
                `      ${colors.gray}used in: ${relativePath}:${usage.line}${colors.reset}`
              );
              console.log(
                `      ${colors.gray}context: ${usage.context.substring(0, 80)}...${colors.reset}`
              );
            }

            if (this.keyUsages.get(key).length > 2) {
              console.log(
                `      ${colors.gray}... and ${this.keyUsages.get(key).length - 2} more usages${colors.reset}`
              );
            }
          }
        }

        if (remainingKeys > 0) {
          console.log(
            `    ${colors.gray}... and ${remainingKeys} more keys (use --limit to see more or remove --limit to see all)${colors.reset}`
          );
        }
      }
    }

    this.generateHardcodedStringsReport();

    // Key usage report
    console.log(`\n${colors.bright}${colors.green}📈 Most Used Keys${colors.reset}`);
    console.log(`${colors.gray}${'─'.repeat(30)}${colors.reset}`);

    const sortedUsages = Array.from(this.keyUsages.entries())
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 10);

    for (const [key, usages] of sortedUsages) {
      const packages = new Set(usages.map((u) => this.getPackageFromPath(u.file)));
      const packageList =
        packages.size > 1
          ? ` ${colors.gray}[${Array.from(packages).join(', ')}]${colors.reset}`
          : '';
      console.log(
        `  ${colors.green}${key}${colors.reset} ${colors.gray}(${usages.length} uses)${colors.reset}${packageList}`
      );
    }

    console.log(`\n${colors.gray}${'='.repeat(50)}${colors.reset}`);
    console.log(
      `${colors.bright}Analysis complete!${colors.reset} ${colors.gray}(powered by Bun)${colors.reset}`
    );

    if (totalUnused > 0 || totalMissing > 0) {
      console.log(
        `${colors.red}Issues found. Consider cleaning up unused keys and adding missing translations.${colors.reset}`
      );
      process.exit(1);
    } else {
      console.log(
        `${colors.green}✅ All translations are properly used and complete!${colors.reset}`
      );
      process.exit(0);
    }
  }

  // Main analysis function
  async analyze(directories) {
    const startTime = performance.now();

    console.log(`${colors.bright}🔍 Analyzing I18n usage in directories:${colors.reset}`);
    for (const dir of directories) {
      console.log(`  ${colors.cyan}${dir}${colors.reset}`);
    }
    console.log('');

    try {
      console.log(`${colors.blue}📁 Finding translation files...${colors.reset}`);
      const translationFiles = await this.findTranslationFiles(directories);
      console.log(`Found ${translationFiles.length} translation files\n`);

      const batchSize = 10;
      for (let i = 0; i < translationFiles.length; i += batchSize) {
        const batch = translationFiles.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (file) => {
            const relativePath = relative(process.cwd(), file);
            console.log(`  ${colors.gray}parsing: ${relativePath}${colors.reset}`);
            this.parseTranslationFile(file);
          })
        );
      }

      console.log(`\n${colors.blue}📝 Analyzing source files...${colors.reset}`);
      const sourceFiles = await this.findSourceFiles(directories);
      console.log(`Found ${sourceFiles.length} source files\n`);

      let analyzedCount = 0;
      const sourceBatchSize = 50;

      for (let i = 0; i < sourceFiles.length; i += sourceBatchSize) {
        const batch = sourceFiles.slice(i, i + sourceBatchSize);
        await Promise.all(
          batch.map(async (file) => {
            this.analyzeSourceFile(file);
            analyzedCount++;
          })
        );

        console.log(
          `  ${colors.gray}analyzed ${analyzedCount}/${sourceFiles.length} files...${colors.reset}`
        );
      }

      console.log(`\n${colors.blue}📊 Generating reports...${colors.reset}`);
      const unusedKeys = this.findUnusedKeys();
      const missingTranslations = this.findMissingTranslations();

      const endTime = performance.now();
      console.log(
        `${colors.gray}Analysis completed in ${(endTime - startTime).toFixed(2)}ms${colors.reset}\n`
      );

      this.generateReport(unusedKeys, missingTranslations);
    } catch (error) {
      console.error(`${colors.red}Error during analysis: ${error.message}${colors.reset}`);
      console.error(`${colors.gray}Stack trace: ${error.stack}${colors.reset}`);
      process.exit(1);
    }
  }
}

// CLI Interface with output control options
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`${colors.bright}I18n Analyzer Tool${colors.reset} ${colors.gray}(fixed nested object parsing)${colors.reset}
    
${colors.bright}Usage:${colors.reset}
  bun run i18n-analyzer.js <directory1> [directory2] ... [options]
  
${colors.bright}Examples:${colors.reset}
  bun run i18n-analyzer.js packages/blocks
  bun run i18n-analyzer.js packages/blocks packages/table
  bun run i18n-analyzer.js packages/table --limit 10
  
${colors.bright}Options:${colors.reset}
  --help, -h      Show this help message
  --limit N       Limit output to N items per category (default: unlimited)
  --no-debug      Hide debug information
  
${colors.bright}What it does:${colors.reset}
  • Properly parses nested translation objects (accessibility.avatar)
  • Finds unused translation keys across packages
  • Identifies missing translations in different locales
  • Shows hardcoded strings that need translation
  • Provides detailed reports for cleanup guidance
  
${colors.bright}Features:${colors.reset}
  • Fixed nested object parsing with JavaScript evaluation
  • Enhanced pattern matching for modern syntax
  • Package-aware analysis with smart fallbacks
  • Better debugging output
  • Full output by default (no truncation)
`);
    process.exit(0);
  }

  // Parse command line arguments
  const directories = args.filter((arg) => !arg.startsWith('--'));
  const limitIndex = args.indexOf('--limit');
  const outputLimit =
    limitIndex !== -1 && limitIndex + 1 < args.length ? parseInt(args[limitIndex + 1], 10) : null;
  const showDebug = !args.includes('--no-debug');

  const invalidDirs = directories.filter((dir) => !existsSync(dir));

  if (invalidDirs.length > 0) {
    console.error(`${colors.red}Error: The following directories do not exist:${colors.reset}`);
    for (const dir of invalidDirs) {
      console.error(`  ${colors.red}✗${colors.reset} ${dir}`);
    }
    process.exit(1);
  }

  if (directories.length === 0) {
    console.error(`${colors.red}Error: No valid directories specified.${colors.reset}`);
    process.exit(1);
  }

  try {
    const analyzer = new I18nAnalyzer();
    analyzer.showDebug = showDebug;
    analyzer.outputLimit = outputLimit;
    await analyzer.analyze(directories);
  } catch (error) {
    console.error(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

export default I18nAnalyzer;
