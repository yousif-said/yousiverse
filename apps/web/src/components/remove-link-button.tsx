"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";

type Props = { linkId: string; summary: string };

export function RemoveLinkButton({ linkId, summary }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const removeLink = useMutation(trpc.links.remove.mutationOptions());

  async function remove() {
    if (!window.confirm(`Remove this link? ${summary}`)) return;
    try {
      await removeLink.mutateAsync({ id: linkId });
      router.refresh();
    } catch {
      window.alert("The link could not be removed. Check your connection and try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={removeLink.isPending}
      aria-label={`Remove link: ${summary}`}
      className="rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
