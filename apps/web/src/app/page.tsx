import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/home/dashboard";
import { Door } from "@/components/home/door";
import { HomeSkeleton } from "@/components/states/page-skeletons";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  // A visitor sees the front door, which goes by the site's own name. The root layout's title
  // template does not reach a page in its own segment, so Home's title is given whole.
  return (await getSession()) ? { title: { absolute: "Home · Yousiverse" } } : {};
}

/** Home for someone signed in; the front door, with its sign-in panel, for everyone else. */
export default async function HomePage() {
  const session = await getSession();
  if (!session) return <Door redirectTo="/" />;
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <Dashboard name={session.user.name} />
    </Suspense>
  );
}
