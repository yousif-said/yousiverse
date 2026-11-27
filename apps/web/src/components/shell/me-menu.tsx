"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@yousiverse/ui/components/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { authClient } from "@/lib/auth-client";
import { profilePath } from "@/lib/profile";

type Props = {
  name: string;
  /** Null until the person has chosen one. */
  username: string | null;
  isReviewer: boolean;
};

/** The signed-in person at the foot of the sidebar: their profile, settings, look, and way out. */
export function MeMenu({ name, username, isReviewer }: Props) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isNight = resolvedTheme !== "light";

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="me"
        aria-label={
          name ? `${name}: your profile, account, and more` : "Your profile, account, and more"
        }
      >
        <Avatar username={username} size={34} />
        <span className="me__text">
          <span className="me__name block">{name || "Your account"}</span>
          <span className="me__user block">{username ? `@${username}` : "No username yet"}</span>
        </span>
        <Icon name="more" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        {username && (
          <DropdownMenuItem asChild>
            <Link href={profilePath(username)}>
              <Icon name="user" />
              Your profile
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/account">
            <Icon name="sliders" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(isNight ? "light" : "dark")}>
          <Icon name={isNight ? "sun" : "moon"} />
          Switch to {isNight ? "day" : "night"}
        </DropdownMenuItem>
        {isReviewer && (
          <DropdownMenuItem asChild>
            <Link href="/admin/links">
              <Icon name="shield" />
              Review franchise links
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <Icon name="logout" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
