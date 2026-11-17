"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { isLinkKind, LINK_KINDS, type LinkKind } from "@/lib/links";
import { useTRPC } from "@/trpc/client";

const KIND_CHOICES: Record<LinkKind, string> = {
  adaptation_of: "The first title is based on the second",
  sequel_of: "The first title is a sequel to the second",
  same_franchise: "Both are in the same franchise",
};

/** Links two titles by hand, each named by the address of its page. */
export function LinkForm() {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const add = useMutation(trpc.links.add.mutationOptions());
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const kind = form.get("kind");
    if (!isLinkKind(kind)) return;
    setMessage(undefined);
    try {
      await add.mutateAsync({ from: String(form.get("from")), to: String(form.get("to")), kind });
      formElement.reset();
      setMessage({ text: "Linked. Both titles' pages now show it.", failed: false });
      router.refresh();
    } catch (error) {
      const { data, message: detail } = error as { data?: { code?: string }; message?: string };
      const explained = data?.code === "BAD_REQUEST" || data?.code === "CONFLICT";
      setMessage({
        failed: true,
        text:
          explained && detail
            ? detail
            : data?.code === "NOT_FOUND"
              ? "One of those addresses is not a title that exists. Check both and try again."
              : "The link could not be saved. Try again in a little while.",
      });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-from`}>First title&apos;s page address</Label>
          <Input
            id={`${id}-from`}
            name="from"
            required
            maxLength={300}
            autoComplete="off"
            placeholder="/movies/604"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-to`}>Second title&apos;s page address</Label>
          <Input
            id={`${id}-to`}
            name="to"
            required
            maxLength={300}
            autoComplete="off"
            placeholder="/movies/603"
          />
        </div>
      </div>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">How they are connected</legend>
        <div className="space-y-2">
          {LINK_KINDS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="kind"
                value={kind}
                defaultChecked={kind === "same_franchise"}
                className="size-4 accent-primary"
              />
              {KIND_CHOICES[kind]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={add.isPending}>
          Link titles
        </Button>
        {message && (
          <p
            role={message.failed ? "alert" : "status"}
            className={`max-w-[65ch] text-sm ${message.failed ? "text-destructive" : "text-muted-foreground"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
