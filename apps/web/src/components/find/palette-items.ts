import type { IconName } from "@/components/ui/icon";
import { pluralize } from "@/lib/format";
import { type LibraryEntry, type LibraryStatus, statusLabel } from "@/lib/library";
import { progressLine } from "@/lib/library-view";
import { universePath } from "@/lib/links";
import { MEDIA, type MediaType, mediaPath, searchPath } from "@/lib/media";
import { profilePath } from "@/lib/profile";
import type { TitleArt } from "@/lib/titles";

/** What leads a row: a title's artwork, a person's avatar, or an icon. */
export type PaletteLead =
  | { kind: "title"; title: TitleArt }
  | { kind: "person"; username: string }
  | { kind: "icon"; icon: IconName };

export type PaletteItem = {
  /** Unique among everything the palette lists at once. */
  key: string;
  href: string;
  lead: PaletteLead;
  name: string;
  sub: string;
};

export type PaletteGroup = {
  /** Null for the last row, which stands alone. */
  label: string | null;
  items: PaletteItem[];
  /** Something this group could not show, said in its place. */
  note?: string;
};

/** What the palette has to draw on. A part that has not loaded, or was not asked for, is left out. */
export type PaletteSources = {
  /** Titles the catalog found for the text, and the media types whose source did not answer. */
  titles?: {
    results: (TitleArt & { authors?: string[]; status: LibraryStatus | null })[];
    unavailable: MediaType[];
  };
  /** The title search itself failed. */
  titlesFailed?: boolean;
  people?: { username: string; name: string }[];
  /** Usernames among `people` that the signed-in person follows. */
  following?: string[];
  universes?: { id: string; name: string; titles: unknown[] }[];
  lists?: { id: string; name: string; itemCount: number }[];
  clubs?: { id: string; name: string; memberCount: number }[];
  /** What the person is partway through, most recently touched first. */
  underWay?: (TitleArt & { progress: LibraryEntry["progress"] })[];
};

const TITLES_SHOWN = 7;
const RESUME_SHOWN = 4;

type Page = { href: string; label: string; icon: IconName };

const PAGES: Page[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/youniverses", label: "Youniverses", icon: "orbit" },
  { href: "/recommendations", label: "For you", icon: "spark" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/feed", label: "Feed", icon: "feed" },
  { href: "/clubs", label: "Clubs", icon: "clubs" },
  { href: "/lists", label: "Lists", icon: "list" },
  { href: "/alerts", label: "Alerts", icon: "bell" },
  { href: "/import", label: "Import", icon: "import" },
  { href: "/account", label: "Account", icon: "sliders" },
];
/** What a visitor can open without an account, and the way in. */
const OPEN_TO_ALL = new Set(["/", "/youniverses", "/calendar", "/clubs"]);
const PAGES_FOR_VISITORS: Page[] = [
  ...PAGES.filter(({ href }) => OPEN_TO_ALL.has(href)),
  { href: "/sign-in", label: "Sign in", icon: "user" },
];

const titleKey = (title: TitleArt) => `title:${title.type}:${title.providerId}`;

/** "Movies and TV": the media types a search could not cover, in words. */
function namesOf(types: MediaType[]): string {
  const names = types.map((type) => MEDIA[type].label);
  const last = names.pop();
  return names.length > 0 ? `${names.join(", ")} and ${last}` : `${last}`;
}

/**
 * What the palette lists for the text typed so far. With nothing typed: what the person has
 * under way, the places in the app, and their lists and clubs. With text: matching titles,
 * people, youniverses, lists, clubs, and places, and last a row that takes the text to the
 * search page. A group with nothing in it is left out.
 */
export function paletteGroups(
  query: string,
  sources: PaletteSources,
  viewer: { signedIn: boolean; today: string },
): PaletteGroup[] {
  const pages = (viewer.signedIn ? PAGES : PAGES_FOR_VISITORS).map(
    ({ href, label, icon }): PaletteItem => ({
      key: `page:${href}`,
      href,
      lead: { kind: "icon", icon },
      name: label,
      sub: "Go to",
    }),
  );
  const listsAndClubs: PaletteItem[] = [
    ...(sources.lists ?? []).map(
      (list): PaletteItem => ({
        key: `list:${list.id}`,
        href: `/lists/${list.id}`,
        lead: { kind: "icon", icon: "list" },
        name: list.name,
        sub: `List · ${pluralize(list.itemCount, "title")}`,
      }),
    ),
    ...(sources.clubs ?? []).map(
      (club): PaletteItem => ({
        key: `club:${club.id}`,
        href: `/clubs/${club.id}`,
        lead: { kind: "icon", icon: "clubs" },
        name: club.name,
        sub: `Club · ${pluralize(club.memberCount, "member")}`,
      }),
    ),
  ];
  const shown = (group: PaletteGroup) => group.items.length > 0 || group.note !== undefined;

  if (!query) {
    const resume = (sources.underWay ?? []).slice(0, RESUME_SHOWN).map(
      (title): PaletteItem => ({
        key: titleKey(title),
        href: mediaPath(title.type, title.providerId),
        lead: { kind: "title", title },
        name: title.title,
        sub: title.progress
          ? progressLine(title.progress, viewer.today).text
          : MEDIA[title.type].one,
      }),
    );
    return [
      { label: "Pick up where you left off", items: resume },
      { label: "Go to", items: pages },
      { label: "Lists and clubs", items: listsAndClubs },
    ].filter(shown);
  }

  const matches = (text: string) => text.toLowerCase().includes(query.toLowerCase());
  const following = new Set(sources.following);
  const unavailable = sources.titles?.unavailable ?? [];
  const titlesNote = sources.titlesFailed
    ? "Titles could not be searched right now. Try again in a minute."
    : unavailable.length > 0
      ? `${namesOf(unavailable)} could not be searched right now.`
      : undefined;

  return [
    {
      label: "Titles",
      note: titlesNote,
      items: (sources.titles?.results ?? []).slice(0, TITLES_SHOWN).map(
        (title): PaletteItem => ({
          key: titleKey(title),
          href: mediaPath(title.type, title.providerId),
          lead: { kind: "title", title },
          name: title.title,
          sub: [
            MEDIA[title.type].one,
            title.releaseYear ?? "TBA",
            title.authors?.[0],
            title.status && statusLabel(title.status, title.type),
          ]
            .filter(Boolean)
            .join(" · "),
        }),
      ),
    },
    {
      label: "People",
      items: (sources.people ?? []).map(
        ({ username, name }): PaletteItem => ({
          key: `person:${username}`,
          href: profilePath(username),
          lead: { kind: "person", username },
          name,
          sub: following.has(username) ? `@${username} · Following` : `@${username}`,
        }),
      ),
    },
    {
      label: "Youniverses",
      items: (sources.universes ?? [])
        .filter((universe) => matches(universe.name))
        .map(
          (universe): PaletteItem => ({
            key: `universe:${universe.id}`,
            href: universePath(universe.id),
            lead: { kind: "icon", icon: "orbit" },
            name: universe.name,
            sub: `Universe · ${pluralize(universe.titles.length, "title")}`,
          }),
        ),
    },
    { label: "Lists and clubs", items: listsAndClubs.filter((item) => matches(item.name)) },
    { label: "Go to", items: pages.filter((page) => matches(page.name)) },
    {
      label: null,
      items: [
        {
          key: "search",
          href: searchPath(query),
          lead: { kind: "icon" as const, icon: "search" as const },
          name: `Search everything for “${query}”`,
          sub: "Movies, shows, games, books, and people",
        },
      ],
    },
  ].filter(shown);
}
