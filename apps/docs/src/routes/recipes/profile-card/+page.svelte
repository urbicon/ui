<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { Card, Avatar, Badge, Button, Separator, Tooltip, Progress } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';
  import RecipeFeatures from '../RecipeFeatures.svelte';

  const user = {
    name: 'Sarah Chen',
    role: 'Senior Product Designer',
    location: 'San Francisco, CA',
    bio: 'Designing thoughtful user experiences at the intersection of technology and human behavior. Previously at Figma and Stripe.',
    stats: [
      { label: 'Projects', value: '47' },
      { label: 'Followers', value: '2.3k' },
      { label: 'Following', value: '189' }
    ],
    skills: ['UI Design', 'UX Research', 'Design Systems', 'Prototyping', 'Figma'],
    social: [
      { name: 'Twitter', href: '#' },
      { name: 'LinkedIn', href: '#' },
      { name: 'GitHub', href: '#' }
    ],
    profileCompletion: 72
  };

  let following = $state(false);

  const recipeCode =
    `<script lang="ts">
  import { Card, Avatar, Badge, Button, Separator, Tooltip, Progress } from '@urbicon-ui/blocks';

  const user = {
    name: 'Sarah Chen',
    role: 'Product Designer',
    bio: 'Designing thoughtful user experiences at the intersection of technology and human behavior.',
    stats: [
      { label: 'Projects', value: '47' },
      { label: 'Followers', value: '2.3k' },
      { label: 'Following', value: '189' }
    ],
    skills: ['UI Design', 'UX Research', 'Design Systems', 'Figma'],
    profileCompletion: 72
  };

  let following = $state(false);
</scr` +
    `ipt>

<Card variant="outlined" padding="none" class="overflow-hidden">
  <div class="h-24 bg-gradient-to-r from-primary to-secondary"></div>
  <div class="px-6 pb-6">
    <div class="-mt-10 mb-4">
      <div class="inline-block rounded-full border-4 border-surface-base">
        <Avatar name={user.name} size="2xl" />
      </div>
    </div>
    <div class="mb-4 flex items-start justify-between">
      <div>
        <h4 class="text-lg font-semibold text-text-primary">{user.name}</h4>
        <p class="text-sm text-text-tertiary">{user.role}</p>
      </div>
      <Button size="sm" intent={following ? 'neutral' : 'primary'}
        variant={following ? 'outlined' : 'filled'}
        onclick={() => (following = !following)}>
        {following ? 'Following' : 'Follow'}
      </Button>
    </div>
    <p class="text-sm text-text-secondary mb-4 leading-relaxed">{user.bio}</p>
    <div class="mb-4 flex gap-6">
      {#each user.stats as stat (stat.label)}
        <Tooltip label="View {stat.label.toLowerCase()} details">
          <div class="text-center">
            <div class="text-lg font-bold text-text-primary">{stat.value}</div>
            <div class="text-xs text-text-tertiary">{stat.label}</div>
          </div>
        </Tooltip>
      {/each}
    </div>
    <Separator class="my-4" />
    <div class="flex flex-wrap gap-1.5">
      {#each user.skills as skill (skill)}
        <Badge variant="soft" intent="primary" size="sm">{skill}</Badge>
      {/each}
    </div>
    <div class="mt-4">
      <div class="flex items-center justify-between text-xs text-text-tertiary mb-1">
        <span>Profile completion</span>
        <span class="font-medium text-text-primary">{user.profileCompletion}%</span>
      </div>
      <Tooltip label="Add a profile photo and location to reach 100%">
        <Progress value={user.profileCompletion} size="sm" intent="primary" />
      </Tooltip>
    </div>
  </div>
</Card>`;
</script>

<SeoMeta title="Profile Card Recipe" description={recipeMeta.description} />

