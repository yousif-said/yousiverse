import {
  Bone,
  HeadBones,
  HeaderBones,
  LoadingPage,
  PanelBones,
  RowBones,
  ShelfBones,
  TabsBones,
  times,
  WallBones,
} from "./skeleton";

/**
 * Each page's shape while it loads, for a `loading.tsx` or a `<Suspense>` fallback. A page that
 * answers "not found" should show one only after it knows its record exists: a route-level
 * `loading.tsx` starts the response before the page can say 404.
 */

export function LibrarySkeleton() {
  return (
    <LoadingPage>
      <HeaderBones actions={<Bone as="seg" width={190} />} />
      <TabsBones />
      <div className="toolbar">
        <Bone as="seg" width={380} />
        <Bone as="seg" width={250} />
      </div>
      {times(2).map((group) => (
        <section key={group} className="lgroup">
          <div className="lgroup__head">
            <Bone as="d3" />
          </div>
          <WallBones />
        </section>
      ))}
    </LoadingPage>
  );
}

export function CalendarSkeleton() {
  return (
    <LoadingPage>
      <HeaderBones actions={<Bone as="seg" width={230} />} />
      <TabsBones count={4} />
      <div className="cal" style={{ marginTop: 34 }}>
        <div>
          <div className="cal__weekhead">
            <Bone as="d3" />
          </div>
          {times(4).map((day) => (
            <div key={day} className="day">
              <div className="day__date">
                <Bone as="text" width={36} />
                <Bone width={44} height={36} />
              </div>
              <div className="day__list">
                <RowBones className="rel" />
                {day % 2 === 0 && <RowBones className="rel" />}
              </div>
            </div>
          ))}
        </div>
        <aside className="cal__aside">
          <PanelBones height={292} />
          <PanelBones height={292} />
        </aside>
      </div>
    </LoadingPage>
  );
}

export function FeedSkeleton() {
  return (
    <LoadingPage>
      <HeaderBones />
      <div className="feed">
        <div>
          <Bone as="text" width={72} />
          {times(4).map((post) => (
            <div key={post} className="post">
              <Bone width={44} height={44} style={{ borderRadius: "50%" }} />
              <div>
                <Bone as="text" width="64%" />
                <Bone height={96} className="mt-3.5" style={{ borderRadius: 16 }} />
              </div>
            </div>
          ))}
        </div>
        <aside>
          <PanelBones height={300} />
        </aside>
      </div>
    </LoadingPage>
  );
}

export function AlertsSkeleton() {
  return (
    <LoadingPage>
      <HeaderBones />
      <div className="split">
        <div>
          <HeadBones sub />
          <PanelBones height={108} />
          <section className="section">
            <HeadBones sub />
            {times(4).map((alert) => (
              <div key={alert} className="wait">
                <Bone as="thumb" style={{ justifySelf: "center" }} />
                <div className="min-w-0">
                  <Bone as="text" width="58%" />
                  <Bone as="text" width="80%" className="mt-2" />
                </div>
              </div>
            ))}
          </section>
        </div>
        <aside className="flex flex-col gap-4.5">
          <PanelBones height={104} />
          <PanelBones height={84} />
        </aside>
      </div>
    </LoadingPage>
  );
}

/** Home: the greeting, where you left off, and the shelves under it. */
export function HomeSkeleton() {
  return (
    <LoadingPage>
      <div className="hello">
        <Bone as="text" width={170} />
        <Bone as="d1" />
        <Bone as="lede" />
      </div>
      <div className="resume">
        <Bone height={400} style={{ borderRadius: 24 }} />
        <div className="resume__side">
          {times(3).map((item) => (
            <Bone key={item} style={{ flex: 1, minHeight: 114, borderRadius: 18 }} />
          ))}
        </div>
      </div>
      {times(2).map((shelf) => (
        <section key={shelf} className="section">
          <HeadBones sub />
          <ShelfBones />
        </section>
      ))}
    </LoadingPage>
  );
}
