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
    '/service': { type: 'string', enum: ['haircut', 'colour', 'style'] },
    '/date': { type: 'string', format: 'date' },
    '/time': { type: 'string' }
  };

  const SEQUENCE: unknown[] = [
    { version: 'v0.9.1', createSurface: { surfaceId: 'u', catalogId: CID } },
    {
      version: 'v0.9.1',
      updateDataModel: {
        surfaceId: 'u',
        value: { name: '', service: [], date: '', time: 'morning' }
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
            title: 'Book an appointment',
            description: 'Pick a service and a time that suits you.',
            child: 'card'
          },
          { id: 'card', component: 'Card', variant: 'elevated', child: 'form' },
          {
            id: 'form',
            component: 'Column',
            children: ['intro', 'name', 'service', 'date', 'time', 'actions', 'faq']
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
            content: 'Choose a **service** below — changes save as you go.'
          },
          {
            id: 'name',
            component: 'Input',
            label: 'Your name',
            value: { path: '/name' },
            placeholder: 'Ada Lovelace'
          },
          {
            id: 'service',
            component: 'Select',
            label: 'Service',
            value: { path: '/service' },
            options: [
              { label: 'Haircut', value: 'haircut' },
              { label: 'Colour', value: 'colour' },
              { label: 'Style', value: 'style' }
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
          { id: 'date', component: 'DatePicker', label: 'Date', value: { path: '/date' } },
          {
            id: 'time',
            component: 'RadioGroup',
            label: 'Time of day',
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
          { id: 'dur', component: 'Badge', text: '30 min', intent: 'neutral', variant: 'soft' },
          { id: 'book-label', component: 'Text', text: 'Book now' },
          {
            id: 'book',
            component: 'Button',
            intent: 'primary',
            child: 'book-label',
            action: {
              event: {
                name: 'book',
                context: { name: { path: '/name' }, service: { path: '/service' } }
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
              { label: 'Can I reschedule?', child: 'faq1' },
              { label: 'Cancellation policy', child: 'faq2' }
            ]
          },
          {
            id: 'faq1',
            component: 'Text',
            text: 'Yes — reschedule up to 24 hours before your slot.'
          },
          {
            id: 'faq2',
            component: 'Text',
            text: 'Cancellations within 24 hours are charged in full.'
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
