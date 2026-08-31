import { useId, useState } from "react";
import type { Attachment } from "../types";
import { isPreviewImage } from "../attachment-files";
import { AttachmentTile } from "./Attachments";

export function CommentAttachments({ items }: { items: Attachment[] }) {
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const id = useId();
  if (!items.length) return null;
  const images = items.filter((a) => isPreviewImage(a.mime_type));
  const files = items.filter((a) => !isPreviewImage(a.mime_type));
  const tabs = [
    { key: "all", label: "Alle", items: [...images, ...files] },
    { key: "images", label: "Bilder", items: images },
    { key: "files", label: "Dateien", items: files },
  ];
  const selected = tabs.find((tab) => tab.key === filter)!;
  return (
    <div className="comment-attachments">
      {items.length > 1 && (
        <div
          className="comment-file-tabs"
          role="tablist"
          aria-label="Nachrichtenanhänge"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.key}
              id={`${id}-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={filter === tab.key}
              aria-controls={`${id}-files`}
              tabIndex={filter === tab.key ? 0 : -1}
              onClick={() => setFilter(tab.key)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % 3
                    : event.key === "ArrowLeft"
                      ? (index + 2) % 3
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : -1;
                if (next < 0) return;
                event.preventDefault();
                setFilter(tabs[next].key);
                (
                  event.currentTarget.parentElement?.children[
                    next
                  ] as HTMLButtonElement
                )?.focus();
              }}
            >
              {tab.label} <span>{tab.items.length}</span>
            </button>
          ))}
        </div>
      )}
      <div
        id={`${id}-files`}
        role={items.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={items.length > 1 ? `${id}-${filter}` : undefined}
        className="comment-file-gallery"
      >
        {selected.items.map((item) => (
          <AttachmentTile
            key={item.id}
            item={item}
            disabled={false}
            report={setNotice}
          />
        ))}
        {!selected.items.length && (
          <span className="comment-files-empty">
            Keine {selected.label} in dieser Nachricht.
          </span>
        )}
      </div>
      {notice && (
        <span className="comment-file-notice" role="status">
          {notice}
        </span>
      )}
    </div>
  );
}
