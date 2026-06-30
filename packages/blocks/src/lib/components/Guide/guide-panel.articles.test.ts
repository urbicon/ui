import { describe, expect, it } from 'vitest';
import {
  filterArticles,
  groupArticles,
  hasNamedGroups,
  type IndexArticle
} from './guide-panel.articles';

const a = (id: string, group?: string): IndexArticle => ({ id, title: id.toUpperCase(), group });

describe('groupArticles', () => {
  it('returns a single ungrouped section when no article sets a group (flat list)', () => {
    const sections = groupArticles([a('one'), a('two'), a('three')]);
    expect(sections).toHaveLength(1);
    expect(sections[0].group).toBeUndefined();
    expect(sections[0].articles.map((x) => x.id)).toEqual(['one', 'two', 'three']);
    expect(hasNamedGroups(sections)).toBe(false);
  });

  it('groups articles under their group, in first-occurrence order', () => {
    const sections = groupArticles([
      a('concept-1', 'Concepts'),
      a('term-1', 'Glossary'),
      a('concept-2', 'Concepts'),
      a('term-2', 'Glossary')
    ]);
    expect(sections.map((s) => s.group)).toEqual(['Concepts', 'Glossary']);
    expect(sections[0].articles.map((x) => x.id)).toEqual(['concept-1', 'concept-2']);
    expect(sections[1].articles.map((x) => x.id)).toEqual(['term-1', 'term-2']);
    expect(hasNamedGroups(sections)).toBe(true);
  });

  it('keeps ungrouped articles in one block, positioned by definition order', () => {
    // grouped, ungrouped, grouped(same), ungrouped → sections: A, ungrouped, in
    // first-occurrence order; the ungrouped block is a single section.
    const sections = groupArticles([a('g1', 'A'), a('u1'), a('g2', 'A'), a('u2')]);
    expect(sections.map((s) => s.group)).toEqual(['A', undefined]);
    expect(sections[0].articles.map((x) => x.id)).toEqual(['g1', 'g2']);
    expect(sections[1].articles.map((x) => x.id)).toEqual(['u1', 'u2']);
  });

  it('positions the ungrouped block first when ungrouped articles come first', () => {
    const sections = groupArticles([a('u1'), a('g1', 'A'), a('u2')]);
    expect(sections.map((s) => s.group)).toEqual([undefined, 'A']);
    expect(sections[0].articles.map((x) => x.id)).toEqual(['u1', 'u2']);
  });

  it('handles an empty article list', () => {
    expect(groupArticles([])).toEqual([]);
    expect(hasNamedGroups([])).toBe(false);
  });
});

describe('filterArticles', () => {
  const articles = [a('saving'), a('seats'), a('billing')];

  it('returns the input unchanged for a blank query', () => {
    expect(filterArticles(articles, '')).toBe(articles);
    expect(filterArticles(articles, '   ')).toBe(articles);
  });

  it('matches titles case-insensitively as a substring', () => {
    // titles are the uppercased id: SAVING / SEATS / BILLING
    expect(filterArticles(articles, 'sea').map((x) => x.id)).toEqual(['seats']);
    expect(filterArticles(articles, 'ING').map((x) => x.id)).toEqual(['saving', 'billing']);
  });

  it('trims whitespace around the query', () => {
    expect(filterArticles(articles, '  billing  ').map((x) => x.id)).toEqual(['billing']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterArticles(articles, 'zzz')).toEqual([]);
  });
});
