import { PageHeader } from "@/components/ui/page-header";

/** The top of both import pages: starting an import, and watching one run. */
export function ImportHeader() {
  return (
    <PageHeader
      title="Import"
      lede="Bring your history with you. An import never changes anything you already have here: a status, rating, or review you set is kept."
    />
  );
}
