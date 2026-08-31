import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

export type TooltipContentProps = Pick<ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>, "onPointerEnter" | "onPointerLeave"> & {
  [key: `data-${string}`]: string | undefined;
};

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={150}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  content,
  children,
  contentProps,
}: {
  content: string;
  children: ReactElement;
  contentProps?: TooltipContentProps;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          {...contentProps}
          className="workspace-tooltip"
          sideOffset={7}
          collisionPadding={10}
        >
          {content}
          <TooltipPrimitive.Arrow
            className="tooltip-arrow"
            width={10}
            height={5}
          />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
