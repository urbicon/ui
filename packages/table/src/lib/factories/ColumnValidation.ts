import type { Column } from '$lib/types/tableTypes';
import { resolveColumnId } from '$lib/utils';
import { isColumnSearchable, isColumnSortable } from '$lib/utils/column-capabilities';

/**
 * Validation utilities for column configurations.
 *
 * In the 2.x column shape, identification is the column's `id` (with a
 * string-accessor fallback). Validation enforces that every column resolves
 * to a non-empty id, that ids are unique within a set, and that no column
 * fails the basic structural checks.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: intentional namespace grouping of column-validation utilities.
export class ColumnValidation {
  /**
   * Validates a single column configuration
   */
  static validateColumn(column: Column): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Identifier validation — `id` is the canonical identifier; for
    // string-accessor columns it may be omitted (falls back to the accessor).
    const id = resolveColumnId(column);
    if (!id || typeof id !== 'string') {
      errors.push(
        'Column requires a non-empty `id` (or a string `accessor` to default the id from)'
      );
    }

    // Accessor validation — synthetic columns omit it, but when present it
    // must be either a string or a function.
    if (column.accessor !== undefined) {
      const accessorType = typeof column.accessor;
      if (accessorType !== 'string' && accessorType !== 'function') {
        errors.push('Column `accessor` must be a string property name or a function');
      }
    }

    // Title validation — empty string is the documented idiom for icon-only
    // columns (e.g. `{ id: 'actions', title: '', component: ActionButtons }`),
    // so only the type is enforced, not non-emptiness.
    if (typeof column.title !== 'string') {
      errors.push("Column `title` must be a string (use '' for icon-only columns)");
    }

    // Width validation
    if (column.width && typeof column.width !== 'string') {
      errors.push('Column width must be a string');
    }

    // MinWidth validation
    if (column.minWidth && typeof column.minWidth !== 'string') {
      errors.push('Column minWidth must be a string');
    }

    // Priority validation
    if (column.priority && ![1, 2, 3].includes(column.priority)) {
      errors.push('Column priority must be 1, 2, or 3');
    }

    // Align validation
    if (column.align && !['left', 'center', 'right'].includes(column.align)) {
      errors.push('Column align must be left, center, or right');
    }

    // DataType validation (only meaningful on data columns)
    const validDataTypes = ['text', 'number', 'date', 'boolean', 'email', 'url'];
    if ('dataType' in column && column.dataType && !validDataTypes.includes(column.dataType)) {
      errors.push(`Column dataType must be one of: ${validDataTypes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates an array of columns
   */
  static validateColumns(columns: Column[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const ids = new Set<string>();

    // Check for empty array
    if (!Array.isArray(columns) || columns.length === 0) {
      errors.push('Columns array is required and must not be empty');
      return { isValid: false, errors };
    }

    // Validate each column and check for duplicate ids
    columns.forEach((column, index) => {
      const validation = ColumnValidation.validateColumn(column);
      if (!validation.isValid) {
        errors.push(`Column ${index}: ${validation.errors.join(', ')}`);
      }

      const id = resolveColumnId(column);
      if (id && ids.has(id)) {
        errors.push(`Duplicate column id found: ${id}`);
      } else if (id) {
        ids.add(id);
      }
    });

    // Check for at least one visible column (priority 1 or 2)
    const hasVisibleColumns = columns.some((col) => !col.priority || col.priority <= 2);
    if (!hasVisibleColumns) {
      errors.push('At least one column should have priority 1 or 2 for mobile visibility');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates column configuration for specific use cases
   */
  static validateForUseCase(
    columns: Column[],
    useCase: 'mobile' | 'desktop' | 'print'
  ): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    switch (useCase) {
      case 'mobile': {
        // The mobile layout stacks each row into a card, so neither column count
        // nor column widths cause horizontal scrolling. What degrades is having
        // no card column (all priority 3 → empty card) or no primary for a title.
        const hasCardColumn = columns.some((col) => !col.priority || col.priority <= 2);
        const hasPrimary = columns.some((col) => !col.priority || col.priority === 1);
        if (!hasCardColumn) {
          warnings.push(
            'Mobile: every column is priority 3 (desktop-only) — the card renders empty'
          );
        } else if (!hasPrimary) {
          warnings.push(
            'Mobile: no priority 1 (or unset) column — a priority 2 column will be used as the card title'
          );
        }
        break;
      }

      case 'desktop': {
        // Check for flex columns without proper balance
        const flexColumns = columns.filter((col) => col.flex === true);
        const fixedColumns = columns.filter((col) => col.width && !col.flex);

        if (flexColumns.length === 0 && fixedColumns.length === columns.length) {
          warnings.push(
            'Desktop: Consider adding at least one flexible column for better space utilization'
          );
        }
        break;
      }

      case 'print': {
        // Check for interactive elements
        const interactiveColumns = columns.filter(
          (col) => resolveColumnId(col) === 'actions' || col.component
        );
        if (interactiveColumns.length > 0) {
          warnings.push('Print: Interactive columns may not display well in print media');
        }
        break;
      }
    }

    return {
      isValid: true,
      warnings
    };
  }
}

/**
 * Helper functions for common validation patterns
 */
export const ValidationHelpers = {
  /**
   * Checks if columns are suitable for mobile display
   */
  isMobileFriendly: (columns: Column[]): boolean => {
    // The card shows priority 1/unset (title + primary) and 2 (detail) columns;
    // priority 3 is desktop-only. "Friendly" = at least one column shows.
    return columns.some((col) => !col.priority || col.priority <= 2);
  },

  /**
   * Gets the columns shown in the mobile card (priority 1/unset + 2; priority 3
   * is desktop-only and omitted).
   */
  getMobileColumns: (columns: Column[]): Column[] => {
    return columns.filter((col) => !col.priority || col.priority <= 2);
  },

  /**
   * Suggests improvements for column configuration
   */
  suggestImprovements: (columns: Column[]): string[] => {
    const suggestions: string[] = [];

    // Check for missing priorities
    const noPriorityCount = columns.filter((col) => !col.priority).length;
    if (noPriorityCount > 0) {
      suggestions.push(
        `Consider adding priority to ${noPriorityCount} columns for better responsive behavior`
      );
    }

    // Check for actions column placement
    const actionsColumn = columns.find((col) => resolveColumnId(col) === 'actions');
    const actionsIndex = actionsColumn ? columns.indexOf(actionsColumn) : -1;
    if (actionsColumn && actionsIndex !== columns.length - 1) {
      suggestions.push('Actions column is typically placed as the last column');
    }

    // Check for sortable/searchable balance. The predicates already exclude
    // synthetic columns, and asking them rather than re-reading the flags is
    // what keeps this advice from contradicting what the table actually offers.
    const sortableCount = columns.filter(isColumnSortable).length;
    const searchableCount = columns.filter(isColumnSearchable).length;

    if (sortableCount === 0) {
      suggestions.push('Consider making at least one column sortable for better UX');
    }

    if (searchableCount === 0) {
      suggestions.push('Consider making at least one column searchable for better UX');
    }

    return suggestions;
  }
};
