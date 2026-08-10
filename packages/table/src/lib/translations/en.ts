export default {
  button: {
    close: 'Close'
  },
  data: {
    empty: 'No data available',
    loading: 'Loading data...',
    refresh: 'Refresh'
  },
  filter: {
    button: {
      add: 'Add filter',
      remove: 'Remove filter',
      clearAll: 'Clear all'
    },
    input: {
      enterValue: 'Enter value...'
    },
    menu: {
      addFilter: 'Add filter'
    },
    operators: {
      after: 'after',
      before: 'before',
      contains: 'contains',
      endsWith: 'ends with',
      equals: 'equals',
      greaterThan: 'greater than',
      lessThan: 'less than',
      onDate: 'on',
      startsWith: 'starts with'
    },
    quickValues: {
      title: 'Quick values'
    },
    // The operator select and value field repeat once per column, so the
    // column name is the only thing that tells two of them apart. Without it
    // every row reads as an unnamed combobox.
    aria: {
      operatorFor: 'Filter operator for {{column}}',
      valueFor: 'Filter value for {{column}}'
    }
  },
  search: {
    placeholder: 'Search...'
  },
  summary: {
    button: {
      title: 'Summary'
    },
    // The store keeps at most one aggregation per column, so turning one off is
    // a choice among the types rather than a separate gesture.
    none: 'None',
    empty: 'No column can be summarised',
    types: {
      average: 'Average',
      count: 'Count',
      maximum: 'Maximum',
      minimum: 'Minimum',
      sum: 'Sum'
    }
  },
  actions: {
    delete: 'Delete',
    edit: 'Edit',
    showDetails: 'Show details',
    hideDetails: 'Hide details'
  },
  aria: {
    tableData: 'Table data',
    filterBar: 'Filter bar',
    searchData: 'Search data',
    removeItem: 'Remove {{content}}',
    scrollLeft: 'Scroll left',
    scrollRight: 'Scroll right',
    interactiveCell: 'Interactive cell',
    // The narrow bar's single tool button. Carries the count of what is
    // currently acting on the grid, because the lit triggers that would
    // otherwise say it are behind a closed panel.
    tools: 'Table tools',
    toolsActive: 'Table tools, {{count}} active'
  },
  copy: {
    button: 'Copy',
    copied: 'Copied',
    failed: 'Failed'
  },
  error: {
    loadingError: 'Loading error',
    genericMessage: 'An error occurred. Please try again.',
    retry: 'Retry',
    fetchFailed: 'Failed to load data'
  },
  columns: {
    visibility: 'Column visibility',
    empty: 'Every column is pinned'
  },
  grouping: {
    button: 'Grouping',
    none: 'No grouping'
  },
  sort: {
    button: 'Sort',
    none: 'No sorting',
    ascending: 'Ascending',
    descending: 'Descending',
    // The sheet splits column and direction into two controls; the direction
    // one needs a name of its own.
    direction: 'Sort direction'
  },
  // The narrow bar's tools sheet.
  tools: {
    title: 'Table tools',
    done: 'Done',
    // Names the column list inside the sort/grouping sections. The section
    // heading already says which tool it is, so the list says what it picks.
    column: 'Column'
  },
  header: {
    activeFilter: 'Active filter',
    activeIndicator: '{{type}} active for this column',
    collapseAllGroups: 'Collapse all groups',
    expandAllGroups: 'Expand all groups',
    groupedColumn: 'Grouped column',
    summarizedColumn: 'Summarized column'
  },
  headerMenu: {
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    removeFilter: 'Remove filter',
    groupByColumn: 'Group by column',
    removeGrouping: 'Remove grouping',
    addSummary: 'Add summary',
    removeSummary: 'Remove summary',
    hideColumn: 'Hide column',
    showColumn: 'Show',
    columnOptions: 'Column options for'
  },
  pagination: {
    previous: 'Previous',
    next: 'Next',
    first: 'First',
    last: 'Last',
    page: 'Page'
  },
  group: {
    noGroup: '(No group)',
    item: 'item',
    items: 'items',
    // Server mode: the group holds only what this page fetched, so the count
    // must not read as the group's size (#159).
    itemOnPage: 'item on this page',
    itemsOnPage: 'items on this page',
    summaryFor: 'Summary for'
  },
  number: {
    valueLabel: 'Value: {{value}}'
  },
  status: {
    tooltip: 'Status: {{text}}',
    clickToChange: '(click to change)',
    unknown: 'Unknown',
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    online: 'Online',
    offline: 'Offline',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived'
  },
  liveUpdates: {
    newItems: 'new',
    updatedItems: 'updated',
    deletedItems: 'removed',
    apply: 'Apply changes',
    dismiss: 'Dismiss'
  },
  selection: {
    selectRow: 'Select row',
    deselectRow: 'Deselect row',
    selectAllRows: 'Select all rows',
    deselectAllRows: 'Deselect all rows'
  },
  table: {
    link: {
      invalid: 'Invalid link'
    },
    summary: {
      totalSummary: 'Total summary'
    }
  }
} as const;
