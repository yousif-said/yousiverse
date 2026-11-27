import type { Metadata } from "next";
import Link from "next/link";
import { ImportHeader } from "@/components/import/import-header";
import { ImportStart } from "@/components/import/import-start";
import { dayOf } from "@/lib/days";
import { formatDate, pluralize } from "@/lib/format";
import { SOURCES } from "@/lib/imports";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  await requireSession("/import");
  const imports = await getQueryClient().fetchQuery(trpc.imports.mine.queryOptions());

  return (
    <div className="page page--narrow">
      <ImportHeader />
      <ImportStart />

      {imports.length > 0 && (
        <section className="section" aria-labelledby="past-imports-h">
          <div className="sh">
            <div>
              <h2 className="d3" id="past-imports-h">
                Your imports
              </h2>
              <p className="sh__sub">Open one to see what it added and what it could not match.</p>
            </div>
          </div>
          <ul>
            {imports.map((each) => (
              <li key={each.id} className="kv">
                <Link className="kv__link" href={`/import/${each.id}`}>
                  <span>
                    <b>{SOURCES[each.source].name}</b>{" "}
                    <span className="dim">{formatDate(dayOf(new Date(each.createdAt)))}</span>
                  </span>
                  <span className="row__end">
                    {each.pending > 0 && (
                      <span className="chip chip--line">
                        {each.pending.toLocaleString("en-US")} left to match
                      </span>
                    )}
                    <span className="mono dim">{pluralize(each.total, "title")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
