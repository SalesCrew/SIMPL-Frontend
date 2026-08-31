import { Upload, DetailedError } from "tus-js-client";
import type { Attachment } from "./types";

export const UPLOAD_CHUNK_SIZE = 6 * 1024 * 1024;
export function storageUploadEndpoint(supabaseUrl: string) {
  const url = new URL(supabaseUrl);
  if (
    url.hostname.endsWith(".supabase.co") &&
    !url.hostname.endsWith(".storage.supabase.co")
  )
    url.hostname = url.hostname.replace(
      /\.supabase\.co$/,
      ".storage.supabase.co",
    );
  return `${url.origin}/storage/v1/upload/resumable`;
}

export function uploadResumable({
  item,
  file,
  signal,
  progress,
  supabaseUrl,
  publishableKey,
  accessToken,
}: {
  item: Attachment;
  file: File;
  signal: AbortSignal;
  progress: (percent: number) => void;
  supabaseUrl: string;
  publishableKey: string;
  accessToken: () => Promise<string>;
}) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    const upload = new Upload(file, {
      endpoint: storageUploadEndpoint(supabaseUrl),
      chunkSize: UPLOAD_CHUNK_SIZE,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      headers: { apikey: publishableKey, "x-upsert": "false" },
      metadata: {
        bucketName: "card-attachments",
        objectName: item.object_path,
        contentType: item.mime_type,
        cacheControl: "no-store",
      },
      onBeforeRequest: async (request) => {
        signal.throwIfAborted();
        request.setHeader("Authorization", `Bearer ${await accessToken()}`);
        signal.throwIfAborted();
      },
      onShouldRetry: (error) => {
        const status = error.originalResponse?.getStatus() || 0;
        return (
          !signal.aborted &&
          (status === 0 ||
            status === 408 ||
            status === 409 ||
            status === 423 ||
            status === 429 ||
            status >= 500)
        );
      },
      onProgress: (sent, total) => {
        if (!settled) progress(Math.min(99, Math.round((sent / total) * 100)));
      },
      onSuccess: () => finish(),
      onError: (error) => {
        // Avoid surfacing authenticated request headers/URLs from TUS errors.
        const status =
          error instanceof DetailedError
            ? error.originalResponse?.getStatus()
            : undefined;
        finish(
          new Error(
            status === 413
              ? "Die Datei überschreitet das Storage-Limit."
              : status === 401 || status === 403
                ? "Upload nicht erlaubt. Bitte Anmeldung und Workspace-Zugriff prüfen."
                : "Upload unterbrochen. Bitte die Verbindung prüfen und erneut versuchen.",
          ),
        );
      },
    });
    const abort = () => {
      // Metadata/object cleanup is done by the existing authenticated API.
      void upload.abort().catch(() => {});
      finish(new DOMException("Upload abgebrochen.", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else upload.start();
  });
}
