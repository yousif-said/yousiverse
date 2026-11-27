import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/states/notice";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <Notice
      title="Nothing here."
      text="That page does not exist, or you are not allowed to see it."
    >
      <Link className="btn btn--primary" href="/" style={{ marginTop: 20 }}>
        Back to Home
      </Link>
    </Notice>
  );
}
