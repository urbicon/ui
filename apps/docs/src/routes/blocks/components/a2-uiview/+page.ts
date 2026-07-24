import { redirect } from '@sveltejs/kit';

// Legacy slug — see the sibling `qrcode` route. `A2UIView` slugified to
// `a2-uiview` under the old kebab rule and resolves to `a2-ui-view` now.
export const load = () => {
  redirect(308, '/blocks/components/a2-ui-view');
};
