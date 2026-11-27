import { Toaster } from "@/components/ui/toast";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";
import { SiteFooter } from "./site-footer";
import { TabBar } from "./tab-bar";
import { getViewer } from "./viewer";

/**
 * What surrounds every page: the sidebar (a bar along the bottom on a phone), the content
 * area, the provider credits, and toasts. The front door hides all of it but the content.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <Sidebar viewer={viewer} />
      <main id="main" className="main" tabIndex={-1}>
        {children}
        <SiteFooter />
      </main>
      <TabBar viewer={viewer} />
      <CommandPalette signedIn={viewer !== null} />
      <Toaster />
    </>
  );
}
