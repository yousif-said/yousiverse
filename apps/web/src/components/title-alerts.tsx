import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { AlertControl } from "./alert-control";

/** The signed-in person's alerts on a title. Signed-out visitors are shown nothing here. */
export async function TitleAlerts({ mediaId }: { mediaId: string }) {
  if (!(await getSession())) return null;
  const alerts = await getQueryClient().fetchQuery(trpc.alerts.forTitle.queryOptions({ mediaId }));
  return <AlertControl mediaId={mediaId} {...alerts} />;
}
