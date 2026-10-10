<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    BasicUpload,
    ImagePreview,
    WithValidation,
    UploadProgress,
    CustomDropzone
  } from './examples';

  import basicUploadCode from './examples/BasicUpload.svelte?raw';
  import imagePreviewCode from './examples/ImagePreview.svelte?raw';
  import withValidationCode from './examples/WithValidation.svelte?raw';
  import uploadProgressCode from './examples/UploadProgress.svelte?raw';
  import customDropzoneCode from './examples/CustomDropzone.svelte?raw';
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Basic upload"
      description="One file, by drag-and-drop or click. Each accepted file lists its name, size and a remove button."
      code={basicUploadCode}
    >
      <BasicUpload />
    </CodeExample>

    <CodeExample
      title="Images with a preview"
      description="FileUpload shows a thumbnail for each image. Below it, this example adds a grid of larger previews with overlaid filenames, to show pairing the component with a layout of your own."
      code={imagePreviewCode}
    >
      <ImagePreview />
    </CodeExample>

    <CodeExample
      title="Validation with feedback"
      description="accept, maxFileSize and maxFiles are all enforced: PDF, DOCX or XLSX only, 2 MB each, three files at most. A rejected file shows up in an Alert with a per-file reason."
      code={withValidationCode}
    >
      <WithValidation />
    </CodeExample>

    <CodeExample
      title="Upload progress"
      description="A simulated upload with a bar per file. Each file moves through pending, uploading, then complete or error; your upload code sets the status and percentage as it goes."
      code={uploadProgressCode}
    >
      <UploadProgress />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-10">
    <CodeExample
      title="Custom dropzone design"
      description="The `children` snippet replaces the dropzone contents: here a gradient background, an icon and a call to action, with `slotClasses` for the frame."
      code={customDropzoneCode}
    >
      <CustomDropzone />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA and roles">
      <p>
        The control is the real <code class="text-text-primary">&lt;input type="file"&gt;</code>,
        visually hidden but focusable. The <code class="text-text-primary">id</code>,
        <code class="text-text-primary">aria-labelledby</code>,
        <code class="text-text-primary">aria-describedby</code>,
        <code class="text-text-primary">aria-invalid</code> and
        <code class="text-text-primary">aria-required</code> you pass to
        <code class="text-text-primary">FileUpload</code> land on it, so a
        <code class="text-text-primary">FormField</code> label or a
        <code class="text-text-primary">&lt;label for&gt;</code> names it, and a click on that label
        opens the file dialog. The dropzone's text describes it; the dropzone itself has no role.
        The file list is a <code class="text-text-primary">role="list"</code> with
        <code class="text-text-primary">aria-live="polite"</code>, so a screen reader hears every
        change without being asked; each entry is a
        <code class="text-text-primary">role="listitem"</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" />
        stops once on the file input, and
        <Kbd keys="Enter" />
        or
        <Kbd keys="Space" />
        there opens the native file dialog; <Kbd keys="Tab" /> from there moves on to the remove buttons
        in the file list. Once <code class="text-text-primary">maxFiles</code> is reached the
        dropzone goes and the input leaves the tab order. The dropzone draws the input's focus ring,
        for the keyboard only. It never takes focus itself, so a ring of your own in
        <code class="text-text-primary">slotClasses.dropzone</code> needs
        <code class="text-text-primary">peer-focus-visible:</code>, not
        <code class="text-text-primary">focus-visible:</code>. Safari's <Kbd keys="Tab" /> skips the input
        as it skips every button, unless “Press Tab to highlight each item” is turned on;
        <Kbd keys={['Option', 'Tab']} /> reaches it either way.
      </p>
    </Note>
    <Note title="Drag states">
      <p>
        Colour, scale and shadow show whether what is being dragged will be taken. The dropzone's
        <code class="text-text-primary">data-blocks-dropzone-state</code> moves between
        <code class="text-text-primary">idle</code>,
        <code class="text-text-primary">accept</code> and
        <code class="text-text-primary">reject</code>, so you can restyle each state, with or
        without <code class="text-text-primary">unstyled</code>: from CSS, or with a
        <code class="text-text-primary">data-[blocks-dropzone-state=reject]:</code> variant in
        <code class="text-text-primary">slotClasses.dropzone</code>. The accept state's border
        pulses, and a running animation outranks any border colour, so add
        <code class="text-text-primary">data-[blocks-dropzone-state=accept]:animate-none</code> before
        you set your own.
      </p>
    </Note>
    <Note title="Document drop prevention">
      <p>
        On by default through <code class="text-text-primary">preventDocumentDrop</code>: a file
        dropped anywhere but the dropzone does not open in the browser. Without it, a near-miss
        navigates away from the page and takes unsaved work with it.
      </p>
    </Note>
  </NoteList>
</Section>
