"use client";

import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

/** An on/off setting that takes effect at once. Name it with `aria-label` or a `<label>`. */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return <SwitchPrimitive.Root data-slot="switch" className={cn("switch", className)} {...props} />;
}

export { Switch };
