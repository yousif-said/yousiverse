"use client";

import { cn } from "cn";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type * as React from "react";

const DropdownMenu = MenuPrimitive.Root;
const DropdownMenuTrigger = MenuPrimitive.Trigger;
const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="menu"
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn("menu", className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuItem(props: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return <MenuPrimitive.Item {...props} />;
}

function DropdownMenuRadioItem(props: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return <MenuPrimitive.RadioItem {...props} />;
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("label menu__label", className)} {...props} />;
}

function DropdownMenuSeparator() {
  return (
    <MenuPrimitive.Separator asChild>
      <hr />
    </MenuPrimitive.Separator>
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
