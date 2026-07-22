<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '$lib/route';
  import {
    Tab,
    TabItem,
    TabPanel,
    Input,
    Textarea,
    Select,
    Toggle,
    Accordion,
    AccordionItem,
    Card,
    Button,
    Avatar,
    Alert,
    Separator,
    Badge
  } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { componentLinks } from '$lib/component-links';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  let activeTab = $state('profile');
  let fullName = $state('Jonas Weber');
  let email = $state('jonas@example.com');
  let bio = $state('Software developer passionate about design systems.');
  let timezone = $state('europe-berlin');
  let language = $state('en');
  let emailNotifications = $state(true);
  let pushNotifications = $state(false);
  let marketingEmails = $state(false);
  let twoFactorAuth = $state(true);
  let sessionTimeout = $state(true);
  let apiAccess = $state(false);
  let saved = $state(false);

  const timezones = [
    { label: 'UTC', value: 'utc' },
    { label: 'Europe/Berlin (CET)', value: 'europe-berlin' },
    { label: 'America/New York (EST)', value: 'america-new-york' },
    { label: 'America/Los Angeles (PST)', value: 'america-los-angeles' },
    { label: 'Asia/Tokyo (JST)', value: 'asia-tokyo' }
  ];

  const languages = [
    { label: 'English', value: 'en' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Français', value: 'fr' },
    { label: 'Español', value: 'es' }
  ];

  function handleSave() {
    saved = true;
    setTimeout(() => (saved = false), 3000);
  }

  const recipeCode =
    `<script lang="ts">
  import {
    Tab, TabItem, TabPanel, Input, Textarea, Select,
    Toggle, Accordion, AccordionItem, Card, Button,
    Avatar, Alert, Separator, Badge
  } from '@urbicon-ui/blocks';

  let activeTab = $state('profile');
  let fullName = $state('Jonas Weber');
  let email = $state('jonas@example.com');
  let bio = $state('Software developer passionate about design systems.');
  let timezone = $state('europe-berlin');
  let language = $state('en');
  let emailNotifications = $state(true);
  let pushNotifications = $state(false);
  let marketingEmails = $state(false);
  let twoFactorAuth = $state(true);
  let sessionTimeout = $state(true);
  let apiAccess = $state(false);
  let saved = $state(false);

  const timezones = [
    { label: 'UTC', value: 'utc' },
    { label: 'Europe/Berlin (CET)', value: 'europe-berlin' },
    { label: 'America/New York (EST)', value: 'america-new-york' },
    { label: 'America/Los Angeles (PST)', value: 'america-los-angeles' },
    { label: 'Asia/Tokyo (JST)', value: 'asia-tokyo' }
  ];

  const languages = [
    { label: 'English', value: 'en' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Français', value: 'fr' },
    { label: 'Español', value: 'es' }
  ];

  function handleSave() {
    saved = true;
    setTimeout(() => (saved = false), 3000);
  }
</scr` +
    `ipt>

<div class="mx-auto max-w-2xl p-8">
  {#if saved}
    <Alert intent="success" variant="soft" dismissible onDismiss={() => (saved = false)}>
      Settings saved successfully.
    </Alert>
  {/if}

  <Tab bind:value={activeTab} variant="line">
    {#snippet tabs()}
      <TabItem value="profile">Profile</TabItem>
      <TabItem value="notifications">Notifications</TabItem>
      <TabItem value="security">Security</TabItem>
    {/snippet}

    {#snippet panels()}
      <TabPanel value="profile">
        <div class="space-y-6 pt-6">
          <div class="flex items-center gap-4">
            <Avatar name={fullName} size="xl" />
            <div>
              <Button size="sm" variant="outlined" intent="neutral">Change Photo</Button>
              <p class="mt-1 text-xs text-text-quaternary">JPG, PNG or GIF. Max 2MB.</p>
            </div>
          </div>

          <Separator />

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full Name" bind:value={fullName} />
            <Input label="Email" type="email" bind:value={email} />
          </div>

          <Textarea
            label="Bio"
            bind:value={bio}
            autoResize
            showCounter
            maxlength={280}
            helper="Brief description for your profile"
          />

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Timezone" options={timezones} bind:value={timezone} />
            <Select label="Language" options={languages} bind:value={language} />
          </div>
        </div>
      </TabPanel>

      <TabPanel value="notifications">
        <div class="pt-6">
          <Card class="border-border-subtle">
            <div class="divide-y divide-border-subtle">
              <div class="flex items-center justify-between p-4">
                <div>
                  <p class="text-sm font-medium text-text-primary">Email Notifications</p>
                  <p class="text-xs text-text-tertiary">Receive updates about your account via email.</p>
                </div>
                <Toggle checked={emailNotifications}
                  onCheckedChange={(v: boolean) => (emailNotifications = v)} />
              </div>
              <div class="flex items-center justify-between p-4">
                <div>
                  <p class="text-sm font-medium text-text-primary">Push Notifications</p>
                  <p class="text-xs text-text-tertiary">Receive push notifications on your devices.</p>
                </div>
                <Toggle checked={pushNotifications}
                  onCheckedChange={(v: boolean) => (pushNotifications = v)} />
              </div>
              <div class="flex items-center justify-between p-4">
                <div>
                  <p class="text-sm font-medium text-text-primary">Marketing Emails</p>
                  <p class="text-xs text-text-tertiary">Receive emails about new features and offers.</p>
                </div>
                <Toggle checked={marketingEmails}
                  onCheckedChange={(v: boolean) => (marketingEmails = v)} />
              </div>
            </div>
          </Card>
        </div>
      </TabPanel>

      <TabPanel value="security">
        <div class="pt-6">
          <Accordion variant="card">
            <AccordionItem value="2fa" title="Two-Factor Authentication">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-text-secondary">
                    Add an extra layer of security to your account.
                  </p>
                  <Badge variant="soft" intent={twoFactorAuth ? 'success' : 'warning'}
                    size="sm" class="mt-2">
                    {twoFactorAuth ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <Toggle checked={twoFactorAuth}
                  onCheckedChange={(v: boolean) => (twoFactorAuth = v)} />
              </div>
            </AccordionItem>
            <AccordionItem value="sessions" title="Session Management">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-text-secondary">
                    Automatically log out after 30 minutes of inactivity.
                  </p>
                </div>
                <Toggle checked={sessionTimeout}
                  onCheckedChange={(v: boolean) => (sessionTimeout = v)} />
              </div>
            </AccordionItem>
            <AccordionItem value="api" title="API Access">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-text-secondary">
                    Enable API access for third-party integrations.
                  </p>
                </div>
                <Toggle checked={apiAccess}
                  onCheckedChange={(v: boolean) => (apiAccess = v)} />
              </div>
            </AccordionItem>
          </Accordion>
        </div>
      </TabPanel>
    {/snippet}
  </Tab>

  <div class="flex items-center justify-end gap-3 pt-6">
    <Button variant="ghost" intent="neutral">Cancel</Button>
    <Button intent="primary" onclick={handleSave}>Save Changes</Button>
  </div>
</div>`;
</script>

<SeoMeta title="Settings Page Recipe" />

<div class="mx-auto max-w-6xl px-6 py-12">
  <!-- Header -->
  <div class="mb-10">
    <a
      href={resolve('/recipes')}
      class="text-text-tertiary hover:text-primary mb-4 inline-flex items-center gap-1 text-sm transition-colors"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        /></svg
      >
      Back to Recipes
    </a>
    <h1 class="text-text-primary mb-2 text-3xl font-bold">Settings Page</h1>
    <p class="text-text-secondary mb-4 text-lg">
      Tabbed settings page with profile editing, notifications, and security panels.
    </p>
    <div class="flex flex-wrap gap-1.5">
      {#each usedComponents as comp (comp)}
        <a href={r(componentLinks[comp] ?? '#')}>
          <Badge
            variant="outlined"
            intent="primary"
            size="sm"
            class="hover:bg-primary-subtle transition-colors">{comp}</Badge
          >
        </a>
      {/each}
    </div>
  </div>

  <div class="grid grid-cols-1 gap-10 xl:grid-cols-3">
    <!-- Live Preview (2 cols) -->
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <div
          class="border-border-subtle bg-surface-base mt-4 overflow-hidden rounded-xl border shadow-[var(--blocks-shadow-md)]"
        >
          <div class="mx-auto max-w-2xl p-8">
            {#if saved}
              <div class="mb-6">
                <Alert
                  intent="success"
                  variant="soft"
                  dismissible
                  onDismiss={() => (saved = false)}
                >
                  Settings saved successfully.
                </Alert>
              </div>
            {/if}

            <Tab bind:value={activeTab} variant="line">
              {#snippet tabs()}
                <TabItem value="profile">Profile</TabItem>
                <TabItem value="notifications">Notifications</TabItem>
                <TabItem value="security">Security</TabItem>
              {/snippet}

              {#snippet panels()}
                <TabPanel value="profile">
                  <div class="space-y-6 pt-6">
                    <div class="flex items-center gap-4">
                      <Avatar name={fullName} size="xl" />
                      <div>
                        <Button size="sm" variant="outlined" intent="neutral">Change Photo</Button>
                        <p class="text-text-quaternary mt-1 text-xs">JPG, PNG or GIF. Max 2MB.</p>
                      </div>
                    </div>

                    <Separator />

                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input label="Full Name" bind:value={fullName} />
                      <Input label="Email" type="email" bind:value={email} />
                    </div>

                    <Textarea
                      label="Bio"
                      bind:value={bio}
                      autoResize
                      showCounter
                      maxlength={280}
                      helper="Brief description for your profile"
                    />

                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Select label="Timezone" options={timezones} bind:value={timezone} />
                      <Select label="Language" options={languages} bind:value={language} />
                    </div>
                  </div>
                </TabPanel>

                <TabPanel value="notifications">
                  <div class="pt-6">
                    <Card class="border-border-subtle">
                      <div class="divide-border-subtle divide-y">
                        <div class="flex items-center justify-between p-4">
                          <div>
                            <p class="text-text-primary text-sm font-medium">Email Notifications</p>
                            <p class="text-text-tertiary text-xs">
                              Receive updates about your account via email.
                            </p>
                          </div>
                          <Toggle
                            checked={emailNotifications}
                            onCheckedChange={(v: boolean) => (emailNotifications = v)}
                          />
                        </div>
                        <div class="flex items-center justify-between p-4">
                          <div>
                            <p class="text-text-primary text-sm font-medium">Push Notifications</p>
                            <p class="text-text-tertiary text-xs">
                              Receive push notifications on your devices.
                            </p>
                          </div>
                          <Toggle
                            checked={pushNotifications}
                            onCheckedChange={(v: boolean) => (pushNotifications = v)}
                          />
                        </div>
                        <div class="flex items-center justify-between p-4">
                          <div>
                            <p class="text-text-primary text-sm font-medium">Marketing Emails</p>
                            <p class="text-text-tertiary text-xs">
                              Receive emails about new features and offers.
                            </p>
                          </div>
                          <Toggle
                            checked={marketingEmails}
                            onCheckedChange={(v: boolean) => (marketingEmails = v)}
                          />
                        </div>
                      </div>
                    </Card>
                  </div>
                </TabPanel>

                <TabPanel value="security">
                  <div class="pt-6">
                    <Accordion variant="card">
                      <AccordionItem value="2fa" title="Two-Factor Authentication">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-text-secondary text-sm">
                              Add an extra layer of security to your account.
                            </p>
                            <Badge
                              variant="soft"
                              intent={twoFactorAuth ? 'success' : 'warning'}
                              size="sm"
                              class="mt-2"
                            >
                              {twoFactorAuth ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                          <Toggle
                            checked={twoFactorAuth}
                            onCheckedChange={(v: boolean) => (twoFactorAuth = v)}
                          />
                        </div>
                      </AccordionItem>
                      <AccordionItem value="sessions" title="Session Management">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-text-secondary text-sm">
                              Automatically log out after 30 minutes of inactivity.
                            </p>
                          </div>
                          <Toggle
                            checked={sessionTimeout}
                            onCheckedChange={(v: boolean) => (sessionTimeout = v)}
                          />
                        </div>
                      </AccordionItem>
                      <AccordionItem value="api" title="API Access">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-text-secondary text-sm">
                              Enable API access for third-party integrations.
                            </p>
                            {#if apiAccess}
                              <code
                                class="bg-surface-subtle text-text-secondary mt-2 block rounded px-2 py-1 text-xs"
                              >
                                sk-live-xxxx-xxxx-xxxx-xxxx
                              </code>
                            {/if}
                          </div>
                          <Toggle
                            checked={apiAccess}
                            onCheckedChange={(v: boolean) => (apiAccess = v)}
                          />
                        </div>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </TabPanel>
              {/snippet}
            </Tab>

            <!-- Save Button -->
            <div class="flex items-center justify-end gap-3 pt-6">
              <Button variant="ghost" intent="neutral">Cancel</Button>
              <Button intent="primary" onclick={handleSave}>Save Changes</Button>
            </div>
          </div>
        </div>
      </Section>
    </div>

    <!-- Sidebar -->
    <div class="space-y-8">
      <Section id="features" title="Key Features" headingLevel={3}>
        <ul class="space-y-2">
          {#each features as feature (feature)}
            <li class="text-text-secondary flex items-start gap-2 text-sm">
              <svg
                class="text-success mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                /></svg
              >
              {feature}
            </li>
          {/each}
        </ul>
      </Section>

      <Section id="components" title="Components Used" headingLevel={3}>
        <div class="space-y-2">
          {#each usedComponents as comp (comp)}
            <a
              href={r(componentLinks[comp] ?? '#')}
              class="text-text-secondary hover:bg-surface-hover hover:text-primary flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <svg
                class="text-primary h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 7l5 5-5 5M6 12h12"
                /></svg
              >
              {comp}
            </a>
          {/each}
        </div>
      </Section>
    </div>
  </div>

  <!-- Source Code -->
  <div class="mt-12">
    <CodeExample title="Settings Page Recipe" code={recipeCode} language="svelte" preview={false} />
  </div>
</div>
