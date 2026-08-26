/**
 * `drizzle-orm` as far as the docs' adapter example uses it. The repo does not
 * depend on drizzle, so the example resolves this declaration instead — the
 * operators are structural (the `db` in the example is `any` anyway); what the
 * check exercises is the adapter's contract against `@urbicon-ui/auth/server`.
 */
declare module 'drizzle-orm' {
  export interface SQL {
    readonly __brand: 'drizzle-sql';
  }
  export function eq(column: unknown, value: unknown): SQL;
  export function ne(column: unknown, value: unknown): SQL;
  export function gt(column: unknown, value: unknown): SQL;
  export function lt(column: unknown, value: unknown): SQL;
  export function lte(column: unknown, value: unknown): SQL;
  export function isNull(column: unknown): SQL;
  export function and(...conditions: (SQL | undefined)[]): SQL;
  export function or(...conditions: (SQL | undefined)[]): SQL;
  export function desc(column: unknown): SQL;
  export function sql(strings: TemplateStringsArray, ...values: unknown[]): SQL;
}
