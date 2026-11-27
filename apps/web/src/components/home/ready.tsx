import { ServiceMark } from "@/components/media/service-mark";
import { Shelf, TitleCard } from "@/components/media/title-card";
import { SectionHead } from "@/components/ui/section-head";
import type { HomeSummary } from "@/lib/home";

/** Wanted movies and shows that one of the person's own subscriptions already carries. */
export function Ready({ titles }: { titles: HomeSummary["ready"] }) {
  return (
    <section className="section" aria-labelledby="ready-h">
      <SectionHead
        id="ready-h"
        title="Ready when you are"
        sub="From your want list, on services you already pay for"
        more={{ href: "/account", label: "Your subscriptions" }}
      />
      <Shelf>
        {titles.map(({ service, ...title }) => (
          <TitleCard
            key={title.mediaId}
            title={title}
            meta={
              <span className="svc svc--mini">
                <ServiceMark name={service.name} logoUrl={service.logoUrl} />
                {service.name}
              </span>
            }
          />
        ))}
      </Shelf>
    </section>
  );
}
