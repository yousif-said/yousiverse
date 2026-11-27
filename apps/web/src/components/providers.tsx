"use client";

import { ThemeProvider } from "next-themes";
import { TRPCReactProvider } from "@/trpc/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // Night is the default look: artwork reads best on it. Day is one click away in the menu.
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </ThemeProvider>
  );
}
