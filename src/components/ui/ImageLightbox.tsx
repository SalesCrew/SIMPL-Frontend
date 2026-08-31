import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Copy, Download, X } from "lucide-react";
import type { RefObject } from "react";

export function ImageLightbox({
  src,
  filename,
  copied,
  working,
  notice,
  triggerRef,
  onClose,
  onCopy,
  onDownload,
}: {
  src: string;
  filename: string;
  copied: boolean;
  working: boolean;
  notice: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="image-lightbox-backdrop" />
        <DialogPrimitive.Content
          className="image-lightbox"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="image-lightbox-title">
            {filename}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="image-lightbox-close"
            aria-label="Bildvorschau schließen"
          >
            <X size={20} />
          </DialogPrimitive.Close>
          <img src={src} alt={filename} className="image-lightbox-image" />
          <div className="image-lightbox-actions">
            <button type="button" disabled={working} onClick={onDownload}>
              <Download size={16} /> Herunterladen
            </button>
            <button type="button" disabled={working} onClick={onCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Kopiert!" : "Bild kopieren"}
            </button>
          </div>
          <p className="image-lightbox-notice" role="status" aria-live="polite">
            {notice}
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
