<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '$lib/route';
  import { Card, Badge, Button, buttonVariants } from '@urbicon-ui/blocks';
  import RecipePreview from './RecipePreview.svelte';

  const recipes = [
    {
      title: 'Login Form',
      description: 'Authentication form with validation, password toggle, and loading states.',
      href: '/recipes/login',
      components: ['Input', 'Button', 'Checkbox', 'Card', 'Alert'],
      category: 'Authentication',
      difficulty: 'Beginner'
    },
    {
      title: 'Passkey Login',
      description:
        'Passwordless and password sign-in in one form, backed by the WebAuthn handlers.',
      href: '/recipes/auth-passkey-login',
      components: ['LoginPage', 'PasskeyManager'],
      category: 'Authentication',
      difficulty: 'Advanced'
    },
    {
      title: 'Invitation-Gated Registration',
      description: 'Admin-minted invitations gate sign-up via RegisterPage and InvitationManager.',
      href: '/recipes/auth-invitation-register',
      components: ['RegisterPage', 'InvitationManager'],
      category: 'Authentication',
      difficulty: 'Intermediate'
    },
    {
      title: 'Password Reset Flow',
      description: 'The two-page forgot/reset flow with timing-safe, enumeration-safe handlers.',
      href: '/recipes/auth-password-reset',
      components: ['ForgotPasswordPage', 'ResetPasswordPage'],
      category: 'Authentication',
      difficulty: 'Intermediate'
    },
    {
      title: 'Dashboard Layout',
      description:
        'App dashboard with collapsible sidebar, stat cards, progress indicators, and activity feed.',
      href: '/recipes/dashboard',
      components: ['Card', 'Badge', 'Avatar', 'Button', 'Progress', 'Tooltip'],
      category: 'Layout',
      difficulty: 'Intermediate'
    },
    {
      title: 'Filter Sidebar',
      description:
        'Filterable results page with a filter panel that is persistent on desktop and a slide-in overlay on mobile — Sidebar mode="responsive" with live client-side filtering.',
      href: '/recipes/filter-sidebar',
      components: ['Sidebar', 'Checkbox', 'RadioGroup', 'Slider', 'Card'],
      category: 'Layout',
      difficulty: 'Intermediate'
    },
    {
      title: 'Settings Page',
      description: 'Tabbed settings page with profile editing, notifications, and security panels.',
      href: '/recipes/settings',
      components: ['Tab', 'Input', 'Textarea', 'Select', 'Toggle', 'Accordion'],
      category: 'Forms',
      difficulty: 'Intermediate'
    },
    {
      title: 'Multi-Step Wizard',
      description: 'Step-by-step form wizard with validation, progress tracking, and review step.',
      href: '/recipes/wizard',
      components: ['Stepper', 'Input', 'Select', 'RadioGroup', 'Progress'],
      category: 'Forms',
      difficulty: 'Advanced'
    },
    {
      title: 'Notification Center',
      description: 'Slide-in notification panel with tabs, filtering, and action buttons.',
      href: '/recipes/notification-center',
      components: ['Drawer', 'Tab', 'Badge', 'Avatar', 'Tooltip'],
      category: 'Layout',
      difficulty: 'Intermediate'
    },
    {
      title: 'Pricing Cards',
      description: 'Three-tier pricing with SegmentGroup billing toggle and feature comparison.',
      href: '/recipes/pricing',
      components: ['Card', 'SegmentGroup', 'Badge', 'Button', 'Tooltip'],
      category: 'Marketing',
      difficulty: 'Beginner'
    },
    {
      title: 'Trace Drawer',
      description:
        'Hierarchical drawer with a calculation breakdown — "How was this value calculated?".',
      href: '/recipes/trace-drawer',
      components: ['Drawer', 'Card', 'Button', 'Badge'],
      category: 'Display',
      difficulty: 'Intermediate'
    },
    {
      title: 'Decision Tree Wizard',
      description:
        'Stepper whose steps and recommendation are derived from the answers given so far.',
      href: '/recipes/decision-tree-wizard',
      components: ['Stepper', 'Card', 'RadioGroup', 'Button', 'Alert'],
      category: 'Forms',
      difficulty: 'Advanced'
    },
    {
      title: 'Range Hint Input',
      description:
        'Input with a contextual plausibility range in the helper text — adaptive success/warning/danger.',
      href: '/recipes/range-hint-input',
      components: ['Input'],
      category: 'Forms',
      difficulty: 'Beginner'
    },
    {
      title: 'Clickable Card',
      description:
        'Card as one fully clickable element — href, onclick, clickable. With an anti-pattern comparison (no nested <a>).',
      href: '/recipes/clickable-card',
      components: ['Card'],
      category: 'Display',
      difficulty: 'Beginner'
    },
    {
      title: 'Stat Tile',
      description:
        'KPI tile for dashboards — label, value, trend, icon tile. Scales from a single tile to a 4-up grid.',
      href: '/recipes/stat-tile',
      components: ['Card', 'Badge'],
      category: 'Display',
      difficulty: 'Beginner'
    },
    {
      title: 'Page Header',
      description:
        'Top-of-page heading with eyebrow, title, subtitle, and actions — four patterns for list, detail, tab, and form pages. Pure Tailwind, no component.',
      href: '/recipes/page-header',
      components: ['Button', 'Badge', 'Breadcrumb', 'Tab'],
      category: 'Layout',
      difficulty: 'Beginner'
    },
    {
      title: 'Help Tooltip',
      description:
        'Glossary trigger for domain terms — info icon next to a label, tooltip with the definition. Pattern for domain apps with specialist vocabulary.',
      href: '/recipes/help-tooltip',
      components: ['Tooltip', 'Button'],
      category: 'Display',
      difficulty: 'Beginner'
    },
    {
      title: 'Onboarding Flow',
      description:
        'First-run onboarding on the Guide system — a beacon-launched spotlight tour, a non-modal help panel, a new-feature hint, and onStep/onComplete/onSkip analytics.',
      href: '/recipes/onboarding-flow',
      components: ['Guide', 'GuideBeacon', 'GuidePanel', 'GuideMention', 'GuideHint'],
      category: 'Display',
      difficulty: 'Advanced'
    },
    {
      title: 'Unsaved Changes Guard',
      description:
        'Guards against data loss when leaving a form with unsaved changes — combines ConfirmDialog, beforeNavigate, and beforeunload.',
      href: '/recipes/unsaved-changes-guard',
      components: ['ConfirmDialog'],
      category: 'Forms',
      difficulty: 'Intermediate'
    },
    {
      title: 'Meal Planner',
      description:
        'Weekly meal plan on the Planner grid — meals bucketed by day, sorted by type, with an "Add" affordance on every day, including empty ones.',
      href: '/recipes/meal-planner',
      components: ['Planner', 'Button', 'Badge'],
      category: 'Display',
      difficulty: 'Intermediate'
    }
  ];

  const categories = ['All', ...new Set(recipes.map((r) => r.category))];
  let activeCategory = $state('All');

  let filtered = $derived(
    activeCategory === 'All' ? recipes : recipes.filter((r) => r.category === activeCategory)
  );

  const totalComponents = $derived(new Set(recipes.flatMap((r) => r.components)).size);
