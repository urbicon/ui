<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    Accordion,
    AccordionItem,
    Alert,
    ArrowRightIcon,
    ArrowUpRightIcon,
    Avatar,
    Badge,
    Breadcrumb,
    Button,
    ButtonGroup,
    Card,
    Checkbox,
    Combobox,
    Input,
    Menu,
    Pagination,
    Separator,
    Skeleton,
    Spinner,
    Tab,
    TabItem,
    TabPanel,
    Toggle,
    Toolbar
  } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  const shared =
    'bento-card group relative isolate rounded-2xl p-5 border ' +
    'transition-[transform,box-shadow,border-color] ' +
    'duration-[var(--blocks-duration-normal,200ms)] ease-[var(--blocks-ease-confident,ease)] ' +
    'hover:-translate-y-0.5';

  const std = `${shared} bg-surface-elevated border-border-subtle hover:border-border-default hover:shadow-(--blocks-shadow-md)`;
  const stdLg = `${std} row-span-2 sm:col-span-2`;
  const stdWd = `${std} sm:col-span-2`;

  const linkStd =
    'absolute inset-0 z-[1] rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary';

  const inner = 'relative z-[2] flex h-full flex-col pointer-events-none';
  const demo = 'flex flex-1 items-center justify-center';

  // Clears the entrance animation once it finishes so each card keeps its
  // final resting state. (The cursor-spotlight tracking was removed — C.3.)
  function bento(node: HTMLElement) {
    node.addEventListener(
      'animationend',
      () => {
        node.style.animation = 'none';
        node.style.opacity = '1';
      },
      { once: true }
    );
  }
</script>

<SeoMeta
  title="Blocks"
  description="23 Svelte 5 + Tailwind 4 primitives. Interactive, accessible, token-driven."
/>

