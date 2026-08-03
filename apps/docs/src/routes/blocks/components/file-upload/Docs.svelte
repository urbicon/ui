<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    BasicUpload,
    MultipleFiles,
    ImagePreview,
    WithValidation,
    UploadProgress,
    CustomDropzone,
    Sizes,
    PasteUpload
  } from './examples';

  import basicUploadCode from './examples/BasicUpload.svelte?raw';
  import multipleFilesCode from './examples/MultipleFiles.svelte?raw';
  import imagePreviewCode from './examples/ImagePreview.svelte?raw';
  import withValidationCode from './examples/WithValidation.svelte?raw';
  import uploadProgressCode from './examples/UploadProgress.svelte?raw';
  import customDropzoneCode from './examples/CustomDropzone.svelte?raw';
  import sizesCode from './examples/Sizes.svelte?raw';
  import pasteUploadCode from './examples/PasteUpload.svelte?raw';
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Einfacher Upload"
      description="Einzelne Datei per Drag & Drop oder Klick auswaehlen. Das Ergebnis wird als Dateiliste mit Name, Groesse und Entfernen-Button angezeigt."
      code={basicUploadCode}
    >
      <BasicUpload />
    </CodeExample>

    <CodeExample
      title="Mehrere Dateien mit Limit"
      description="Mehrfachauswahl mit maxFiles-Begrenzung. Ein Badge zeigt die verbleibenden Slots an. Ueberschuessige Dateien werden per onFileReject-Callback abgelehnt."
      code={multipleFilesCode}
    >
      <MultipleFiles />
    </CodeExample>

    <CodeExample
      title="Bild-Upload mit Vorschau"
      description="Bilder werden automatisch als Thumbnails angezeigt. Unter der Komponente eine eigene Grid-Vorschau mit Overlay-Dateinamen — demonstriert die Kombination aus FileUpload und eigenem Preview-Layout."
      code={imagePreviewCode}
    >
      <ImagePreview />
    </CodeExample>

    <CodeExample
      title="Validierung mit Feedback"
      description="Dateityp (.pdf, .docx, .xlsx), maximale Groesse (2 MB) und maximale Anzahl (3) werden validiert. Abgelehnte Dateien erscheinen als Alert mit strukturierten Fehlermeldungen."
      code={withValidationCode}
    >
      <WithValidation />
    </CodeExample>

    <CodeExample
      title="Upload-Fortschritt"
      description="Simulierter Upload mit Fortschrittsbalken pro Datei. Status-Indikatoren zeigen den Lebenszyklus: pending → uploading → complete/error. Der Consumer steuert den Fortschritt extern."
      code={uploadProgressCode}
    >
      <UploadProgress />
    </CodeExample>

    <CodeExample
      title="Screenshot einfuegen (Paste)"
      description="Mit allowPaste koennen Bilder direkt aus der Zwischenablage eingefuegt werden — ideal fuer Screenshots und schnelle Workflows. Ctrl+V / Cmd+V genuegt."
      code={pasteUploadCode}
    >
      <PasteUpload />
    </CodeExample>

    <CodeExample
      title="Groessen"
      description="Drei Groessen (sm, md, lg) beeinflussen Dropzone-Padding, Schriftgroesse, Icon-Groesse und Datei-Items gleichermassen."
      code={sizesCode}
    >
      <Sizes />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-10">
    <CodeExample
      title="Custom Dropzone Design"
      description="Ueber den children-Snippet kann der gesamte Inhalt der Dropzone ersetzt werden. Hier mit Gradient-Hintergrund, eigenem Icon und Call-to-Action-Button — kombiniert mit slotClasses fuer den Rahmen."
      code={customDropzoneCode}
    >
      <CustomDropzone />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA & Rollen">
      <p>
        Die Dropzone hat <code class="text-text-primary">role="button"</code> und
        <code class="text-text-primary">tabindex="0"</code>. Die Dateiliste nutzt
        <code class="text-text-primary">role="list"</code> mit
        <code class="text-text-primary">aria-live="polite"</code>, sodass Screenreader Aenderungen
        automatisch ankuendigen. Jedes Datei-Item ist ein
        <code class="text-text-primary">role="listitem"</code>. Der natuerliche
        <code class="text-text-primary">&lt;input type="file"&gt;</code> bleibt im DOM (visuell verborgen)
        fuer maximale Kompatibilitaet.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Enter" />
        oder
        <Kbd keys="Space" />
        auf der Dropzone oeffnet den nativen Dateidialog.
        <Kbd keys="Tab" />
        navigiert zwischen Dropzone, Datei-Items und Entfernen-Buttons. Fokus-Ringe nutzen
        <code class="text-text-primary">focus-visible:</code> fuer reine Keyboard-Sichtbarkeit.
      </p>
    </Note>
    <Note title="Drag-Zustaende">
      <p>
        Das <code class="text-text-primary">data-state</code>-Attribut auf der Dropzone wechselt
        zwischen
        <code class="text-text-primary">idle</code>,
        <code class="text-text-primary">accept</code> und
        <code class="text-text-primary">reject</code> — fuer CSS-only Styling im
        <code class="text-text-primary">unstyled</code>-Modus. Visuelles Feedback (Farbe, Scale,
        Schatten) signalisiert gueltiges vs. ungueltiges Drag-Material.
      </p>
    </Note>
    <Note title="Document Drop Prevention">
      <p>
        Standardmaessig aktiv via
        <code class="text-text-primary">preventDocumentDrop</code>: Dateien, die ausserhalb der
        Dropzone fallen gelassen werden, oeffnen nicht den Browser. Das schuetzt vor versehentlicher
        Navigation und Datenverlust.
      </p>
    </Note>
  </NoteList>
</Section>
