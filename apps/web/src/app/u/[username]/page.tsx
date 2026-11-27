import type { Metadata } from "next";
import { getProfile, ProfileView } from "@/components/people/profile-view";
import { isLibraryStatus } from "@/lib/library";
import { isMediaType } from "@/lib/media";
import { isProfileTab } from "@/lib/profile";

type Props = PageProps<"/u/[username]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile((await params).username);
  return { title: `${profile.name} (${profile.username})` };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const [{ username }, query] = await Promise.all([params, searchParams]);

  return (
    <ProfileView
      username={username}
      tab={isProfileTab(query.tab) ? query.tab : "library"}
      type={isMediaType(query.type) ? query.type : undefined}
      status={isLibraryStatus(query.status) ? query.status : undefined}
    />
  );
}
