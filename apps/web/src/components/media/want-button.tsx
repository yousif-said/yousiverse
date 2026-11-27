"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { statusLabel } from "@/lib/library";
import type { MediaType } from "@/lib/media";
import { useTRPC } from "@/trpc/client";

type Props = { mediaId: string; type: MediaType; title: string };

/** Puts a title the person does not have yet on their want list, from a row that lists it. */
export function WantButton({ mediaId, type, title }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const save = useMutation(
    trpc.library.save.mutationOptions({
      onSuccess: () => {
        toast(`${title}: ${statusLabel("want", type).toLowerCase()}`);
        queryClient.invalidateQueries(trpc.library.pathFilter());
        router.refresh();
      },
    }),
  );

  return (
    <>
      <button
        type="button"
        className="btn btn--sm btn--soft"
        aria-label={`Want: ${title}`}
        // Stays off once saved: the refreshed row shows the status in its place.
        disabled={save.isPending || save.isSuccess}
        onClick={() => save.mutate({ mediaId, status: "want" })}
      >
        <Icon name="plus" size="sm" />
        Want
      </button>
      {save.isError && (
        <span role="alert" className="error">
          That did not save. Try again.
        </span>
      )}
    </>
  );
}
