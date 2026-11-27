import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AlertEmailsSwitch } from "@/components/alerts/alert-emails-switch";
import { AppearanceChoice } from "@/components/people/appearance-choice";
import { ProfileForm } from "@/components/people/profile-form";
import { SignOutButton } from "@/components/people/sign-out-button";
import { SubscriptionTiles } from "@/components/people/subscription-tiles";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Account" };

const SECTIONS = [
  { id: "set-profile", title: "Profile" },
  { id: "set-subs", title: "Subscriptions" },
  { id: "set-look", title: "Appearance" },
  { id: "set-email", title: "Emails" },
  { id: "set-import", title: "Import" },
  { id: "set-signin", title: "Sign-in" },
] as const;

type SectionProps = {
  id: (typeof SECTIONS)[number]["id"];
  /** What the section is for, under its heading. */
  sub?: string;
  children: React.ReactNode;
};

function Section({ id, sub, children }: SectionProps) {
  const title = SECTIONS.find((section) => section.id === id)?.title;
  return (
    <section className="set__sec" id={id} aria-labelledby={`${id}-heading`}>
      <div>
        <h2 className="d3" id={`${id}-heading`}>
          {title}
        </h2>
        {sub && <p className="sh__sub">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function AccountPage() {
  const { user } = await requireSession("/account");
  const queryClient = getQueryClient();
  const [profile, services, alerts, canReviewLinks, requestHeaders] = await Promise.all([
    queryClient.fetchQuery(trpc.profiles.me.queryOptions()),
    queryClient.fetchQuery(trpc.subscriptions.services.queryOptions()),
    queryClient.fetchQuery(trpc.alerts.mine.queryOptions()),
    queryClient.fetchQuery(trpc.links.canReview.queryOptions()),
    headers(),
  ]);

  return (
    <div className="page">
      <PageHeader title="Account" />
      <div className="set">
        <nav className="set__nav" aria-label="Account sections">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </nav>
        <div>
          <Section
            id="set-profile"
            sub="Your reviews and lists are credited to your username, and your profile shows your display name. Your email is never shown."
          >
            <ProfileForm initialProfile={profile} host={requestHeaders.get("host")} />
          </Section>

          <Section
            id="set-subs"
            sub="Tick the services you pay for. Movie and show pages then put what you can already watch first. Only you can see this."
          >
            {services ? (
              <SubscriptionTiles initialServices={services} />
            ) : (
              <div className="note">
                <Icon name="info" />
                <span>
                  The list of services could not be loaded right now. Try again in a little while.
                </span>
              </div>
            )}
          </Section>

          <Section id="set-look">
            <AppearanceChoice />
          </Section>

          <Section id="set-email">
            <div className="kv">
              <div>
                <b>Alert emails</b>
                <p>
                  One email a morning when something you are waiting for comes through. With this
                  off, alerts still show on the Alerts page.
                </p>
              </div>
              <AlertEmailsSwitch enabled={alerts.emails} />
            </div>
          </Section>

          <Section
            id="set-import"
            sub="Bring your history with you. An import never changes anything you already have here."
          >
            <div>
              <Link className="btn btn--soft" href="/import">
                <Icon name="import" />
                Import your history
              </Link>
            </div>
          </Section>

          <Section id="set-signin">
            <dl>
              <div className="kv">
                <dt className="dim">Email</dt>
                <dd className="min-w-0 wrap-anywhere text-right">
                  <b>{user.email}</b>
                </dd>
              </div>
              <div className="kv">
                <dt className="dim">Joined</dt>
                <dd>
                  <b>{formatDay(user.createdAt)}</b>
                </dd>
              </div>
              <div className="kv">
                <dt className="dim">Signs in with</dt>
                <dd className="text-right">
                  <b>Google, or a link sent by email</b>
                </dd>
              </div>
            </dl>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SignOutButton />
              {canReviewLinks && (
                <Link className="btn btn--soft" href="/admin/links">
                  <Icon name="shield" />
                  Review franchise links
                </Link>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
