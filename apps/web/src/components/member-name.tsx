import Link from "next/link";
import { profilePath } from "@/lib/profile";

/** Who made something: a link to their profile, or a stand-in if they have no username yet. */
export function MemberName({ username }: { username: string | null }) {
  if (!username) return "A Yousiverse member";
  return (
    <Link href={profilePath(username)} className="who">
      {username}
    </Link>
  );
}