</script>

<SeoMeta
  title="UI Recipes"
  description="Ready-to-use UI recipes built with Urbicon UI components. Copy-paste complete UI blocks for login forms, dashboards, settings pages, and more."
/>

<!-- Color Rooms hero field (default blocks room) — full-width band flush to the
     app sidebar; stats stay on paper below, inner wrapper aligns with the body. -->
<div data-room-hero>
  <div class="mx-auto max-w-6xl px-6">
    <h1 class="text-text-primary text-4xl font-bold">UI Recipes</h1>
    <p class="text-text-secondary mt-3 max-w-2xl text-lg">
      Production-ready UI patterns built with Urbicon UI. Each recipe includes a live preview,
      copyable source code, and links to every component used.
    </p>
  </div>
</div>

<div class="mx-auto max-w-6xl px-6 pb-12 pt-10">
  <!-- Hero stats -->
  <div class="mb-12">
    <!-- Stats Row -->
    <div class="mb-8 flex flex-wrap gap-6">
      <div class="flex items-center gap-2">
        <div class="bg-primary-subtle rounded-modify flex h-8 w-8 items-center justify-center">
          <svg class="text-primary h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            /></svg
          >
        </div>
        <div>
          <div class="text-text-primary text-lg font-bold">{recipes.length}</div>
          <div class="text-text-tertiary text-xs">Recipes</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="bg-success-subtle rounded-modify flex h-8 w-8 items-center justify-center">
          <svg class="text-success h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            /></svg
          >
        </div>
        <div>
          <div class="text-text-primary text-lg font-bold">{totalComponents}</div>
          <div class="text-text-tertiary text-xs">Components</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="bg-warning-subtle rounded-modify flex h-8 w-8 items-center justify-center">
          <svg class="text-warning h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            /></svg
          >
        </div>
        <div>
          <div class="text-text-primary text-lg font-bold">100%</div>
          <div class="text-text-tertiary text-xs">Copy-Paste Ready</div>
        </div>
      </div>
    </div>

    <!-- Category Filter -->
    <div class="flex flex-wrap gap-2">
      {#each categories as category (category)}
        <Button
          size="sm"
          variant={activeCategory === category ? 'filled' : 'ghost'}
          intent={activeCategory === category ? 'primary' : 'neutral'}
          onclick={() => (activeCategory = category)}
        >
          {category}
        </Button>
      {/each}
    </div>
  </div>

  <!-- Recipe Grid -->
  <div class="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
    {#each filtered as recipe (recipe.href)}
      <Card
        href={r(recipe.href)}
        class="group border-border-subtle hover:border-primary h-full overflow-hidden transition-all duration-[var(--blocks-duration-fast)] hover:shadow-[var(--blocks-shadow-lg)]"
      >
        <!-- Mini Preview -->
        <div class="border-border-subtle bg-surface-subtle border-b p-4">
          <RecipePreview href={recipe.href} />
        </div>

        <!-- Card Body -->
        <div class="flex flex-col p-5">
          <!-- Category + difficulty share the meta row. The difficulty badge used to
               float over the preview's top-right corner; now that the preview fills
               its frame edge-to-edge that would cover real content (it sat on the
               dashboard's 4th stat tile), so both live here. -->
          <div class="mb-1 flex items-center gap-2">
            <Badge variant="outlined" intent="neutral" size="sm">{recipe.category}</Badge>
            <Badge
              variant="soft"
              intent={recipe.difficulty === 'Beginner'
                ? 'success'
                : recipe.difficulty === 'Advanced'
                  ? 'danger'
                  : 'warning'}
              size="sm"
            >
              {recipe.difficulty}
            </Badge>
          </div>
          <h3
            class="text-text-primary group-hover:text-primary mb-2 text-lg font-semibold transition-colors"
          >
            {recipe.title}
          </h3>
          <p class="text-text-secondary mb-4 flex-1 text-sm leading-relaxed">
            {recipe.description}
          </p>
          <div class="flex flex-wrap gap-1">
            {#each recipe.components as comp (comp)}
              <Badge variant="outlined" intent="primary" size="sm">{comp}</Badge>
            {/each}
          </div>
        </div>
      </Card>
    {/each}
  </div>

  <!-- Showcase CTA -->
  <div class="border-border-subtle bg-surface-elevated mt-16 rounded-xl border p-8 text-center">
    <h2 class="text-text-primary mb-2 text-xl font-semibold">Want to see everything together?</h2>
    <p class="text-text-secondary mb-6">
      The Showcase page demonstrates 20+ components working together in a realistic application.
    </p>
    <a href={resolve('/showcase')} class={buttonVariants({ intent: 'primary', size: 'lg' }).base()}>
      View Showcase
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 7l5 5-5 5M6 12h12"
        />
      </svg>
    </a>
  </div>
</div>
