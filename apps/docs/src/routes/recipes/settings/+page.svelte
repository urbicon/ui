<script lang="ts">
  import {
    Accordion,
    AccordionItem,
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    Input,
    Select,
    Separator,
    Tab,
    TabItem,
    TabPanel,
    Textarea,
    Toggle
  } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

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

  // Cancel restores the same literals the fields start from. A dead Cancel
  // button would promise an exit it cannot take.
  function handleCancel() {
    fullName = 'Jonas Weber';
    email = 'jonas@example.com';
    bio = 'Software developer passionate about design systems.';
    timezone = 'europe-berlin';
    language = 'en';
    emailNotifications = true;
    pushNotifications = false;
    marketingEmails = false;
    twoFactorAuth = true;
    sessionTimeout = true;
    apiAccess = false;
  }

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
    // Stand-in for a save call — the page state above is the payload.
    saved = true;
    setTimeout(() => (saved = false), 3000);
  }

  const recipeCode = `<\script lang="ts">
  import {
    Accordion,
    AccordionItem,
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    Input,
    Select,
    Separator,
    Tab,
    TabItem,
    TabPanel,
    Textarea,
    Toggle
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

  // Cancel restores the same literals the fields start from. A dead Cancel
  // button would promise an exit it cannot take.
  function handleCancel() {
    fullName = 'Jonas Weber';
    email = 'jonas@example.com';
    bio = 'Software developer passionate about design systems.';
    timezone = 'europe-berlin';
    language = 'en';
    emailNotifications = true;
    pushNotifications = false;
    marketingEmails = false;
    twoFactorAuth = true;
    sessionTimeout = true;
    apiAccess = false;
  }

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
    // Stand-in for your save call — the page state above is the payload.
    saved = true;
    setTimeout(() => (saved = false), 3000);
  }
<\/script>

<!-- Centre it in your page's own layout; the column caps its own width. -->
<div class="w-full max-w-2xl">
  {#if saved}
    <div class="mb-6">
      <Alert intent="success" variant="soft" dismissible onDismiss={() => (saved = false)}>
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
              <p class="text-text-tertiary mt-1 text-xs">JPG, PNG or GIF. Max 2MB.</p>
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
          <Card variant="elevated" padding="none">
            <div class="divide-border-hairline divide-y">
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
          <!-- Same lifted surface as the notifications list: fold rows on one
               elevated card, full-bleed hairline dividers between them. -->
          <Card variant="elevated" padding="none">
            <Accordion slotClasses={{ trigger: 'px-4', contentInner: 'px-4' }}>
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
          </Card>
        </div>
      </TabPanel>
    {/snippet}
  </Tab>

  <div class="flex items-center justify-end gap-3 pt-6">
    <Button variant="outlined" intent="neutral" onclick={handleCancel}>Cancel</Button>
    <Button intent="primary" onclick={handleSave}>Save Changes</Button>
  </div>
</div>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="SettingsPage.svelte"
      description="Walk the three tabs, flip a toggle or two, then save: the confirmation hides itself after three seconds."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="w-full max-w-2xl">
        {#if saved}
          <div class="mb-6">
            <Alert intent="success" variant="soft" dismissible onDismiss={() => (saved = false)}>
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
                    <p class="text-text-tertiary mt-1 text-xs">JPG, PNG or GIF. Max 2MB.</p>
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
                <Card variant="elevated" padding="none">
                  <div class="divide-border-hairline divide-y">
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
                <!-- Same lifted surface as the notifications list: the fold rows sit
               on an elevated card with full-bleed hairline dividers, instead
               of quiet washes that barely part from the stage tint. -->
                <Card variant="elevated" padding="none">
                  <Accordion slotClasses={{ trigger: 'px-4', contentInner: 'px-4' }}>
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
                </Card>
              </div>
            </TabPanel>
          {/snippet}
        </Tab>

        <div class="flex items-center justify-end gap-3 pt-6">
          <Button variant="outlined" intent="neutral" onclick={handleCancel}>Cancel</Button>
          <Button intent="primary" onclick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Three decisions">
    <NoteList>
      <Note title="Tabs, because the groups are flat">
        <p>
          Profile, Notifications and Security are peers: none nests further, none owns its own save.
          One <code class="text-text-primary">Tab</code> in its
          <code class="text-text-primary">line</code> variant holds them in a single column. Reach
          for a
          <a class="text-primary hover:underline" href={resolve('/blocks/primitives/sidebar')}
            >Sidebar</a
          >
          the moment a group commits on its own, nests, or the list keeps growing: a tab strip shows no
          hierarchy and stops scaling at about five entries.
        </p>
      </Note>
      <Note title="One save, below the tabs">
        <p>
          The Cancel/Save footer sits after the <code class="text-text-primary">Tab</code>, not
          inside a panel, so it stays on screen whichever tab is open. Every control binds to
          page-level state, so switching tabs edits one form rather than three, and
          <code class="text-text-primary">handleSave</code> commits the whole page at once. Its body is
          the seam: swap the fake for your save call.
        </p>
      </Note>
      <Note title="A flat list for notifications, a fold for security">
        <p>
          The three notification switches are low-stakes and read as a set, so they share one
          always-open card. Each security item asks for a pause instead: the fold puts its
          explanation between you and the toggle, and gives API access room to reveal its key.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
