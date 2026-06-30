/**
 * Pure transforms for the `GuidePanel` article index — grouping (#25) and
 * filtering (#26). Kept framework-free so the index logic is unit-testable
 * without rendering the panel (mirrors `pagination.engine` / `planner.bucket`).
 */

/** A registered article as surfaced to the panel index. */
export interface IndexArticle {
  id: string;
  title: string;
  /** Optional section label; `undefined` means the ungrouped block. */
  group?: string;
}

/** One section of the grouped index. */
export interface ArticleSection {
  /** The section's group label, or `undefined` for the headerless ungrouped block. */
  group: string | undefined;
  articles: IndexArticle[];
}

/**
 * Group articles into sections keyed by `group`, in first-occurrence order over
 * the (insertion-ordered) input. Articles without a `group` collect into one
 * headerless section, positioned where its first ungrouped article appears.
 * When no article sets a `group`, the result is a single ungrouped section —
 * i.e. a flat list.
 */
export function groupArticles(articles: IndexArticle[]): ArticleSection[] {
  const byGroup = new Map<string, ArticleSection>();
  for (const article of articles) {
    const key = article.group ?? '';
    let section = byGroup.get(key);
    if (!section) {
      section = { group: article.group, articles: [] };
      byGroup.set(key, section);
    }
    section.articles.push(article);
  }
  return [...byGroup.values()];
}

/** Whether any section carries a real group label (drives grouped vs. flat rendering). */
export function hasNamedGroups(sections: ArticleSection[]): boolean {
  return sections.some((s) => s.group !== undefined);
}

/**
 * Filter articles by a case-insensitive substring match on the title. A blank
 * query returns the input unchanged. Whitespace around the query is ignored.
 */
export function filterArticles(articles: IndexArticle[], query: string): IndexArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return articles;
  return articles.filter((a) => a.title.toLowerCase().includes(q));
}
