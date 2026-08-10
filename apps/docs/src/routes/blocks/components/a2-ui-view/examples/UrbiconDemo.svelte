<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    A2UIView,
    Button,
    URBICON_A2UI_CATALOG_ID,
    urbiconA2uiCatalog,
    type A2uiActionEvent,
    type A2uiDataSchema
  } from '@urbicon-ui/blocks';

  // The SAME golden-replay pattern as the Basic specimen, but against the
  // Urbicon-native catalog: real intents, a Section structure layer, RichText
  // (markdown) vs plain Text, a Select/RadioGroup/DatePicker form, an Accordion,
  // and a data schema that type-checks the model writes. Pass the Urbicon catalog
  // via `catalogs` (opt-in) and the schema via `dataSchema`.
  const CID = URBICON_A2UI_CATALOG_ID;

  const SCHEMA: A2uiDataSchema = {
    '/name': { type: 'string', description: 'The guest name' },
    // Select writes a string ARRAY (single-select = a one-element array).
    '/room': { type: 'array', description: 'Chosen room type(s)' },
    '/date': { type: 'string', format: 'date' },
    '/time': { type: 'string' }
  };

  const SEQUENCE: unknown[] = [
    { version: 'v0.9.1', createSurface: { surfaceId: 'u', catalogId: CID } },
    {
      version: 'v0.9.1',
      updateDataModel: {
        surfaceId: 'u',
        value: { name: '', room: [], date: '', time: 'afternoon' }
      }
    },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'u',
        components: [
          {
            id: 'root',
            component: 'Section',
            title: 'Plan a stay',
            description: 'Pick a room and the day you arrive.',
            child: 'card'
          },
          { id: 'card', component: 'Card', variant: 'elevated', child: 'form' },
          {
            id: 'form',
            component: 'Column',
            children: ['intro', 'name', 'room', 'date', 'time', 'actions', 'faq']
          }
        ]
      }
    },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'u',
        components: [
          {
            id: 'intro',
            component: 'RichText',
            content: 'Choose a **room** below — changes save as you go.'
          },
          {
            id: 'name',
            component: 'Input',
            label: 'Your name',
            value: { path: '/name' },
            placeholder: 'Ada Lovelace'
          },
          {
            id: 'room',
            component: 'Select',
            label: 'Room',
            value: { path: '/room' },
            options: [
              { label: 'Garden Room', value: 'garden' },
              { label: 'Corner Room', value: 'corner' },
              { label: 'Suite', value: 'suite' }
            ]
          }
        ]
      }
    },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'u',
        components: [
          { id: 'date', component: 'DatePicker', label: 'Check-in', value: { path: '/date' } },
          {
            id: 'time',
            component: 'RadioGroup',
            label: 'Arrival',
            value: { path: '/time' },
            orientation: 'horizontal',
            options: [
              { label: 'Morning', value: 'morning' },
              { label: 'Afternoon', value: 'afternoon' },
              { label: 'Evening', value: 'evening' }
            ]
          }
        ]
      }
    },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'u',
        components: [
          {
            id: 'actions',
            component: 'Row',
            justify: 'spaceBetween',
            align: 'center',
            children: ['dur', 'book']
          },
          { id: 'dur', component: 'Badge', text: 'From €300', intent: 'neutral', variant: 'soft' },
          { id: 'book-label', component: 'Text', text: 'Request the stay' },
          {
            id: 'book',
            component: 'Button',
            intent: 'primary',
            child: 'book-label',
            action: {
              event: {
                name: 'book',
                context: { name: { path: '/name' }, room: { path: '/room' } }
              }
            }
          }
        ]
      }
    },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'u',
        components: [
          {
            id: 'faq',
            component: 'Accordion',
            items: [
              { label: 'Can I change my dates?', child: 'faq1' },
              { label: 'Cancellation policy', child: 'faq2' }
            ]
          },
          {
            id: 'faq1',
            component: 'Text',
            text: 'Yes — move your stay up to a week before arrival.'
          },
          {
            id: 'faq2',
            component: 'Text',
            text: 'Cancellations within seven days are charged in full.'
          }
        ]
      }
    }
  ];

  let payload = $state<unknown[]>([]);
  let streaming = $state(false);
  let lastAction = $state<A2uiActionEvent | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function replay() {
    clearTimeout(timer);
    payload = [];
    lastAction = null;
    streaming = true;
    let i = 0;
    const tick = () => {
      payload = [...payload, SEQUENCE[i]];
      i += 1;
      if (i < SEQUENCE.length) {
        timer = setTimeout(tick, 550);
      } else {
        streaming = false;
      }
    };
    timer = setTimeout(tick, 300);
  }

  replay();
  onDestroy(() => clearTimeout(timer));
</script>

<div class="space-y-3">
  <div class="mx-auto max-w-md">
    <A2UIView
      {payload}
      {streaming}
      catalogs={[urbiconA2uiCatalog]}
      dataSchema={SCHEMA}
      onAction={(event) => (lastAction = event)}
    />
  </div>

  {#if lastAction}
    <pre
      class="bg-surface-base border-border-subtle text-text-secondary overflow-x-auto rounded-lg border p-3 text-xs">[ui-action] {JSON.stringify(
        lastAction,
        null,
        2
      )}</pre>
  {/if}

  <Button size="sm" variant="outlined" onclick={replay}>Replay stream</Button>
</div>
