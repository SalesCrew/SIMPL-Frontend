import { apiRequest, demoMode, supabase } from "./data";
import { validateFile } from "./attachment-files";
import type { Attachment } from "./types";
const bucket = "card-attachments";

async function blobs<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("trello-plus.files.v1", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onerror = () =>
      reject(new Error("Der lokale Dateispeicher ist nicht verfügbar."));
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("files", mode);
      const request = operation(transaction.objectStore("files"));
      transaction.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      transaction.onerror = () => {
        db.close();
        reject(
          transaction.error ||
            new Error("Datei konnte nicht lokal gespeichert werden."),
        );
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error || new Error("Dateispeicherung abgebrochen."));
      };
    };
  });
}
export const removeLocalBlob = (id: string) =>
  blobs("readwrite", (store) => store.delete(id));
export async function attachmentBlob(item: Attachment): Promise<Blob> {
  if (demoMode) {
    const blob = await blobs<Blob | undefined>("readonly", (store) =>
      store.get(item.id),
    );
    if (!blob)
      throw new Error(
        "Diese Demo-Datei ist auf diesem Gerät nicht mehr gespeichert.",
      );
    return blob;
  }
  const session = (await supabase!.auth.getSession()).data.session;
  if (!session) throw new Error("Bitte erneut anmelden.");
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || ""}/api/attachments/${encodeURIComponent(item.id)}/download`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15 * 60 * 1000),
    },
  );
  if (!response.ok)
    throw new Error(
      "Datei nicht verfügbar. Bitte Anmeldung und Verbindung prüfen.",
    );
  return response.blob();
}
function uploadBytes(
  item: Attachment,
  file: File,
  token: string,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    xhr.open(
      "POST",
      `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${item.object_path}`,
    );
    xhr.timeout = 120000;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader(
      "apikey",
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
    xhr.setRequestHeader("Content-Type", item.mime_type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Cache-Control", "no-store");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        progress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () =>
      finish(
        xhr.status >= 200 && xhr.status < 300
          ? undefined
          : new Error("Upload fehlgeschlagen. Bitte erneut versuchen."),
      );
    xhr.onerror = xhr.ontimeout = () =>
      finish(new Error("Verbindung unterbrochen. Bitte erneut versuchen."));
    xhr.onabort = () =>
      finish(new DOMException("Upload abgebrochen.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      finish(new DOMException("Upload abgebrochen.", "AbortError"));
      return;
    }
    xhr.send(file);
  });
}
export async function uploadAttachment(
  cardId: string,
  actorId: string,
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
  editSessionId?: string,
  commentDraftId?: string,
): Promise<Attachment> {
  const mime = validateFile(file.name, file.size);
  signal.throwIfAborted();
  if (demoMode) {
    const id = crypto.randomUUID();
    const item: Attachment = {
      id,
      card_id: cardId,
      comment_draft_id: commentDraftId || null,
      uploaded_by: actorId,
      filename: file.name,
      size_bytes: file.size,
      mime_type: mime,
      object_path: `${cardId}/${id}`,
      status: "ready",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    await blobs("readwrite", (store) =>
      store.put(new Blob([file], { type: mime }), id),
    );
    if (signal.aborted) {
      await removeLocalBlob(id);
      signal.throwIfAborted();
    }
    progress(100);
    return item;
  }
  const item: Attachment = await apiRequest("/attachments", "POST", {
    card_id: cardId,
    filename: file.name,
    size_bytes: file.size,
    ...(editSessionId ? { edit_session_id: editSessionId } : {}),
    ...(commentDraftId ? { comment_draft_id: commentDraftId } : {}),
  });
  try {
    signal.throwIfAborted();
    const session = (await supabase!.auth.getSession()).data.session;
    if (!session) throw new Error("Bitte erneut anmelden.");
    if (file.size > 6 * 1024 * 1024) {
      const { uploadResumable } = await import("./resumable-upload");
      await uploadResumable({
        item,
        file,
        signal,
        progress,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        accessToken: async () => {
          const current = (await supabase!.auth.getSession()).data.session;
          if (!current || current.user.id !== actorId)
            throw new Error("Bitte erneut anmelden.");
          return current.access_token;
        },
      });
    } else
      await uploadBytes(item, file, session.access_token, signal, progress);
    signal.throwIfAborted();
    const ready: Attachment = await apiRequest(
      `/attachments/${item.id}/complete`,
      "POST",
    );
    signal.throwIfAborted();
    progress(100);
    return ready;
  } catch (error) {
    try {
      await apiRequest(`/attachments/${item.id}`, "DELETE");
    } catch {
      /* Reservation remains tracked for the cleanup sweep. */
    }
    throw error;
  }
}
export async function discardAttachment(item: Attachment, draftOnly = false) {
  if (demoMode) await removeLocalBlob(item.id);
  else
    await apiRequest(
      `/attachments/${item.id}${draftOnly ? "?draft=1" : ""}`,
      "DELETE",
    );
}
export async function pngForClipboard(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > 25_000_000)
      throw new Error(
        "Dieses Bild ist zum Kopieren zu groß. Bitte herunterladen.",
      );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Bild konnte nicht kopiert werden.");
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("Bild konnte nicht kopiert werden.")),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}
