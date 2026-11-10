"use client";

import { Button } from "@yousiverse/ui/components/button";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" className={className} onClick={signOut}>
      Sign out
    </Button>
  );
}
