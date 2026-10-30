import { validateFile } from "./attachment-files";
import type { Action } from "./domain";
import type { Attachment } from "./types";

export type CardDraftFile = { id: string; file: File };
type CreateAction = Extract<Action, { type: "card.create" }>;
type Upload = (
  cardId: string,
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
) => Promise<Attachment>;

export function appendCardDraftFiles(
  current: CardDraftFile[],
  incoming: File[],
): CardDraftFile[] {
  if (current.length + incoming.length > 20)
    throw new Error("Pro Karte sind höchstens 20 Anhänge möglich.");
  incoming.forEach((file) => validateFile(file.name, file.size));
  return [
    ...current,
    ...incoming.map((file) => ({ id: crypto.randomUUID(), file })),
  ];
}

// Files stay local until the user submits. Retain the accepted card and uploaded
// receipts across retries, including a failed refresh after upload completion.
export class CardCreationDraft {
  readonly id = crypto.randomUUID();
  created = false;
  readonly saved = new Set<string>();
  private uploaded = new Map<string, Attachment>();
  private running = false;

  hasUpload(id: string) {
    return this.uploaded.has(id);
  }

  async save(
    action: Omit<CreateAction, "id">,
    files: CardDraftFile[],
    {
      mutate,
      upload,
      signal,
      progress,
      saved,
    }: {
      mutate: (action: Action) => Promise<boolean>;
      upload: Upload;
      signal: AbortSignal;
      progress: (label: string, percent: number) => void;
      saved: () => void;
    },
  ): Promise<boolean> {
    if (this.running) return false;
    this.running = true;
    try {
      signal.throwIfAborted();
      if (!this.created) {
        if (!(await mutate({ ...action, id: this.id }))) return false;
        this.created = true;
      }
      for (const [index, item] of files.entries()) {
        signal.throwIfAborted();
        if (this.saved.has(item.id)) continue;
        let attachment = this.uploaded.get(item.id);
        if (!attachment) {
          attachment = await upload(this.id, item.file, signal, (value) =>
            progress(
              `Datei ${index + 1}/${files.length} · ${item.file.name}`,
              value,
            ),
          );
          this.uploaded.set(item.id, attachment);
        }
        signal.throwIfAborted();
        if (!(await mutate({ type: "attachment.add", attachment })))
          throw new Error(
            `„${item.file.name}“ konnte noch nicht bestätigt werden.`,
          );
        this.saved.add(item.id);
        saved();
      }
      return true;
    } finally {
      this.running = false;
    }
  }
}
