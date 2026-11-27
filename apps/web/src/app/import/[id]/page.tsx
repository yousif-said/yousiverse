import type { Metadata } from "next";
import { ImportHeader } from "@/components/import/import-header";
import { ImportResults } from "@/components/import/import-results";
import { ImportRun } from "@/components/import/import-run";
import { SOURCES } from "@/lib/imports";
import { requireSession } from "@/lib/session";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Import" };

export default async function ImportDetailPage({ params }: PageProps<"/import/[id]">) {
  const { id } = await params;
  await requireSession(`/import/${id}`);
  const job = await orNotFound(getQueryClient().fetchQuery(trpc.imports.get.queryOptions({ id })));

  return (
    <div className="page page--narrow">
      <ImportHeader />
      {/* Keyed by import, so opening another one starts from what is stored for it. */}
      <ImportRun
        key={job.id}
        importId={job.id}
        sourceName={SOURCES[job.source].name}
        initialProgress={job.progress}
      >
        {job.progress.pending === 0 && <ImportResults job={job} />}
      </ImportRun>
    </div>
  );
}
