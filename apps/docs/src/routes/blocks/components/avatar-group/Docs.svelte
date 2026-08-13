<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { AvatarGroup } from '@urbicon-ui/blocks';

  const team = [
    { name: 'Ada Lovelace' },
    { name: 'Alan Turing' },
    { name: 'Grace Hopper', randomColor: true },
    { name: 'Katherine Johnson', randomColor: true },
    { name: 'Edsger Dijkstra' },
    { name: 'Barbara Liskov' }
  ];

  const sizes = ['sm', 'md', 'lg', 'xl'] as const;
  const spacings = ['tight', 'normal', 'loose'] as const;
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Basic stack"
      description="Pass an items array of Avatar props. Each entry becomes an avatar, overlapped with a cut-out ring so the set reads as one unit."
      code={`<AvatarGroup
  items={[
    { name: 'Ada Lovelace' },
    { name: 'Alan Turing' },
    { name: 'Grace Hopper' },
    { name: 'Katherine Johnson' }
  ]}
/>`}
      language="svelte"
    >
      <AvatarGroup items={team.slice(0, 4)} />
    </CodeExample>

    <CodeExample
      title="Overflow — max"
      description="When items exceeds max, the group renders max − 1 avatars plus a single “+N” chip, so the total rendered count is exactly max. Here six people cap to four slots."
      code={`<AvatarGroup items={team} max={4} />`}
      language="svelte"
    >
      <AvatarGroup items={team} max={4} />
    </CodeExample>

    <CodeExample
      title="Sizes"
      description="size applies to every avatar and the overflow chip alike. Available: xs, sm, md (default), lg, xl, 2xl."
      code={`{#each ['sm', 'md', 'lg', 'xl'] as size}
  <AvatarGroup items={team} max={4} {size} />
{/each}`}
      language="svelte"
    >
      <div class="flex flex-col gap-4">
        {#each sizes as size (size)}
          <div class="flex items-center gap-4">
            <span class="text-text-tertiary w-8 text-xs">{size}</span>
            <AvatarGroup items={team} max={4} {size} />
          </div>
        {/each}
      </div>
    </CodeExample>
  </div>
</Section>

<Section marker id="appearance" title="Appearance">
  <div class="space-y-8">
    <CodeExample
      title="Spacing"
      description="spacing controls the overlap: tight packs the stack, loose spreads it out, normal is the default."
      code={`{#each ['tight', 'normal', 'loose'] as spacing}
  <AvatarGroup items={team} max={4} {spacing} />
{/each}`}
      language="svelte"
    >
      <div class="flex flex-col gap-4">
        {#each spacings as spacing (spacing)}
          <div class="flex items-center gap-4">
            <span class="text-text-tertiary w-14 text-xs">{spacing}</span>
            <AvatarGroup items={team} max={4} {spacing} />
          </div>
        {/each}
      </div>
    </CodeExample>

    <CodeExample
      title="Identity colours"
      description="Set randomColor on an item to derive its background colour from its name; the same name always maps to the same colour, so people without a photo stay distinct. An item with a src shows that photo instead, with the same cut-out ring; the others keep their initials."
      code={`<AvatarGroup
  items={[
    { name: 'Ada Lovelace', randomColor: true },
    { name: 'Alan Turing', randomColor: true },
    { name: 'Grace Hopper', randomColor: true },
    { name: 'Barbara Liskov', randomColor: true }
  ]}
/>`}
      language="svelte"
    >
      <AvatarGroup
        items={[
          { name: 'Ada Lovelace', randomColor: true },
          { name: 'Alan Turing', randomColor: true },
          { name: 'Grace Hopper', randomColor: true },
          { name: 'Barbara Liskov', randomColor: true }
        ]}
      />
    </CodeExample>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Group semantics">
      <p>
        The stack is a <code>role="group"</code> with a localized <code>aria-label</code> (“User
        avatars” by default). Override it with your own <code>aria-label</code> to name the specific set:
        “Project collaborators”, “Assignees”.
      </p>
    </Note>
    <Note title="Per-avatar naming">
      <p>
        Each avatar shows its initials (or photo) from <code>name</code> / <code>src</code>; the
        group's <code>aria-label</code> gives the whole set its context for assistive tech.
      </p>
    </Note>
    <Note title="The overflow chip is announced">
      <p>
        The <code>+N</code> overflow chip carries its own <code>aria-label</code> (<code>+2</code>,
        <code>+9</code>), so the hidden count is announced.
      </p>
    </Note>
    <Note title="The overlap ring is decorative">
      <p>
        The overlap ring uses <code>borderColor</code> (default: the background behind it). It is decorative;
        set it to match the background the group sits on so the cut-out effect holds.
      </p>
    </Note>
  </NoteList>
</Section>
