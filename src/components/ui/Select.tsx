import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  description?: string;
  disabled?: boolean;
}

// Prefix every value so an empty-string filter is a real, selectable option.
// Radix reserves its own empty value for the unselected placeholder state.
const encode = (value: string) => `option:${value}`;

export function Select<T extends string = string>({
  value,
  onValueChange,
  options,
  label,
  disabled = false,
  variant = "field",
  icon,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  label: string;
  disabled?: boolean;
  variant?: "field" | "toolbar" | "filter";
  icon?: ReactNode;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <SelectPrimitive.Root
      value={selected ? encode(value) : ""}
      onValueChange={(next) => onValueChange(next.slice(7) as T)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={`select-trigger select-${variant}`}
        aria-label={label}
      >
        {(selected?.icon || icon) && (
          <span className="select-leading" aria-hidden="true">
            {selected?.icon || icon}
          </span>
        )}
        <span className="select-value">
          <SelectPrimitive.Value placeholder="Bitte wählen" />
        </span>
        <SelectPrimitive.Icon className="select-chevron">
          <ChevronDown size={14} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={`select-popover select-popover-${variant}`}
          position="popper"
          sideOffset={7}
          collisionPadding={12}
          align="start"
        >
          <SelectPrimitive.ScrollUpButton className="select-scroll">
            <ChevronUp size={14} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="select-viewport">
            <SelectPrimitive.Group>
              <SelectPrimitive.Label className="select-caption">
                {label}
              </SelectPrimitive.Label>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={encode(option.value)}
                  disabled={option.disabled}
                  textValue={option.label}
                  className="select-option"
                >
                  {option.icon && (
                    <span className="select-leading" aria-hidden="true">
                      {option.icon}
                    </span>
                  )}
                  <span className="select-option-copy">
                    <SelectPrimitive.ItemText>
                      {option.label}
                    </SelectPrimitive.ItemText>
                    {option.description && <small>{option.description}</small>}
                  </span>
                  <SelectPrimitive.ItemIndicator className="select-check">
                    <Check size={14} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Group>
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll">
            <ChevronDown size={14} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
