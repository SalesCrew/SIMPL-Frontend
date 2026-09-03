import { CheckCheck, CircleX } from "lucide-react";
import { nextReadFilter, type ReadFilter } from "../read-filter";
import { Tooltip } from "./ui/Tooltip";

const stateCopy: Record<ReadFilter, { current: string; next: string }> = {
  "": {
    current: "Gelesen und ungelesen",
    next: "Nur ungelesene Karten anzeigen",
  },
  unread: {
    current: "Nur ungelesene Karten",
    next: "Nur gelesene Karten anzeigen",
  },
  read: {
    current: "Nur gelesene Karten",
    next: "Gelesene und ungelesene Karten anzeigen",
  },
};

export function ReadFilterButton({
  value,
  onValueChange,
}: {
  value: ReadFilter;
  onValueChange: (value: ReadFilter) => void;
}) {
  const copy = stateCopy[value];
  return (
    <Tooltip content={copy.current}>
      <button
        type="button"
        className={`read-filter-control is-${value || "all"}`}
        aria-label={`${copy.current}. ${copy.next}`}
        data-filter-state={value || "all"}
        onClick={() => onValueChange(nextReadFilter(value))}
      >
        {value === "" ? <CircleX size={16} /> : <CheckCheck size={17} />}
      </button>
    </Tooltip>
  );
}
