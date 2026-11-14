import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";
import { SignOutButton } from "@/components/sign-out-button";
import { SubscriptionPicker } from "@/components/subscription-picker";
import { profilePath } from "@/lib/profile";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Account" };

const joinedDateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

export default async function AccountPage() {
  const { user } = await requireSession("/account");
  const queryClient = getQueryClient();
  const [profile, services] = await Promise.all([
    queryClient.fetchQuery(trpc.profiles.me.queryOptions()),
    queryClient.fetchQuery(trpc.subscriptions.services.queryOptions()),
  ]);

  const details = [
    { label: "Email", value: user.email },
    { label: "Joined", value: joinedDateFormat.format(user.createdAt) },
  ];

  return (
    <section className="max-w-xl pt-14 sm:pt-20">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Account</h1>

      <h2 className="mt-10 mb-4 font-display text-2xl font-bold tracking-tight">Profile</h2>
      <ProfileForm initialProfile={profile} />
      {profile.username && (
        <p className="mt-3 text-sm">
          <Link
            href={profilePath(profile.username)}
            className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            View your public profile
          </Link>
        </p>
      )}

      <h2 className="mt-10 font-display text-2xl font-bold tracking-tight">Subscriptions</h2>
      <p className="mt-2 mb-4 text-sm text-muted-foreground">
        Tick the streaming services you pay for, and movie and show pages will point out what you
        can already watch. Only you can see this.
      </p>
      {services ? (
        <SubscriptionPicker initialServices={services} />
      ) : (
        <p className="text-muted-foreground">
          The list of services could not be loaded right now. Try again in a little while.
        </p>
      )}

      <h2 className="mt-10 mb-4 font-display text-2xl font-bold tracking-tight">Sign-in</h2>
      <dl className="divide-y rounded-lg border bg-card">
        {details.map(({ label, value }) => (
          <div key={label} className="flex items-baseline justify-between gap-6 px-5 py-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">Your email is never shown to others.</p>
      <SignOutButton className="mt-6" />
    </section>
  );
}
