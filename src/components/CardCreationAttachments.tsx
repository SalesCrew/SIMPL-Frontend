import { useEffect, useRef, useState } from "react";
import { Check, FileText, Paperclip, UploadCloud, X } from "lucide-react";
import {
  appendCardDraftFiles,
  type CardDraftFile,
} from "../card-creation-draft";
import {
  fileAccept,
  fileSize,
  isPreviewImage,
  validateFile,
} from "../attachment-files";

function DraftFile({
  item,
  saved,
  disabled,
  remove,
}: {
  item: CardDraftFile;
  saved: boolean;
  disabled: boolean;
  remove: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!isPreviewImage(validateFile(item.file.name, item.file.size))) return;
    const objectUrl = URL.createObjectURL(item.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [item.file]);
  return (
    <div className="comment-draft-file">
      {url ? <img src={url} alt="" /> : <FileText size={20} />}
      <span>
        <strong>{item.file.name}</strong>
        <small>
          {fileSize(item.file.size)}
          {saved ? " · Gespeichert" : ""}
        </small>
      </span>
      {saved ? (
        <Check size={16} aria-label="Gespeichert" />
      ) : (
        <button
          type="button"
          className="icon-button"
          aria-label={`${item.file.name} aus Anhängen entfernen`}
          disabled={disabled}
          onClick={remove}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function CardCreationAttachments({
  files,
  onChange,
  disabled,
  saved,
  hasUpload,
}: {
  files: CardDraftFile[];
  onChange: (files: CardDraftFile[]) => void;
  disabled: boolean;
  saved: ReadonlySet<string>;
  hasUpload: (id: string) => boolean;
}) {
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const section = useRef<HTMLElement>(null);
  // Events can arrive back-to-back before React commits the selected files.
  const currentFiles = useRef(files);
  currentFiles.current = files;
  const addFiles = (incoming: File[]) => {
    if (disabled || !incoming.length) return;
    setDragging(false);
    try {
      const next = appendCardDraftFiles(currentFiles.current, incoming);
      currentFiles.current = next;
      onChange(next);
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  const add = useRef(addFiles);
  add.current = addFiles;
  useEffect(() => {
    const inDialog = (target: EventTarget | null) =>
      target instanceof Element &&
      target.closest('[role="dialog"]') ===
        section.current?.closest('[role="dialog"]');
    const paste = (event: ClipboardEvent) => {
      if (
        !event.defaultPrevented &&
        event.clipboardData?.files.length &&
        inDialog(event.target)
      ) {
        event.preventDefault();
        add.current(Array.from(event.clipboardData.files));
      }
    };
    const drag = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      setDragging(inDialog(event.target));
    };
    const leave = (event: DragEvent) => {
      if (!event.relatedTarget) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      setDragging(false);
      if (inDialog(event.target))
        add.current(Array.from(event.dataTransfer.files));
    };
    document.addEventListener("paste", paste);
    document.addEventListener("dragover", drag);
    document.addEventListener("dragleave", leave);
    document.addEventListener("drop", drop);
    return () => {
      document.removeEventListener("paste", paste);
      document.removeEventListener("dragover", drag);
      document.removeEventListener("dragleave", leave);
      document.removeEventListener("drop", drop);
    };
  }, []);
  return (
    <section className="attachments" ref={section} aria-label="Anhänge">
      <div className="attachment-heading">
        <h3>
          <Paperclip size={16} /> Anhänge <span>{files.length}</span>
        </h3>
        <span>{files.length}/20</span>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept={fileAccept}
        className="attachment-file-input"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Dateien auswählen"
        onChange={(event) => {
          addFiles(Array.from(event.target.files || []));
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className={`attachment-dropzone ${dragging ? "is-dragging" : ""}`}
        disabled={disabled || files.length >= 20}
        onClick={() => input.current?.click()}
      >
        <span className="attachment-upload-icon">
          <UploadCloud size={21} />
        </span>
        <strong>
          {dragging
            ? "Hier loslassen. Den Rest machen wir."
            : "Dateien hierher ziehen oder auswählen"}
        </strong>
        <span>Screenshots einfach mit Strg+V / ⌘V einfügen</span>
        <small>Alle Dateitypen · max. 500 MB pro Datei</small>
      </button>
      {!!files.length && (
        <div className="attachment-uploads" aria-label="Ausgewählte Anhänge">
          {files.map((item) => (
            <DraftFile
              key={item.id}
              item={item}
              saved={saved.has(item.id)}
              disabled={disabled || hasUpload(item.id)}
              remove={() => {
                const next = files.filter((file) => file.id !== item.id);
                currentFiles.current = next;
                onChange(next);
              }}
            />
          ))}
        </div>
      )}
      {message && (
        <p className="attachment-message" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
