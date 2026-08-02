<script lang="ts">
  // A real composition: the row spacing is a first:/last: contract, so it can
  // only be observed with several siblings actually mounted together.
  import Note from '../Note.svelte';
  import NoteList from '../NoteList.svelte';
</script>

<NoteList>
  <Note title="Built-in ARIA" data-note-row>The trigger carries aria-expanded.</Note>
  <Note title="Keyboard" data-note-row>Arrow keys move between items.</Note>
  <Note title="Reduced motion" data-note-row>The slide is dropped.</Note>
</NoteList>
