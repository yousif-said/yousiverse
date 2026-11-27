import { TRPCClientError } from "@trpc/client";

/**
 * What to tell someone whose change did not go through: the API's own words when it refused
 * for a reason they can fix (they have no username yet), otherwise the words given.
 */
export function problemFrom(error: unknown, otherwise: string): string {
  const explained = error instanceof TRPCClientError && error.data?.code === "PRECONDITION_FAILED";
  return explained ? error.message : otherwise;
}
