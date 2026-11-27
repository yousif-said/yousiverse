"use client";

import { toast } from "@/components/ui/toast";

type Props = {
  /** The page to share, as a path on this site: "/lists/123". */
  path: string;
  children: React.ReactNode;
};

/** Copies a page's full address, ready to send to someone. */
export function CopyLinkButton({ path, children }: Props) {
  async function copy() {
    const link = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied");
    } catch {
      // The browser can refuse the clipboard; the link is shown so it can be copied by hand.
      toast(`Copy this link: ${link}`);
    }
  }

  return (
    <button type="button" className="btn btn--soft" onClick={copy}>
      {children}
    </button>
  );
}
