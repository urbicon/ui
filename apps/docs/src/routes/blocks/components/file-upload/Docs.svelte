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
      description="One file, by drag-and-drop or click. The result renders as a file list with name, size and a remove button."
      code={basicUploadCode}
    >
      <BasicUpload />
    </CodeExample>

    <CodeExample
      title="Images with a preview"
      description="Images become thumbnails on their own. Below the component sits a hand-built grid with overlaid filenames — FileUpload and a preview layout of your own, side by side."
      code={imagePreviewCode}
    >
      <ImagePreview />
    </CodeExample>

    <CodeExample
      title="Validation with feedback"
      description="File type (.pdf, .docx, .xlsx), a 2 MB size ceiling and a count of 3 are all checked. Rejections surface as an alert carrying structured messages."
      code={withValidationCode}
    >
      <WithValidation />
    </CodeExample>

    <CodeExample
      title="Upload progress"
      description="A simulated upload with a bar per file. The indicators walk the lifecycle — pending → uploading → complete/error — and the consumer drives the progress from outside."
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
      title="Custom Dropzone Design"
      description="The `children` snippet replaces the dropzone contents wholesale — here a gradient ground, an icon of its own and a call to action, with `slotClasses` handling the frame."
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
        The dropzone is a <code class="text-text-primary">role="button"</code> with
        <code class="text-text-primary">tabindex="0"</code>. The file list is a
        <code class="text-text-primary">role="list"</code> with
        <code class="text-text-primary">aria-live="polite"</code>, so a screen reader hears every
        change without being asked; each entry is a
        <code class="text-text-primary">role="listitem"</code>. The real
        <code class="text-text-primary">&lt;input type="file"&gt;</code> stays in the DOM, visually hidden,
        because nothing beats it for compatibility.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Enter" />
        or
        <Kbd keys="Space" />
        on the dropzone opens the native file dialog.
        <Kbd keys="Tab" />
        moves between the dropzone, the file items and their remove buttons. Focus rings use
        <code class="text-text-primary">focus-visible:</code>, so they appear for the keyboard only.
      </p>
    </Note>
    <Note title="Drag states">
      <p>
        The dropzone's <code class="text-text-primary">data-state</code> moves between
        <code class="text-text-primary">idle</code>,
        <code class="text-text-primary">accept</code> and
        <code class="text-text-primary">reject</code>, which is enough to style the whole
        interaction in <code class="text-text-primary">unstyled</code> mode from CSS alone. Colour, scale
        and shadow tell the reader whether what they are dragging will be taken.
      </p>
    </Note>
    <Note title="Document Drop Prevention">
      <p>
        On by default through <code class="text-text-primary">preventDocumentDrop</code>: a file
        dropped anywhere but the dropzone does not open in the browser. Without it, a near-miss
        navigates away from the page and takes unsaved work with it.
      </p>
    </Note>
  </NoteList>
</Section>
