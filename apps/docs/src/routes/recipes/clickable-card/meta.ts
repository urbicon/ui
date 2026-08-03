import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Display',
  difficulty: 'Beginner',
  title: 'Clickable Card',
  description:
    'Card as one fully clickable element — dashboard tile, list card, navigation tile. Card automatically renders as <a> or <button> depending on the prop; nested <a><Card></Card></a> is unnecessary (and usually wrong).',
  components: ['Card'],
  features: [
    'href automatically sets the rendered element to <a> with correct tab order',
    'onclick sets it to <button type="button"> for actions without navigation',
    'Hover/focus styles kick in automatically once href/onclick/clickable is set — no "decorative hover" mode on passive elements',
    'mint="translate" or mint="glow" for a gentle micro-interaction',
    'Anti-pattern comparison: why <a><Card></Card></a> is the worse solution'
  ]
};
