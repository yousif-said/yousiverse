import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Account" };

const joinedDateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

export default async function AccountPage() {
  const { user } = await requireSession("/account");

  const details = [
    { label: "Name", value: user.name || "Not set" },
    { label: "Email", value: user.email },
    { label: "Joined", value: joinedDateFormat.format(user.createdAt) },
  ];

  return (
    <section className="max-w-xl pt-14 sm:pt-20">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Account</h1>
      <dl className="mt-8 divide-y rounded-lg border bg-card">
        {details.map(({ label, value }) => (
          <div key={label} className="flex items-baseline justify-between gap-6 px-5 py-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <SignOutButton className="mt-6" />
    </section>
  );
}
