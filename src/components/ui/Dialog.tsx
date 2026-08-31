import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
  preventClose = false,
  closeOnOutside = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  preventClose?: boolean;
  closeOnOutside?: boolean;
}) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open && !preventClose) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-overlay" />
        <DialogPrimitive.Content
          className={`modal ${wide ? "wide" : ""}`}
          onPointerDownOutside={(event) => {
            if (!closeOnOutside || preventClose) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (preventClose) event.preventDefault();
          }}
        >
          <header className="modal-heading">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                {description ||
                  "Details bearbeiten und gemeinsam weiterarbeiten."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="icon-button"
              aria-label="Schließen"
              disabled={preventClose}
            >
              <X size={19} />
            </DialogPrimitive.Close>
          </header>
          <div className="modal-body">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
