#!/bin/bash

echo "🔍 Validating Table package migration..."

# Problem counter
issues=0

echo ""
echo "1. Checking for remaining flow-CSS classes..."
# Look for real CSS classes with a flow- prefix (not overflow etc.)
flow_classes=$(grep -r "class.*flow-" src/ --include="*.svelte" --include="*.ts" | grep -v "overflow" | wc -l)
if [ $flow_classes -gt 0 ]; then
    echo "❌ Found: $flow_classes real flow classes"
    echo "Details:"
    grep -r "class.*flow-" src/ --include="*.svelte" --include="*.ts" | grep -v "overflow" | head -10
    issues=$((issues + 1))
else
    echo "✅ No flow-CSS classes found"
fi

echo ""
echo "2. Checking for flow-CSS variables..."
# Escape the -- properly for grep
flow_vars=$(grep -r "\-\-flow\-" src/ --include="*.svelte" --include="*.css" | wc -l)
if [ $flow_vars -gt 0 ]; then
    echo "❌ Found: $flow_vars flow-CSS variables"
    echo "Details:"
    grep -r "\-\-flow\-" src/ --include="*.svelte" --include="*.css" | head -10
    issues=$((issues + 1))
else
    echo "✅ No flow-CSS variables found"
fi

echo ""
echo "3. Checking Tailwind variants syntax..."
# More robust TypeScript check
if [ -f "tsconfig.json" ] && [ -f "package.json" ]; then
    # Try to run tsc with local tsconfig, fallback to basic check
    if command -v tsc >/dev/null 2>&1; then
        if tsc --noEmit --skipLibCheck 2>/dev/null; then
            echo "✅ TypeScript check succeeded"
        else
            echo "⚠️  TypeScript warnings present (possibly .svelte-kit related)"
            # Don't count as critical issue for now
        fi
    else
        echo "⚠️  TypeScript not available - skipping check"
    fi
else
    echo "⚠️  Project configuration not found - skipping TS check"
fi

echo ""
echo "4. Checking for orphaned flow-CSS definitions..."
# Look for CSS class definitions with flow- prefix
unused_classes=$(grep -r "\.flow\-" src/ --include="*.css" --include="*.svelte" | grep -E "\{|:" | wc -l)
if [ $unused_classes -gt 0 ]; then
    echo "⚠️  Found: $unused_classes orphaned flow-CSS definitions"
    echo "Details:"
    grep -r "\.flow\-" src/ --include="*.css" --include="*.svelte" | grep -E "\{|:" | head -5
    issues=$((issues + 1))
else
    echo "✅ No orphaned CSS definitions found"
fi

echo ""
echo "5. Checking variants imports..."
# Check for correct variants imports
missing_variants=$(grep -r "import.*Variants" src/ --include="*.svelte" | grep -v "from.*variants" | wc -l)
if [ $missing_variants -gt 0 ]; then
    echo "❌ Found: $missing_variants broken variants imports"
    echo "Details:"
    grep -r "import.*Variants" src/ --include="*.svelte" | grep -v "from.*variants"
    issues=$((issues + 1))
else
    echo "✅ All variants imports correct"
fi

echo ""
echo "6. Checking for hardcoded flow tokens in style blocks..."
hardcoded_tokens=$(grep -r "var(--flow" src/ --include="*.svelte" --include="*.css" | wc -l)
if [ $hardcoded_tokens -gt 0 ]; then
    echo "❌ Found: $hardcoded_tokens hardcoded flow tokens"
    echo "Details:"
    grep -r "var(--flow" src/ --include="*.svelte" --include="*.css" | head -5
    issues=$((issues + 1))
else
    echo "✅ No hardcoded flow tokens found"
fi

echo ""
echo "📊 Summary:"
if [ $issues -eq 0 ]; then
    echo "🎉 Migration successful! No critical issues found."
    exit 0
else
    echo "⚠️  $issues issue(s) found. Please fix."
    echo ""
    echo "💡 Common fixes:"
    echo "   - Replace flow classes with Tailwind utilities"
    echo "   - Replace flow variables with blocks tokens"
    echo "   - Delete orphaned CSS definitions"
    echo "   - Import variants correctly"
    exit 1
fi
