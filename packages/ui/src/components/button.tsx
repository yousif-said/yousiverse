import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

/** The looks are the `.btn` and `.iconbtn` classes of the design system (styles/design.css). */
const buttonVariants = cva("", {
  variants: {
    variant: {
      default: "btn--primary",
      tone: "btn--tone",
      secondary: "btn--soft",
      outline: "btn--soft",
      ghost: "btn--ghost",
      destructive: "btn--soft btn--danger",
      link: "btn--link",
    },
    size: {
      default: "btn",
      xs: "btn btn--sm",
      sm: "btn btn--sm",
      lg: "btn btn--lg",
      icon: "iconbtn",
      "icon-xs": "iconbtn iconbtn--sm",
      "icon-sm": "iconbtn iconbtn--sm",
      "icon-lg": "iconbtn",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
