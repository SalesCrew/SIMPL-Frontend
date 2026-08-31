import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { FileText, LoaderCircle, Paperclip, Send, X } from "lucide-react";
import { discardAttachment, uploadAttachment } from "../attachments";
import { fileSize, isPreviewImage, validateFile } from "../attachment-files";
import type { CardEditSession } from "../card-edit-session";
import type { Action } from "../domain";
import type { Attachment } from "../types";
import { handleCommentKeyDown } from "./comment-keyboard";
import { Tooltip } from "./ui/Tooltip";

type DraftFile = { id: string; file: File };
function DraftTile({
  item,
  disabled,
  remove,
}: {
  item: DraftFile;
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
        <small>{fileSize(item.file.size)}</small>
      </span>
      <button
        type="button"
        className="icon-button"
        aria-label={`${item.file.name} aus Nachricht entfernen`}
        disabled={disabled}
        onClick={remove}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function CommentComposer({
  cardId,
  actorId,
  disabled,
  mutate,
  session,
  onBusyChange,
}: {
  cardId: string;
  actorId: string;
  disabled: boolean;
  mutate: (action: Action) => Promise<boolean>;
  session?: CardEditSession;
  onBusyChange: (busy: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const draftId = useRef(crypto.randomUUID());
  const uploaded = useRef(new Map<string, Attachment>());
  const locked = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const fit = useCallback(() => {
    const field = textarea.current;
    if (!field) return;
    const previous = field.scrollTop;
    const atEnd =
      document.activeElement === field &&
      field.selectionEnd === field.value.length;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
    field.scrollTop = atEnd ? field.scrollHeight : previous;
  }, []);
  const attachInput = useCallback(
    (field: HTMLTextAreaElement | null) => {
      textarea.current = field;
      if (!field) return;
      fit();
      let width = field.clientWidth;
      const observer = new ResizeObserver(() => {
        if (width !== field.clientWidth) {
          width = field.clientWidth;
          fit();
        }
      });
      observer.observe(field);
      return () => observer.disconnect();
    },
    [fit],
  );
  useLayoutEffect(fit, [text, fit]);
  async function discardDraft() {
    const pending = [...uploaded.current.values()];
    uploaded.current.clear();
    await Promise.allSettled(
      pending.map((item) => discardAttachment(item, true)),
    );
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (!locked.current) void discardDraft();
      else if (!session) controller.current?.abort();
    };
  }, [cardId, session]);

  function addFiles(incoming: File[]) {
    if (locked.current || disabled) return;
    setDragging(false);
    setError("");
    if (files.length + incoming.length > 10) {
      setError("Maximal 10 Dateien pro Nachricht.");
      return;
    }
    try {
      incoming.forEach((file) => validateFile(file.name, file.size));
      setFiles((old) => [
        ...old,
        ...incoming.map((file) => ({ id: crypto.randomUUID(), file })),
      ]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (locked.current || disabled || (!text.trim() && !files.length)) return;
    locked.current = true;
    setSending(true);
    setError("");
    onBusyChange(true);
    const submittedText = text;
    const submittedFiles = files;
    const abort = new AbortController();
    controller.current = abort;
    const run = async () => {
      try {
        const attachments: Attachment[] = [];
        for (const [index, item] of submittedFiles.entries()) {
          let ready = uploaded.current.get(item.id);
          if (!ready) {
            ready = await uploadAttachment(
              cardId,
              actorId,
              item.file,
              abort.signal,
              (value) => {
                if (alive.current)
                  setProgress(
                    `Datei ${index + 1}/${submittedFiles.length} · ${value} %`,
                  );
              },
              undefined,
              draftId.current,
            );
            uploaded.current.set(item.id, ready);
          }
          attachments.push(ready);
        }
        if (
          !(await mutate({
            type: "comment.create",
            card_id: cardId,
            body: submittedText,
            attachments,
          }))
        )
          throw new Error(
            "Nachricht nicht gesendet. Text und Dateien bleiben für einen erneuten Versuch erhalten.",
          );
        uploaded.current.clear();
        draftId.current = crypto.randomUUID();
        if (alive.current) {
          setText((draft) => (draft === submittedText ? "" : draft));
          setFiles([]);
          textarea.current?.focus({ preventScroll: true });
        }
      } catch (e) {
        if (alive.current) setError((e as Error).message);
        else session?.report((e as Error).message);
      } finally {
        if (!alive.current) await discardDraft();
      }
    };
    try {
      if (session) await session.upload(run);
      else await run();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      locked.current = false;
      controller.current = null;
      if (alive.current) {
        setSending(false);
        setProgress("");
        onBusyChange(false);
      }
    }
  }
  return (
    <form
      className={`comment-composer${dragging ? " is-dragging" : ""}`}
      onSubmit={send}
      aria-busy={sending}
      onPaste={(event) => {
        if (!event.clipboardData.files.length) return;
        event.preventDefault();
        event.stopPropagation();
        addFiles(Array.from(event.clipboardData.files));
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = sending || disabled ? "none" : "copy";
        setDragging(!sending && !disabled);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        className="attachment-file-input"
        tabIndex={-1}
        aria-label="Dateien an Nachricht anhängen"
        disabled={sending || disabled}
        onChange={(event) => {
          addFiles(Array.from(event.target.files || []));
          event.target.value = "";
        }}
      />
      {!!files.length && (
        <div className="comment-draft-files" aria-label="Anhänge der Nachricht">
          {files.map((item) => (
            <DraftTile
              key={item.id}
              item={item}
              disabled={sending}
              remove={() => {
                const stored = uploaded.current.get(item.id);
                if (stored) {
                  uploaded.current.delete(item.id);
                  void discardAttachment(stored, true).catch(() => {});
                }
                setFiles((old) => old.filter((file) => file.id !== item.id));
              }}
            />
          ))}
        </div>
      )}
      <textarea
        ref={attachInput}
        aria-label="Kommentar schreiben"
        placeholder={dragging ? "Dateien hier loslassen …" : "Dein Kommentar …"}
        maxLength={5000}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleCommentKeyDown}
        aria-description="Enter zum Senden, Shift+Enter für eine neue Zeile. Dateien einfügen oder hierher ziehen."
        rows={1}
      />
      <div className="comment-composer-toolbar">
        <Tooltip content="Dateien anhängen · max. 500 MB">
          <button
            type="button"
            className="icon-button"
            aria-label="Dateien anhängen"
            disabled={sending || disabled || files.length >= 10}
            onClick={() => input.current?.click()}
          >
            <Paperclip size={17} />
          </button>
        </Tooltip>
        <small role="status">
          {progress ||
            (files.length
              ? `${files.length}/10 · max. 500 MB je Datei`
              : "Für das Team sichtbar")}
        </small>
        <button
          className="primary"
          aria-label="Kommentar senden"
          disabled={sending || disabled || (!text.trim() && !files.length)}
        >
          {sending ? (
            <LoaderCircle size={14} className="attachment-spin" />
          ) : (
            <Send size={14} />
          )}
        </button>
      </div>
      {error && (
        <div className="comment-send-error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
