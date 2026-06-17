# I18n Analyzer Tool

Ein intelligentes Tool zur Analyse von Übersetzungsschlüsseln in deinem Urbicon UI Projekt.

## 🚀 Quick Start

```bash
# Alle Packages analysieren
bun run i18n:check

# Einzelne Packages
bun run i18n:blocks    # Nur blocks package
bun run i18n:table     # Nur table package
bun run i18n:docs      # Nur docs app

# Benutzerdefinierte Verzeichnisse
bun run i18n:analyze packages/blocks packages/table
node packages/blocks/scripts/i18n-analyzer.js apps/docs
```

## 📋 Was das Tool macht

### 1. **🗑️ Ungenutzte Übersetzungsschlüssel finden**

Identifiziert Translation-Keys, die definiert sind aber nirgendwo verwendet werden:

```
🗑️  Unused Translation Keys
────────────────────────────────────────
📦 Package: blocks
  ✗ old.button.text
    defined in: packages/blocks/src/lib/system/I18n/translations/en.ts
  ✗ deprecated.message
    defined in: packages/blocks/src/lib/system/I18n/translations/en.ts
```

### 2. **⚠️ Fehlende Übersetzungen finden**

Findet Keys, die in einer Sprache existieren, aber in anderen fehlen:

```
⚠️  Missing Translations
────────────────────────────────────────
📦 Package: table
  🔤 Locale: de
    ⚠  pagination.advanced
      used in: src/components/Table.svelte:45
      context: const text = t('pagination.advanced');
```

### 3. **📈 Nutzungsstatistiken**

Zeigt die am häufigsten verwendeten Keys:

```
📈 Most Used Keys
──────────────────────────────
  save (15 uses)
  loading (12 uses)
  cancel (8 uses)
```

## 🔍 Unterstützte Patterns

Das Tool erkennt verschiedene Verwendungsmuster:

### JavaScript/TypeScript

```typescript
// Package-Hook-Aliasse (in Komponenten: const bt = useBlocksI18n() usw.)
bt('dialog.close');
tt('pagination.showing', { start: 1, end: 10 });
dt('copy');

// Generischer Hook
useI18n().t('common.loading');

// Package.key Notation
bt('blocks.button.save');
tt('table.data.loading');
```

### Svelte Components

```svelte
<!-- In Script -->
<script>
  const bt = useBlocksI18n();
  const message = $derived(bt('validation.required'));
</script>

<!-- T Component -->
<T key="save" />
<T key="messages.welcome" params={{ name: 'Ada' }} />
```

## 📁 Erkannte Dateistrukturen

Das Tool sucht automatisch in:

```
packages/*/src/lib/translations/*.ts
**/translations/*.ts
```

Und analysiert:

```
**/*.svelte
**/*.ts
**/*.js
```

## 🛠️ Beispiele

### Alle Packages prüfen

```bash
bun run i18n:check
```

### Nur bestimmte Verzeichnisse

```bash
# Nur Backend-relevante Pakete
bun run i18n:analyze packages/api packages/auth

# Nur Frontend
bun run i18n:analyze apps/web packages/ui

# Rekursiv alle Packages
bun run i18n:analyze packages/
```

### Output-Beispiel

```
🔍 Analyzing I18n usage in directories:
  packages/blocks
  packages/table

📁 Finding translation files...
Found 4 translation files

  parsing: packages/blocks/src/lib/translations/en.ts
  parsing: packages/blocks/src/lib/translations/de.ts
  parsing: packages/table/src/lib/translations/en.ts
  parsing: packages/table/src/lib/translations/de.ts

📝 Analyzing source files...
Found 156 source files

📊 Generating reports...

🌍 I18n Analysis Report
==================================================

📊 Summary:
  • 3 unused keys
  • 2 missing translations
  • 89 keys in use
  • 97 total keys
```

## ⚙️ Erweiterte Nutzung

### Als NPM Script

```json
{
  "scripts": {
    "i18n:lint": "node packages/blocks/scripts/i18n-analyzer.js",
    "i18n:ci": "bun run i18n:lint packages/ apps/ || exit 1"
  }
}
```

### In CI/CD Pipeline

```yaml
- name: Check I18n
  run: bun run i18n:check
```

Das Tool hat Exit Code 1 bei Problemen, Exit Code 0 wenn alles OK ist.

### Custom Analysis

```javascript
const I18nAnalyzer = require('./packages/blocks/scripts/i18n-analyzer');

const analyzer = new I18nAnalyzer();
analyzer.analyze(['my-custom-package']).then(() => {
  console.log('Analysis complete');
});
```

## 🚨 Troubleshooting

### Tool findet keine Translation-Files

- Überprüfe die Verzeichnisstruktur
- Stelle sicher, dass die Files `*.ts` heißen
- Überprüfe das `export default` Format

### Falsche Unused-Keys-Meldungen

- Das Tool verwendet Regex-Patterns
- Template strings mit Variablen werden möglicherweise nicht erkannt
- Keys in dynamischen Imports werden nicht gefunden

### Performance bei großen Projekten

- Grenze die Verzeichnisse ein
- Nutze spezifische Package-Scripts
- Exclude node_modules ist bereits aktiv

## 📝 Best Practices

1. **Regelmäßig ausführen**: In CI/CD Pipeline integrieren
2. **Vor Releases**: `bun run i18n:check` ausführen
3. **Bei neuen Features**: Translation-Keys direkt hinzufügen
4. **Cleanup**: Unused keys regelmäßig entfernen
5. **Reviews**: I18n-Änderungen in Code Reviews prüfen

Das Tool hilft dabei, dein I18n-System sauber und vollständig zu halten! 🌍✨
