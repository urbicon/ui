import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getRecipeDir } from '../utils/paths.js';
import { getRecipeById, loadRecipes } from './recipe-loader.js';

const recipesAvailable = existsSync(getRecipeDir());

describe.skipIf(!recipesAvailable)('recipe-loader pattern annotations', () => {
  it('parses the Layer-4 pattern reference from meta.ts', async () => {
    const dashboard = await getRecipeById('dashboard');
    expect(dashboard?.pattern).toBe('dashboard');

    const login = await getRecipeById('login');
    expect(login?.pattern).toBe('form-page');

    const onboarding = await getRecipeById('onboarding-flow');
    expect(onboarding?.pattern).toBe('onboarding-guide');
  });

  it('leaves pattern undefined for recipes without one', async () => {
    const profile = await getRecipeById('profile-card');
    // profile-card is a component-level snippet, not a page archetype → no pattern
    expect(profile?.pattern).toBeUndefined();
  });

  it('loads the meal-planner recipe with its planning-board pattern + Planner code', async () => {
    const mealPlanner = await getRecipeById('meal-planner');
    expect(mealPlanner?.title).toBe('Meal Planner');
    expect(mealPlanner?.pattern).toBe('planning-board');
    expect(mealPlanner?.components).toContain('Planner');
    expect(mealPlanner?.code).toContain('<Planner');
  });

  it('every annotated pattern names an existing pattern file', async () => {
    const recipes = await loadRecipes();
    const known = new Set([
      'dashboard',
      'form-page',
      'settings-page',
      'tab-navigation',
      'onboarding-guide',
      'planning-board'
    ]);
    for (const r of recipes) {
      if (r.pattern)
        expect(known, `recipe "${r.id}" → unknown pattern "${r.pattern}"`).toContain(r.pattern);
    }
  });
});