<div class="mx-auto max-w-6xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <Section id="preview" title="Live Preview">
    <div class="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
      <!-- Compact Profile Card -->
      <div>
        <h3 class="text-text-tertiary mb-3 text-sm font-medium">Compact</h3>
        <Card variant="outlined">
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <Avatar name={user.name} size="lg" />
              <div class="min-w-0 flex-1">
                <h4 class="text-text-primary truncate font-semibold">{user.name}</h4>
                <p class="text-text-tertiary truncate text-sm">{user.role}</p>
              </div>
            </div>
            <Button
              size="sm"
              class="w-full"
              intent={following ? 'neutral' : 'primary'}
              variant={following ? 'outlined' : 'filled'}
              onclick={() => (following = !following)}
            >
              {following ? 'Following' : 'Follow'}
            </Button>
          </div>
        </Card>
      </div>

      <!-- Full Profile Card -->
      <div>
        <h3 class="text-text-tertiary mb-3 text-sm font-medium">Full</h3>
        <Card variant="outlined" padding="none" class="overflow-hidden">
          <!-- Cover -->
          <div class="from-primary to-secondary h-24 bg-gradient-to-r"></div>

          <div class="px-6 pb-6">
            <!-- Avatar overlapping cover -->
            <div class="-mt-10 mb-4">
              <div class="border-surface-base inline-block rounded-full border-4">
                <Avatar name={user.name} size="2xl" />
              </div>
            </div>

            <div class="mb-4">
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="text-text-primary text-lg font-semibold">{user.name}</h4>
                  <p class="text-text-tertiary text-sm">{user.role}</p>
                </div>
                <Button
                  size="sm"
                  intent={following ? 'neutral' : 'primary'}
                  variant={following ? 'outlined' : 'filled'}
                  onclick={() => (following = !following)}
                >
                  {following ? 'Following' : 'Follow'}
                </Button>
              </div>
            </div>

            <p class="text-text-secondary mb-4 text-sm leading-relaxed">{user.bio}</p>

            <!-- Stats -->
            <div class="mb-4 flex gap-6">
              {#each user.stats as stat (stat.label)}
                <div class="text-center">
                  <div class="text-text-primary text-lg font-bold">{stat.value}</div>
                  <div class="text-text-tertiary text-xs">{stat.label}</div>
                </div>
              {/each}
            </div>

            <Separator class="my-4" />

            <!-- Skills -->
            <div class="flex flex-wrap gap-1.5">
              {#each user.skills as skill (skill)}
                <Badge variant="soft" intent="primary" size="sm">{skill}</Badge>
              {/each}
            </div>

            <!-- Profile Completion -->
            <div class="mt-4">
              <div class="text-text-tertiary mb-1 flex items-center justify-between text-xs">
                <span>Profile completion</span>
                <span class="text-text-primary font-medium">{user.profileCompletion}%</span>
              </div>
              <Tooltip label="Add a profile photo and location to reach 100%">
                <Progress value={user.profileCompletion} size="sm" intent="primary" />
              </Tooltip>
            </div>
          </div>
        </Card>
      </div>

      <!-- Horizontal Profile Card -->
      <div class="lg:col-span-2">
        <h3 class="text-text-tertiary mb-3 text-sm font-medium">Horizontal</h3>
        <Card variant="outlined">
          <div class="flex flex-col items-center gap-6 sm:flex-row">
            <Avatar name={user.name} size="2xl" />

            <div class="flex-1 text-center sm:text-left">
              <h4 class="text-text-primary text-lg font-semibold">{user.name}</h4>
              <p class="text-text-tertiary text-sm">{user.role}</p>
              <p class="text-text-secondary mt-2 text-sm leading-relaxed">{user.bio}</p>
              <div class="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {#each user.skills as skill (skill)}
                  <Badge variant="outlined" intent="neutral" size="sm">{skill}</Badge>
                {/each}
              </div>
            </div>

            <Separator orientation="vertical" class="hidden h-24 sm:block" />

            <div class="flex gap-6 sm:flex-col sm:gap-3">
              {#each user.stats as stat (stat.label)}
                <Tooltip label="View {stat.label.toLowerCase()} details">
                  <div class="text-center">
                    <div class="text-text-primary text-lg font-bold">{stat.value}</div>
                    <div class="text-text-tertiary text-xs">{stat.label}</div>
                  </div>
                </Tooltip>
              {/each}
            </div>
          </div>
        </Card>
      </div>
    </div>
  </Section>

  <!-- Source Code -->
  <Section id="features" title="Key Features" class="mt-12">
    <RecipeFeatures features={recipeMeta.features} />
  </Section>

  <Section id="code" title="Code" class="mt-12">
    <CodeExample title="Profile Card Recipe" code={recipeCode} language="svelte" preview={false} />
  </Section>
</div>
