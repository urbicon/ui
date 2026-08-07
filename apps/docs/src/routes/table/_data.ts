import { type Column, TableColumns } from '@urbicon-ui/table';

export type Employee = {
  id: number;
  name: string;
  role: string;
  department: string;
  email: string;
  status: 'active' | 'on-leave' | 'offboarding';
  salary: number;
  joinedAt: string;
  location: string;
  projects: number;
};

export const employees: Employee[] = [
  {
    id: 1,
    name: 'Emma Wilson',
    role: 'Staff Engineer',
    department: 'Platform',
    email: 'emma@acme.dev',
    status: 'active',
    salary: 142000,
    joinedAt: '2021-03-15',
    location: 'Berlin',
    projects: 12
  },
  {
    id: 2,
    name: 'Liam Chen',
    role: 'Product Designer',
    department: 'Design',
    email: 'liam@acme.dev',
    status: 'active',
    salary: 98000,
    joinedAt: '2022-07-01',
    location: 'Hamburg',
    projects: 8
  },
  {
    id: 3,
    name: 'Sofia Martinez',
    role: 'Engineering Manager',
    department: 'Platform',
    email: 'sofia@acme.dev',
    status: 'active',
    salary: 165000,
    joinedAt: '2020-09-10',
    location: 'Munich',
    projects: 15
  },
  {
    id: 4,
    name: 'James Park',
    role: 'Frontend Developer',
    department: 'Product',
    email: 'james@acme.dev',
    status: 'on-leave',
    salary: 92000,
    joinedAt: '2023-01-20',
    location: 'Remote',
    projects: 6
  },
  {
    id: 5,
    name: 'Aisha Patel',
    role: 'Data Scientist',
    department: 'Data',
    email: 'aisha@acme.dev',
    status: 'active',
    salary: 128000,
    joinedAt: '2021-11-05',
    location: 'Berlin',
    projects: 10
  },
  {
    id: 6,
    name: 'Noah Kim',
    role: 'DevOps Engineer',
    department: 'Platform',
    email: 'noah@acme.dev',
    status: 'active',
    salary: 115000,
    joinedAt: '2022-04-18',
    location: 'Hamburg',
    projects: 9
  },
  {
    id: 7,
    name: 'Olivia Brown',
    role: 'UX Researcher',
    department: 'Design',
    email: 'olivia@acme.dev',
    status: 'offboarding',
    salary: 88000,
    joinedAt: '2022-08-30',
    location: 'Munich',
    projects: 5
  },
  {
    id: 8,
    name: 'Lucas Weber',
    role: 'Backend Developer',
    department: 'Product',
    email: 'lucas@acme.dev',
    status: 'active',
    salary: 105000,
    joinedAt: '2021-06-12',
    location: 'Berlin',
    projects: 11
  },
  {
    id: 9,
    name: 'Mia Zhang',
    role: 'Product Manager',
    department: 'Product',
    email: 'mia@acme.dev',
    status: 'active',
    salary: 135000,
    joinedAt: '2020-05-22',
    location: 'Remote',
    projects: 14
  },
  {
    id: 10,
    name: 'Ethan Müller',
    role: 'QA Engineer',
    department: 'Platform',
    email: 'ethan@acme.dev',
    status: 'on-leave',
    salary: 85000,
    joinedAt: '2023-03-01',
    location: 'Hamburg',
    projects: 4
  },
  {
    id: 11,
    name: 'Isabella Singh',
    role: 'Design Lead',
    department: 'Design',
    email: 'isabella@acme.dev',
    status: 'active',
    salary: 140000,
    joinedAt: '2019-12-01',
    location: 'Berlin',
    projects: 18
  },
  {
    id: 12,
    name: 'Alexander Novak',
    role: 'ML Engineer',
    department: 'Data',
    email: 'alex@acme.dev',
    status: 'active',
    salary: 148000,
    joinedAt: '2021-08-14',
    location: 'Munich',
    projects: 7
  }
];

export const basicColumns: Column<Employee>[] = [
  { accessor: 'name', title: 'Name', sortable: true, searchable: true },
  { accessor: 'role', title: 'Role', sortable: true, searchable: true },
  { accessor: 'department', title: 'Department', sortable: true, groupable: true },
  { accessor: 'location', title: 'Location', sortable: true }
];

export const richColumns: Column<Employee>[] = [
  {
    accessor: 'name',
    title: 'Name',
    sortable: true,
    searchable: true,
    width: '200px',
    minWidth: '120px',
    priority: 1
  },
  { accessor: 'role', title: 'Role', sortable: true, searchable: true, priority: 2 },
  {
    accessor: 'department',
    title: 'Department',
    sortable: true,
    groupable: true,
    dataType: 'text'
  },
  {
    accessor: 'salary',
    title: 'Salary',
    sortable: true,
    summable: true,
    dataType: 'number',
    align: 'right'
  },
  { accessor: 'status', title: 'Status', sortable: true },
  { accessor: 'location', title: 'Location', sortable: true, priority: 3 }
];

/**
 * `StatusBadge` knows eleven statuses (`active`, `pending`, `archived`, …) and
 * labels anything else "Unknown". Two of this fixture's three are its own
 * vocabulary, so without a `statusMap` the flagship example on `/table/table`
 * rendered two grey "Unknown" badges out of six visible rows.
 */
const employeeStatuses = {
  'on-leave': { intent: 'warning' as const, text: 'On leave', icon: true },
  offboarding: { intent: 'neutral' as const, text: 'Offboarding', icon: false }
};

/**
 * Six columns, not seven. The exhibit column on a docs page is 60rem, and a
 * `<CodeExample>` preview keeps 24px of gutter on each side, so a demo table
 * has 912px. With `department` in it this one measured 941 and scrolled
 * sideways at every viewport width — on the section's own landing page.
 * Grouping by department is demonstrated on /table/sorting-grouping, which has
 * fewer columns to carry.
 */
export const factoryColumns = [
  TableColumns.userAvatar<Employee>('name', 'Employee'),
  TableColumns.text<Employee>('role', 'Role'),
  TableColumns.status<Employee>('status', 'Status', { statusMap: employeeStatuses }),
  TableColumns.number<Employee>('salary', 'Salary'),
  TableColumns.date<Employee>('joinedAt', 'Joined'),
  // `showView` defaults to false, so an `onView` handler on its own renders no
  // button — the snippet on /table/table showed two actions and one icon.
  TableColumns.actions<Employee>('Actions', {
    onView: () => {},
    onEdit: () => {},
    showView: true,
    showDelete: false
  })
];

export const scriptOpen = '<' + 'script>';
export const scriptClose = '</' + 'script>';
