export const MAX_FILE_SIZE = 500 * 1024 * 1024;
export const MAX_PREVIEW_SIZE = 20 * 1024 * 1024;
export const fileTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  zip: "application/zip",
};
// Every file can be shared. Only known raster formats receive inline previews;
// everything else is downloaded, never interpreted as HTML or executable code.
export const fileAccept = "";
export const isPreviewImage = (mime: string) =>
  ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime);
export function validateFile(filename: string, size: number) {
  const extension = filename.split(".").at(-1)?.toLowerCase() || "";
  if (
    !filename.trim() ||
    filename.length > 180 ||
    /[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/.test(filename)
  )
    throw new Error(
      "Bitte einen einfachen Dateinamen mit höchstens 180 Zeichen verwenden.",
    );
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_SIZE)
    throw new Error("Eine Datei muss zwischen 1 Byte und 500 MB groß sein.");
  // Large files stay opaque downloads: never decode huge images in the UI or
  // buffer hundreds of MB in the API merely to finalize an upload.
  if (size > MAX_PREVIEW_SIZE) return "application/octet-stream";
  return Object.hasOwn(fileTypes, extension)
    ? fileTypes[extension]
    : "application/octet-stream";
}
export function fileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString("de-AT", { maximumFractionDigits: 1 })} MB`;
}
