import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  ImagePlus,
  LoaderCircle,
  Maximize2,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  attachmentBlob,
  discardAttachment,
  pngForClipboard,
  uploadAttachment,
} from "../attachments";
import {
  fileAccept,
  fileSize,
  isPreviewImage,
  validateFile,
} from "../attachment-files";
import { demoMode } from "../data";
import type { Action } from "../domain";
import type { Attachment } from "../types";
import { ImageLightbox } from "./ui/ImageLightbox";
import { Tooltip } from "./ui/Tooltip";
import type { CardEditSession } from "../card-edit-session";

type Mutation = (action: Action) => Promise<boolean>;
type Upload = {
  id: string;
  file: File;
  progress: number;
  status: "waiting" | "uploading" | "error";
  error?: string;
};
export function AttachmentTile({
  item,
  disabled,
  remove,
  report: reportParent,
}: {
  item: Attachment;
  disabled: boolean;
  remove?: () => Promise<void>;
  report: (message: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const report = (message: string) => {
    setNotice(message);
    reportParent(message);
  };
  const host = useRef<HTMLDivElement>(null);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const blob = useRef<Promise<Blob> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const isImage = isPreviewImage(item.mime_type);
  const getBlob = () => {
    if (!blob.current)
      blob.current = attachmentBlob(item).catch((error) => {
        blob.current = null;
        throw error;
      });
    return blob.current;
  };
  useEffect(() => {
    if (!isImage) return;
    let alive = true;
    let objectUrl = "";
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void getBlob()
        .then((file) => {
          if (!alive) return;
          objectUrl = URL.createObjectURL(file);
          setUrl(objectUrl);
        })
        .catch(() => {
          if (alive) setLoadingError(true);
        });
    });
    if (host.current) observer.observe(host.current);
    return () => {
      alive = false;
      observer.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      clearTimeout(copyTimer.current);
    };
  }, [item.id, isImage]);
  async function download() {
    setWorking(true);
    try {
      // Keep image previews cached, but release potentially large downloads
      // once their temporary download URL is revoked.
      const file = isImage ? await getBlob() : await attachmentBlob(item);
      const link = document.createElement("a");
      const downloadUrl = URL.createObjectURL(file);
      link.href = downloadUrl;
      link.download = item.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      report("Download gestartet.");
    } catch (e) {
      report((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function copy() {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      report(
        "Dein Browser unterstützt Bildkopieren hier nicht. Bitte das Bild herunterladen.",
      );
      return;
    }
    setWorking(true);
    try {
      // Keep write() within the click activation (also needed by Safari).
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": getBlob().then(pngForClipboard) }),
      ]);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
      report("Screenshot kopiert. Mit Strg+V / ⌘V einfügen.");
    } catch {
      report(
        "Kopieren wurde nicht erlaubt oder das Bild ist zu groß. Bitte herunterladen oder die Browser-Berechtigung prüfen.",
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className={`attachment-tile ${isImage ? "is-image" : ""}`} ref={host}>
      {isImage ? (
        <button
          ref={previewTrigger}
          type="button"
          className="attachment-thumbnail"
          disabled={!url || loadingError}
          onClick={() => {
            setNotice("");
            setPreview(true);
          }}
          aria-label={`${item.filename} vergrößern`}
        >
          {url && !loadingError ? (
            <>
              <img
                src={url}
                alt={item.filename}
                loading="lazy"
                onError={() => setLoadingError(true)}
              />
              <span>
                <Maximize2 size={15} /> Vergrößern
              </span>
            </>
          ) : (
            <>
              <ImagePlus size={23} />
              <small>
                {loadingError
                  ? "Vorschau nicht verfügbar"
                  : "Vorschau wird geladen …"}
              </small>
            </>
          )}
        </button>
      ) : (
        <div className="attachment-file-icon">
          <FileText size={24} />
          <span>{item.filename.split(".").at(-1)?.toUpperCase()}</span>
        </div>
      )}
      <div className="attachment-info">
        <strong>{item.filename}</strong>
        <small>
          {fileSize(item.size_bytes)} · {isImage ? "Bild" : "Datei"}
        </small>
      </div>
      <div className="attachment-actions">
        {isImage && (
          <Tooltip content={copied ? "Kopiert!" : "Bild kopieren"}>
            <button
              type="button"
              className={`icon-button ${copied ? "green-text" : ""}`}
              disabled={working}
              aria-label={`${item.filename} kopieren`}
              onClick={() => void copy()}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </Tooltip>
        )}
        <Tooltip content="Herunterladen">
          <button
            type="button"
            className="icon-button"
            disabled={working}
            aria-label={`${item.filename} herunterladen`}
            onClick={() => void download()}
          >
            {working ? (
              <LoaderCircle className="attachment-spin" size={15} />
            ) : (
              <Download size={15} />
            )}
          </button>
        </Tooltip>
        {remove && (
          <Tooltip content="Anhang entfernen">
            <button
              type="button"
              className="icon-button"
              disabled={disabled || working}
              aria-label={`${item.filename} entfernen`}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={15} />
            </button>
          </Tooltip>
        )}
      </div>
      {confirm && remove && (
        <div className="attachment-confirm">
          <span>Datei von der Karte entfernen?</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setConfirm(false)}
          >
            Behalten
          </button>
          <button
            type="button"
            className="danger-text"
            disabled={disabled}
            onClick={() => void remove()}
          >
            Entfernen
          </button>
        </div>
      )}
      {preview && (
        <ImageLightbox
          src={url}
          filename={item.filename}
          copied={copied}
          working={working}
          notice={notice}
          triggerRef={previewTrigger}
          onClose={() => setPreview(false)}
          onCopy={() => void copy()}
          onDownload={() => void download()}
        />
      )}
    </div>
  );
}

export function Attachments({
  cardId,
  actorId,
  items,
  mutate,
  disabled,
  onBusyChange,
  session,
}: {
  cardId: string;
  actorId: string;
  items: Attachment[];
  mutate: Mutation;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  session?: CardEditSession;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const section = useRef<HTMLElement>(null);
  const locked = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const cancelled = useRef(false);
  const alive = useRef(true);
  const ready = items.filter((item) => item.status === "ready");
  const pending = items.filter((item) => item.status === "pending");
  const update = (id: string, patch: Partial<Upload>) =>
    setUploads((all) =>
      all.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  async function enqueue(files: File[], retryId?: string) {
    if (locked.current || disabled || !files.length) return;
    setDragging(false);
    setMessage("");
    if (ready.length + files.length > 20 || files.length > 20) {
      setMessage("Pro Karte sind höchstens 20 Anhänge möglich.");
      return;
    }
    const queue: Upload[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: "waiting",
    }));
    setUploads((old) =>
      [
        ...old.filter((item) => item.id !== retryId).slice(-20 + queue.length),
        ...queue,
      ].slice(-20),
    );
    locked.current = true;
    cancelled.current = false;
    setRunning(true);
    onBusyChange(true);
    const runQueue = async (sessionId?: string) => {
      try {
        for (const item of queue) {
          if ((!alive.current && !session) || cancelled.current) {
            update(item.id, { status: "error", error: "Upload abgebrochen." });
            continue;
          }
          const abort = new AbortController();
          controller.current = abort;
          let uploaded: Attachment | undefined;
          try {
            validateFile(item.file.name, item.file.size);
            update(item.id, { status: "uploading" });
            uploaded = await uploadAttachment(
              cardId,
              actorId,
              item.file,
              abort.signal,
              (progress) => update(item.id, { progress }),
              sessionId,
            );
            if (
              !(await mutate({ type: "attachment.add", attachment: uploaded }))
            )
              throw new Error(
                "Anhang konnte nicht an der Karte gespeichert werden.",
              );
            setUploads((old) => old.filter((u) => u.id !== item.id));
            setMessage(`„${item.file.name}“ hinzugefügt.`);
          } catch (e) {
            if (!alive.current)
              session?.report(`„${item.file.name}“: ${(e as Error).message}`);
            if (uploaded) {
              try {
                await discardAttachment(uploaded);
              } catch {
                /* Tracked by backend cleanup. */
              }
            }
            update(item.id, {
              status: "error",
              error:
                e instanceof DOMException && e.name === "AbortError"
                  ? "Upload abgebrochen."
                  : (e as Error).message,
            });
          }
        }
      } finally {
        locked.current = false;
        controller.current = null;
        if (alive.current) {
          setRunning(false);
          onBusyChange(false);
          if (cancelled.current)
            setMessage(
              "Upload abgebrochen. Bereits gespeicherte Anhänge bleiben erhalten.",
            );
        }
      }
    };
    try {
      if (session) await session.upload(runQueue);
      else await runQueue();
    } catch (error) {
      locked.current = false;
      setRunning(false);
      onBusyChange(false);
      setMessage((error as Error).message);
      session?.report((error as Error).message);
    }
  }
  const enqueueRef = useRef(enqueue);
  enqueueRef.current = enqueue;
  useEffect(() => {
    alive.current = true;
    const inDialog = (target: EventTarget | null) =>
      target instanceof Element &&
      !target.closest(".comments-panel") &&
      target.closest('[role="dialog"]') ===
        section.current?.closest('[role="dialog"]');
    const paste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files.length && inDialog(e.target)) {
        e.preventDefault();
        void enqueueRef.current(Array.from(e.clipboardData.files));
      }
    };
    const drag = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = locked.current ? "none" : "copy";
      setDragging(inDialog(e.target));
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setDragging(false);
      if (inDialog(e.target))
        void enqueueRef.current(Array.from(e.dataTransfer.files));
    };
    document.addEventListener("paste", paste);
    document.addEventListener("dragover", drag);
    document.addEventListener("dragleave", leave);
    document.addEventListener("drop", drop);
    return () => {
      alive.current = false;
      if (!session) {
        cancelled.current = true;
        controller.current?.abort();
      }
      document.removeEventListener("paste", paste);
      document.removeEventListener("dragover", drag);
      document.removeEventListener("dragleave", leave);
      document.removeEventListener("drop", drop);
    };
  }, [cardId]);
  async function remove(id: string) {
    if (locked.current || disabled) return;
    locked.current = true;
    setRunning(true);
    onBusyChange(true);
    try {
      if (await mutate({ type: "attachment.delete", id }))
        setMessage("Anhang entfernt.");
      else setMessage("Entfernen fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      locked.current = false;
      setRunning(false);
      onBusyChange(false);
    }
  }
  return (
    <section className="attachments" ref={section} aria-label="Anhänge">
      <div className="attachment-heading">
        <h3>
          <Paperclip size={16} /> Anhänge <span>{ready.length}</span>
        </h3>
        <span>{ready.length}/20</span>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept={fileAccept}
        className="attachment-file-input"
        tabIndex={-1}
        aria-label="Dateien auswählen"
        onChange={(e) => {
          void enqueue(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={`attachment-dropzone ${dragging ? "is-dragging" : ""}`}
        disabled={running || disabled || ready.length >= 20}
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
      {!!uploads.length && (
        <div className="attachment-uploads" aria-label="Uploads">
          {uploads.map((item) => (
            <div
              key={item.id}
              className={`attachment-upload ${item.status === "error" ? "has-error" : ""}`}
            >
              <div>
                <FileText size={17} />
                <strong>{item.file.name}</strong>
                <small>
                  {item.status === "uploading"
                    ? item.progress >= 99
                      ? "Wird geprüft …"
                      : `${item.progress} %`
                    : item.status === "waiting"
                      ? "Wartet …"
                      : "Nicht hochgeladen"}
                </small>
                {item.status === "error" && (
                  <>
                    <Tooltip content="Erneut versuchen">
                      <button
                        type="button"
                        className="icon-button"
                        disabled={running}
                        aria-label={`${item.file.name} erneut hochladen`}
                        onClick={() => void enqueue([item.file], item.id)}
                      >
                        <RotateCcw size={14} />
                      </button>
                    </Tooltip>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={running}
                      aria-label={`${item.file.name} verwerfen`}
                      onClick={() =>
                        setUploads((old) => old.filter((u) => u.id !== item.id))
                      }
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
              {item.error ? (
                <p role="alert">{item.error}</p>
              ) : (
                <progress
                  max={100}
                  value={item.progress}
                  aria-label={`Upload ${item.file.name}`}
                />
              )}
            </div>
          ))}
          {running && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                cancelled.current = true;
                controller.current?.abort();
                setMessage("Upload wird abgebrochen und aufgeräumt …");
              }}
            >
              Uploads abbrechen
            </button>
          )}
        </div>
      )}
      {!!ready.length && (
        <div className="attachment-grid">
          {ready.map((item) => (
            <AttachmentTile
              key={item.id}
              item={item}
              disabled={running || disabled}
              remove={() => remove(item.id)}
              report={setMessage}
            />
          ))}
        </div>
      )}
      {!!pending.length && (
        <div className="attachment-pending">
          {pending.map((item) => (
            <div key={item.id}>
              <span>
                {item.filename} ·{" "}
                {item.status === "deleting"
                  ? "Entfernen wiederholen"
                  : "Upload noch nicht abgeschlossen"}
              </span>
              <button
                type="button"
                className="text-button"
                disabled={running || disabled}
                onClick={() => void remove(item.id)}
              >
                Verwerfen
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="attachment-message" role="status" aria-live="polite">
        {message}
      </p>
      <p className="attachment-security">
        <ShieldCheck size={12} />
        {demoMode
          ? "Demo: Dateien bleiben in diesem Browser."
          : "Nur für freigeschaltete Workspace-Mitglieder. Keine öffentlichen Dateilinks."}
      </p>
    </section>
  );
}
