"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";

type Props = { listId: string; mediaId: string; title: string };

export function RemoveListItemButton({ listId, mediaId, title }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const removeItem = useMutation(trpc.lists.removeItem.mutationOptions());

  async function remove() {
    try {
      await removeItem.mutateAsync({ listId, mediaId });
      router.refresh();
    } catch {
      window.alert(`“${title}” could not be removed. Check your connection and try again.`);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={removeItem.isPending}
      aria-label={`Remove ${title} from this list`}
      className="mt-1 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
