import type { Metadata } from "next";
import { getProfile, ProfileView } from "@/components/people/profile-view";

type Props = PageProps<"/u/[username]/followers">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile((await params).username);
  return { title: `People who follow ${profile.name}` };
}

/** A deep link to a profile with its followers showing. */
export default async function FollowersPage({ params }: Props) {
  return <ProfileView username={(await params).username} tab="followers" atTabs />;
}