<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
  <div class="mb-14">
    <p class="meta-marker">Primitives — Svelte 5 · Tailwind 4 · zero deps</p>
    <div class="mt-4 flex items-center gap-3">
      <h1 class="text-text-primary text-4xl font-bold tracking-tight sm:text-5xl">
        Blocks<span class="pipe" aria-hidden="true">|</span>
      </h1>
      <span class="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold">
        23
      </span>
    </div>
    <p class="text-text-secondary mt-4 max-w-xl text-base sm:text-lg">
      Zero-dependency primitives built with Svelte&nbsp;5 runes and Tailwind&nbsp;4 tokens. Fully
      accessible, AI-native, endlessly customizable.
    </p>
  </div>

  {#snippet arrowStd()}
    <ArrowUpRightIcon
      class="text-text-quaternary h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
    />
  {/snippet}

  {#snippet heading(name: string)}
    <div class="mb-3 flex items-center justify-between">
      <span
        class="text-text-tertiary group-hover:text-text-secondary text-[11px] font-semibold tracking-widest uppercase transition-colors duration-200"
        >{name}</span
      >
      {@render arrowStd()}
    </div>
  {/snippet}

  <!-- ─── Bento Grid ─────────────────────────────────────────── -->
  <div
    class="grid grid-flow-dense auto-rows-[160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
  >
    <!-- 1 · Button ──────────────────────────── 2×2 -->
    <div class={stdLg} {@attach bento} style="--d:0">
      <a href={resolve('/blocks/primitives/button')} class={linkStd} aria-label="Button docs"></a>
      <div class={inner}>
        {@render heading('Button')}
        <div class="flex flex-1 flex-col items-start justify-center gap-3">
          <Button size="sm" intent="primary" mint={['scale', 'ripple']}>Save changes</Button>
          <Button size="sm" variant="outlined">Cancel</Button>
          <Button size="sm" variant="ghost" intent="danger">Delete project</Button>
        </div>
      </div>
    </div>

    <!-- 2 · Tab ─────────────────────────────── 2×2 -->
    <div class={stdLg} {@attach bento} style="--d:40">
      <a href={resolve('/blocks/primitives/tab')} class={linkStd} aria-label="Tab docs"></a>
      <div class={inner}>
        {@render heading('Tab')}
        <div class="{demo} w-full">
          <Tab defaultValue="home" size="sm" class="w-full">
            {#snippet tabs()}
              <TabItem value="home">Home</TabItem>
              <TabItem value="explore">Explore</TabItem>
              <TabItem value="library">Library</TabItem>
            {/snippet}
            {#snippet panels()}
              <TabPanel value="home">
                <p class="text-text-secondary text-sm">
                  The default tab — line variant, token-driven, keyboard-navigable.
                </p>
              </TabPanel>
              <TabPanel value="explore">
                <p class="text-text-secondary text-sm">Discover components, patterns, tokens.</p>
              </TabPanel>
              <TabPanel value="library">
                <p class="text-text-secondary text-sm">Your saved components and presets.</p>
              </TabPanel>
            {/snippet}
          </Tab>
        </div>
      </div>
    </div>

    <!-- 3 · Toggle ──────────────────────────── 1×1 -->
    <div class={std} {@attach bento} style="--d:80">
      <a href={resolve('/blocks/primitives/toggle')} class={linkStd} aria-label="Toggle docs"></a>
      <div class={inner}>
        {@render heading('Toggle')}
        <div class="flex flex-1 flex-col items-center justify-center gap-3">
          <Toggle checked={true} />
          <Toggle checked={false} />
        </div>
      </div>
    </div>

    <!-- 4 · Checkbox ────────────────────────── 1×1 -->
    <div class={std} {@attach bento} style="--d:120">
      <a href={resolve('/blocks/primitives/checkbox')} class={linkStd} aria-label="Checkbox docs"
      ></a>
      <div class={inner}>
        {@render heading('Checkbox')}
        <div class="flex flex-1 flex-col items-center justify-center gap-3">
          <Checkbox checked={true} slotClasses={{ box: 'rounded-full' }} />
          <Checkbox checked={true} slotClasses={{ box: 'w-7 h-7 rounded-md', icon: 'w-5 h-5' }} />
          <Checkbox checked={false} />
        </div>
      </div>
    </div>

    <!-- 5 · Input ───────────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:160">
      <a href={resolve('/blocks/primitives/input')} class={linkStd} aria-label="Input docs"></a>
      <div class={inner}>
        {@render heading('Input')}
        <div class={demo}>
          <Input placeholder="Enter your email" class="w-full" />
        </div>
      </div>
    </div>

    <!-- 6 · Menu ────────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:200">
      <a href={resolve('/blocks/primitives/menu')} class={linkStd} aria-label="Menu docs"></a>
      <div class={inner}>
        {@render heading('Menu')}
        <div class={demo}>
          <Menu
            items={[
              { label: 'Edit', onSelect: () => {} },
              { label: 'Duplicate', onSelect: () => {} },
              { label: 'Archive', onSelect: () => {} }
            ]}
            placeholder="Actions"
            size="sm"
            class="w-full"
          />
        </div>
      </div>
    </div>

    <!-- 7 · Dialog ──────────────────────────── 1×1 -->
    <div class={std} {@attach bento} style="--d:240">
      <a href={resolve('/blocks/primitives/dialog')} class={linkStd} aria-label="Dialog docs"></a>
      <div class={inner}>
        {@render heading('Dialog')}
        <div class={demo}>
          <div
            class="border-border-subtle bg-surface-overlay w-full max-w-[130px] overflow-hidden rounded-lg border shadow-(--blocks-shadow-sm)"
          >
            <div class="from-primary to-primary-emphasis h-1.5 bg-linear-to-r"></div>
            <div class="p-2.5">
              <div class="bg-text-primary/20 mb-1.5 h-2 w-14 rounded"></div>
              <div class="bg-text-tertiary/10 mb-2.5 h-1.5 w-full rounded"></div>
              <div class="flex justify-end gap-1.5">
                <div class="bg-border-default h-4 w-10 rounded"></div>
                <div class="bg-primary h-4 w-10 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 8 · Card ────────────────────────────── 2×2 (profile composition) -->
    <div class={stdLg} {@attach bento} style="--d:320">
      <a href={resolve('/blocks/primitives/card')} class={linkStd} aria-label="Card docs"></a>
      <div class={inner}>
        {@render heading('Card')}
        <div class={demo}>
          <Card
            unstyled
            class="border-border-subtle bg-surface-elevated w-full overflow-hidden rounded-xl border"
          >
            <div class="from-primary to-success h-16 bg-linear-to-r"></div>
            <div class="px-4 pb-4">
              <div class="-mt-7">
                <Avatar name="Ada Lovelace" size="lg" class="ring-surface-elevated ring-4" />
              </div>
              <h3 class="text-text-primary mt-2 text-sm font-bold">Ada Lovelace</h3>
              <p class="text-text-tertiary text-xs">Design Engineer</p>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <Badge size="sm" intent="primary" variant="soft">Svelte</Badge>
                <Badge size="sm" intent="success" variant="soft">TypeScript</Badge>
                <Badge size="sm" intent="neutral" variant="soft">Tailwind</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>

    <!-- 9 · Avatar ─────────────────────────── 1×1 -->
    <div class={std} {@attach bento} style="--d:360">
      <a href={resolve('/blocks/primitives/avatar')} class={linkStd} aria-label="Avatar docs"></a>
      <div class={inner}>
        {@render heading('Avatar')}
        <div class={demo}>
          <div class="flex -space-x-3">
            <Avatar name="Ada Lovelace" randomColor class="ring-surface-elevated ring-2" />
            <Avatar name="Anna Keller" randomColor class="ring-surface-elevated ring-2" />
            <Avatar name="Samir Tahir" randomColor class="ring-surface-elevated ring-2" />
            <Avatar class="ring-surface-elevated ring-2">+5</Avatar>
          </div>
        </div>
      </div>
    </div>

    <!-- 10 · Spinner ────────────────────────── 1×1 -->
    <div class={std} {@attach bento} style="--d:400">
      <a href={resolve('/blocks/primitives/spinner')} class={linkStd} aria-label="Spinner docs"></a>
      <div class={inner}>
        {@render heading('Spinner')}
        <div class="flex flex-1 items-center justify-center gap-4">
          <Spinner size="sm" intent="primary" />
          <Spinner size="md" intent="success" />
          <Spinner size="lg" intent="danger" />
        </div>
      </div>
    </div>

    <!-- 11 · Badge ──────────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:440">
      <a href={resolve('/blocks/primitives/badge')} class={linkStd} aria-label="Badge docs"></a>
      <div class={inner}>
        {@render heading('Badge')}
        <div class={demo}>
          <div class="flex flex-wrap items-center gap-3">
            <Badge intent="success">Online</Badge>
            <Badge intent="warning" variant="soft">Syncing</Badge>
            <Badge intent="danger" variant="outlined">Offline</Badge>
          </div>
        </div>
      </div>
    </div>

    <!-- 12 · Alert ──────────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:480">
      <a href={resolve('/blocks/primitives/alert')} class={linkStd} aria-label="Alert docs"></a>
      <div class={inner}>
        {@render heading('Alert')}
        <div class={demo}>
          <Alert intent="info" title="New: AI Copilot" class="w-full">
            Intelligent code suggestions powered by your design tokens.
          </Alert>
        </div>
      </div>
    </div>

    <!-- 13 · Tooltip ────────────────────────── 1×1 -->
    <div class={std} {@attach bento} style="--d:520">
      <a href={resolve('/blocks/primitives/tooltip')} class={linkStd} aria-label="Tooltip docs"></a>
      <div class={inner}>
        {@render heading('Tooltip')}
        <div class="flex flex-1 flex-col items-center justify-center gap-1.5">
          <div
            class="bg-surface-inverted text-text-inverted rounded-md px-2.5 py-1 text-[11px] font-medium shadow-(--blocks-shadow-sm)"
          >
            Copy to clipboard
          </div>
          <svg class="text-surface-inverted h-2 w-3" viewBox="0 0 12 8"
            ><path fill="currentColor" d="M6 8 0 0h12z" /></svg
          >
          <Button variant="outlined" size="xs">Copy</Button>
        </div>
      </div>
    </div>

    <!-- 14 · Popover ────────────────────────── 1×1 -->
    <div class={std} {@attach bento} style="--d:560">
      <a href={resolve('/blocks/primitives/popover')} class={linkStd} aria-label="Popover docs"></a>
      <div class={inner}>
        {@render heading('Popover')}
        <div class="flex flex-1 flex-col items-center justify-center gap-1.5">
          <div
            class="border-border-subtle bg-surface-overlay rounded-lg border p-2.5 shadow-(--blocks-shadow-sm)"
          >
            <div class="mb-1.5 flex items-center gap-2">
              <div class="bg-success h-2 w-2 rounded-full"></div>
              <div class="bg-text-tertiary/20 h-1.5 w-16 rounded"></div>
            </div>
            <div class="bg-text-tertiary/10 h-1.5 w-12 rounded"></div>
          </div>
          <svg class="text-surface-overlay h-2 w-3 rotate-180" viewBox="0 0 12 8"
            ><path fill="currentColor" d="M6 8 0 0h12z" /></svg
          >
          <Button variant="outlined" size="xs" intent="primary">Trigger</Button>
        </div>
      </div>
    </div>

    <!-- 15 · Accordion ──────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:600">
      <a href={resolve('/blocks/primitives/accordion')} class={linkStd} aria-label="Accordion docs"
      ></a>
      <div class={inner}>
        {@render heading('Accordion')}
        <div class="flex flex-1 items-start">
          <Accordion size="sm" class="w-full">
            <AccordionItem value="a1" title="Token-driven theming">
              OKLCH semantic tokens — dark mode included.
            </AccordionItem>
            <AccordionItem value="a2" title="Accessible by default">
              Keyboard navigation and ARIA built in.
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>

    <!-- 16 · Skeleton ───────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:640">
      <a href={resolve('/blocks/primitives/skeleton')} class={linkStd} aria-label="Skeleton docs"
      ></a>
      <div class={inner}>
        {@render heading('Skeleton')}
        <div class={demo}>
          <div class="flex w-full items-center gap-3">
            <Skeleton variant="circular" size="md" />
            <div class="flex flex-1 flex-col gap-2">
              <Skeleton variant="text" size="sm" class="w-3/4" />
              <Skeleton variant="text" size="xs" class="w-1/2" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 17 · Combobox ───────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:680">
      <a href={resolve('/blocks/primitives/combobox')} class={linkStd} aria-label="Combobox docs"
      ></a>
      <div class={inner}>
        {@render heading('Combobox')}
        <div class={demo}>
          <Combobox
            options={[
              { label: 'Apple', value: 'apple' },
              { label: 'Banana', value: 'banana' },
              { label: 'Cherry', value: 'cherry' }
            ]}
            placeholder="Search fruit…"
            class="w-full"
          />
        </div>
      </div>
    </div>

    <!-- 18 · Toolbar ────────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:720">
      <a href={resolve('/blocks/primitives/toolbar')} class={linkStd} aria-label="Toolbar docs"></a>
      <div class={inner}>
        {@render heading('Toolbar')}
        <div class={demo}>
          <Toolbar aria-label="Formatting">
            <Button variant="ghost" size="xs" intent="primary"><b>B</b></Button>
            <Button variant="ghost" size="xs"><em>I</em></Button>
            <Button variant="ghost" size="xs"><u>U</u></Button>
            <Separator orientation="vertical" size="sm" />
            <Button variant="ghost" size="xs">Left</Button>
            <Button variant="ghost" size="xs">Center</Button>
          </Toolbar>
        </div>
      </div>
    </div>

    <!-- 19 · Pagination ─────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:760">
      <a
        href={resolve('/blocks/primitives/pagination')}
        class={linkStd}
        aria-label="Pagination docs"
      ></a>
      <div class={inner}>
        {@render heading('Pagination')}
        <div class={demo}>
          <Pagination currentPage={3} totalPages={10} size="sm" intent="primary" />
        </div>
      </div>
    </div>

    <!-- 20 · Breadcrumb ─────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:800">
      <a
        href={resolve('/blocks/primitives/breadcrumb')}
        class={linkStd}
        aria-label="Breadcrumb docs"
      ></a>
      <div class={inner}>
        {@render heading('Breadcrumb')}
        <div class={demo}>
          <Breadcrumb
            items={[
              { label: 'Home', href: '#' },
              { label: 'Docs', href: '#' },
              { label: 'Components' }
            ]}
            size="sm"
          />
        </div>
      </div>
    </div>

    <!-- 21 · ButtonGroup ────────────────────── 2×1 -->
    <div class={stdWd} {@attach bento} style="--d:840">
      <a
        href={resolve('/blocks/primitives/button-group')}
        class={linkStd}
        aria-label="ButtonGroup docs"
      ></a>
      <div class={inner}>
        {@render heading('ButtonGroup')}
        <div class={demo}>
          <ButtonGroup>
            <Button size="sm" intent="primary">Left</Button>
            <Button size="sm" intent="primary" variant="outlined">Center</Button>
            <Button size="sm" intent="primary" variant="outlined">Right</Button>
          </ButtonGroup>
        </div>
      </div>
    </div>

    <!-- 22 · Separator ──────────────────────── 1×1 -->
    <div class={std} {@attach bento} style="--d:880">
      <a href={resolve('/blocks/primitives/separator')} class={linkStd} aria-label="Separator docs"
      ></a>
      <div class={inner}>
        {@render heading('Separator')}
        <div class="flex flex-1 flex-col items-center justify-center gap-3">
          <div class="w-full">
            <Separator size="sm" />
          </div>
          <div class="flex h-6 items-center gap-3">
            <span class="text-text-tertiary text-xs">A</span>
            <Separator orientation="vertical" size="sm" />
            <span class="text-text-tertiary text-xs">B</span>
            <Separator orientation="vertical" size="sm" />
            <span class="text-text-tertiary text-xs">C</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 23 · Toast ──────────────────────────── 1×1 -->
    <div class={std} {@attach bento} style="--d:920">
      <a href={resolve('/blocks/primitives/toast')} class={linkStd} aria-label="Toast docs"></a>
      <div class={inner}>
        {@render heading('Toast')}
        <div class="flex flex-1 flex-col items-center justify-center gap-2">
          <div
            class="border-success/30 bg-success/5 flex w-full items-start gap-2 rounded-lg border p-2"
          >
            <div class="bg-success mt-0.5 h-3 w-3 shrink-0 rounded-full"></div>
            <div class="flex-1">
              <div class="bg-success/30 mb-1 h-2 w-12 rounded"></div>
              <div class="bg-text-tertiary/15 h-1.5 w-20 rounded"></div>
            </div>
          </div>
          <div
            class="border-danger/30 bg-danger/5 flex w-full items-start gap-2 rounded-lg border p-2"
          >
            <div class="bg-danger mt-0.5 h-3 w-3 shrink-0 rounded-full"></div>
            <div class="flex-1">
              <div class="bg-danger/30 mb-1 h-2 w-10 rounded"></div>
              <div class="bg-text-tertiary/15 h-1.5 w-16 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ─── Customization island ───────────────────────────────── -->
  <section class="mt-20" aria-labelledby="customization-island-title">
    <p class="meta-marker">Unstyled in action</p>
    <h2
      id="customization-island-title"
      class="text-text-primary mt-4 text-2xl font-bold tracking-tight sm:text-3xl"
    >
      The default is editorial — and this is how far you can take it<span
        class="pipe"
        aria-hidden="true">|</span
      >
    </h2>
    <p class="text-text-secondary mt-4 max-w-2xl text-sm leading-relaxed">
      Every component accepts
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >unstyled</code
      >
      to drop the editorial skin entirely and
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >slotClasses</code
      >
      to restyle single slots. The two showpieces below are the same Button and Tab from the grid — pushed
      to the opposite end of the spectrum.
    </p>

    <div
      class="border-border-subtle mt-8 rounded-[var(--docs-radius-card,1rem)] border bg-neutral-950 p-8"
    >
      <div class="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div class="flex flex-col items-start justify-center gap-3">
          <span class="text-[11px] font-semibold tracking-widest text-white/50 uppercase">
            Button · unstyled + slotClasses
          </span>
          <Button
            size="sm"
            mint={['scale', 'ripple']}
            slotClasses={{
              base: 'bg-linear-to-r from-violet-600 to-fuchsia-500 border-none shadow-lg shadow-violet-500/30'
            }}>Launch Project</Button
          >
          <Button
            unstyled
            class="rounded-lg border border-emerald-400 px-4 py-2 text-sm font-medium text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all hover:bg-emerald-400/10 hover:shadow-[0_0_25px_rgba(52,211,153,0.5)]"
            >Neon Outline</Button
          >
          <Button
            unstyled
            mint="scale"
            class="inline-flex items-center gap-2 rounded-none border-2 border-current px-5 py-2 font-mono text-xs font-bold tracking-widest text-neutral-300 uppercase transition-all hover:bg-white hover:text-neutral-950"
            >Brutalist</Button
          >
        </div>

        <div>
          <span class="text-[11px] font-semibold tracking-widest text-white/50 uppercase">
            Tab · unstyled on gradient
          </span>
          <div
            class="mt-3 rounded-xl bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 p-4"
          >
            <Tab unstyled defaultValue="home" class="w-full">
              {#snippet tabs()}
                <div class="flex gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-md">
                  <TabItem
                    unstyled
                    value="home"
                    class="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >Home</TabItem
                  >
                  <TabItem
                    unstyled
                    value="explore"
                    class="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >Explore</TabItem
                  >
                  <TabItem
                    unstyled
                    value="library"
                    class="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >Library</TabItem
                  >
                </div>
              {/snippet}
              {#snippet panels()}
                <TabPanel
                  unstyled
                  value="home"
                  class="mt-3 rounded-xl bg-white/10 p-4 text-sm text-white/80 backdrop-blur-md"
                  >Frosted glass panels with gradient backdrop</TabPanel
                >
                <TabPanel
                  unstyled
                  value="explore"
                  class="mt-3 rounded-xl bg-white/10 p-4 text-sm text-white/80 backdrop-blur-md"
                  >Discover components, patterns, tokens</TabPanel
                >
                <TabPanel
                  unstyled
                  value="library"
                  class="mt-3 rounded-xl bg-white/10 p-4 text-sm text-white/80 backdrop-blur-md"
                  >Your saved components and presets</TabPanel
                >
              {/snippet}
            </Tab>
          </div>
        </div>
      </div>
    </div>

    <a
      href={resolve('/customization')}
      class="text-text-tertiary hover:text-primary mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
    >
      Read the customization guide
      <ArrowRightIcon class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  </section>

  <div class="mt-14 text-center">
    <p class="text-text-tertiary text-sm leading-relaxed">
      Zero external dependencies. Every component supports
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >unstyled</code
      >,
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >slotClasses</code
      >, and
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs">mint</code>
      micro-interactions. AI-native with MCP server and per-component
      <code class="bg-surface-elevated rounded-modify px-1.5 py-0.5 font-mono text-xs"
        >llms.txt</code
      >.
    </p>
  </div>
</div>

<style>
  .bento-card {
    opacity: 0;
    animation: bento-in 0.6s var(--blocks-ease-confident, cubic-bezier(0.16, 1, 0.3, 1)) forwards;
    animation-delay: calc(var(--d, 0) * 1ms);
  }

  @keyframes bento-in {
    from {
      opacity: 0;
      transform: translateY(24px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bento-card {
      opacity: 1;
      animation: none;
    }
  }
</style>
