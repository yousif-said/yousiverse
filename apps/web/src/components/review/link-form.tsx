"use client";

import { useMutation } from "@tanstack/react-query";
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
    <form onSubmit={submit} className="panel" style={{ padding: 28 }}>
      <div className="formrow">
        <div className="field">
          <label htmlFor={`${id}-from`}>First title&apos;s page address</label>
          <input
            id={`${id}-from`}
            name="from"
            className="input"
            required
            maxLength={300}
            autoComplete="off"
            placeholder="/movies/604"
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-to`}>Second title&apos;s page address</label>
          <input
            id={`${id}-to`}
            name="to"
            className="input"
            required
            maxLength={300}
            autoComplete="off"
            placeholder="/movies/603"
          />
        </div>
      </div>
      <fieldset className="choices">
        <legend>How they are connected</legend>
        {LINK_KINDS.map((kind) => (
          <label key={kind}>
            <input
              type="radio"
              name="kind"
              value={kind}
              defaultChecked={kind === "same_franchise"}
            />
            {KIND_CHOICES[kind]}
          </label>
        ))}
      </fieldset>
      <div className="startbar">
        <button type="submit" className="btn btn--primary" disabled={add.isPending}>
          Link titles
        </button>
        {message && (
          <p
            role={message.failed ? "alert" : "status"}
            className={message.failed ? "error" : "hint"}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
