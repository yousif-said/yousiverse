import Link from "next/link";

type Props = { returnTo: string; children: React.ReactNode };

/** "Sign in to …" for visitors, bringing them back to the same page afterwards. */
export function SignInPrompt({ returnTo, children }: Props) {
  return (
    <p className="text-sm text-muted-foreground">
      <Link
        href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
        className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Sign in
      </Link>{" "}
      {children}
    </p>
  );
}
