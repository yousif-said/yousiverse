"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { authClient } from "@/lib/auth-client";

/** Signs the person out and takes them to the front door. */
export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" className="btn btn--soft" onClick={signOut}>
      <Icon name="logout" />
      Sign out
    </button>
  );
}
