import type { Metadata } from "next";
import { getProfile, ProfileView } from "@/components/people/profile-view";

type Props = PageProps<"/u/[username]/following">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile((await params).username);
  return { title: `People ${profile.name} follows` };
}

/** A deep link to a profile with the people they follow showing. */
export default async function FollowingPage({ params }: Props) {
  return <ProfileView username={(await params).username} tab="following" atTabs />;
}
