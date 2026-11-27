import { cache } from "react";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

/** What the shell shows about the signed-in person, on every page. */
export type Viewer = {
  name: string;
  /** Null until they choose one. */
  username: string | null;
  isReviewer: boolean;
  clubs: { id: string; name: string; hue: number | null }[];
  /** Alerts that have come through and are still listed. */
  alertsCameThrough: number;
};

/** The signed-in person as the shell needs them, or null for a visitor. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!(await getSession())) return null;
  return getQueryClient().fetchQuery(trpc.home.shell.queryOptions());
});
