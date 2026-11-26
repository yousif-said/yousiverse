// Shared pieces every screen is built from: formatting, artwork, cards, scores, and the mock state.
(() => {
  const C = window.CATALOG;
  const D = window.DATA;
  const { TODAY, ME, PEOPLE } = D;

  const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const plural = (n, one, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

  const MEDIA = {
    movie: { label: "Movies", one: "Movie", icon: "movie" },
    tv: { label: "TV", one: "Show", icon: "tv" },
    game: { label: "Games", one: "Game", icon: "game" },
    book: { label: "Books", one: "Book", icon: "book" },
  };
  const TYPES = Object.keys(MEDIA);
  const STATUSES = ["want", "in_progress", "finished", "dropped"];
  const STATUS = {
    want: { label: "Want", icon: "bookmark", by: { movie: "Want to watch", tv: "Want to watch", game: "Want to play", book: "Want to read" } },
    in_progress: { label: "In progress", icon: "play", by: { movie: "Watching", tv: "Watching", game: "Playing", book: "Reading" } },
    finished: { label: "Finished", icon: "check", by: { movie: "Watched", tv: "Finished", game: "Finished", book: "Read" } },
    dropped: { label: "Dropped", icon: "x", by: { movie: "Dropped", tv: "Dropped", game: "Dropped", book: "Dropped" } },
  };
  const VISIBILITY = { public: { label: "Everyone", icon: "globe" }, friends: { label: "Friends", icon: "clubs" }, private: { label: "Only you", icon: "lock" } };
  const statusLabel = (status, type) => STATUS[status].by[type];

  // What the person has changed while clicking around. Nothing is saved between visits.
  const S = {
    signedIn: true,
    lib: { view: "grid", type: "all", status: "all", sort: "recent" },
    cal: { scope: "library", type: "all" },
    season: {},
    watched: {},
    budget: "evening",
    blend: "mara",
    profileTab: {},
    importer: { source: "letterboxd", state: "idle", done: 0, visibility: "public" },
    search: { q: "", type: "all" },
    emailAlerts: true,
    door: "start",
    alertsOn: {},
    listDraft: null,
    resolved: {},
    posted: {},
  };

  // ---- formatting ----
  const day = (iso) => new Date(`${iso}T12:00:00`);
  const fmt = (iso, options) => new Intl.DateTimeFormat("en-US", options).format(day(iso));
  const dateLong = (iso) => fmt(iso, { month: "long", day: "numeric", year: "numeric" });
  const dateShort = (iso) => fmt(iso, { month: "short", day: "numeric" });
  const daysUntil = (iso) => Math.round((day(iso) - day(TODAY)) / 86_400_000);
  const addDays = (iso, n) => new Date(day(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);
  function ago(iso) {
    const n = -daysUntil(iso);
    if (n <= 0) return "Today";
    if (n === 1) return "Yesterday";
    if (n < 7) return fmt(iso, { weekday: "long" });
    return day(iso).getFullYear() === day(TODAY).getFullYear() ? dateShort(iso) : fmt(iso, { month: "short", day: "numeric", year: "numeric" });
  }
  function until(iso) {
    const n = daysUntil(iso);
    if (n === 0) return "Today";
    if (n === 1) return "Tomorrow";
    if (n < 7) return fmt(iso, { weekday: "long" });
    return `In ${n} days`;
  }
  /** Lowercases a relative day for mid-sentence use, leaving weekday and month names alone. */
  const lc = (text) => text.replace(/^(Today|Tomorrow|Yesterday|In)\b/, (word) => word.toLowerCase());
  const runtime = (minutes) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`);
  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  /** A rating is kept in quarter points (0 to 40) and shown out of 10. */
  const rating = (quarters) => String(quarters / 4);
  const toQuarters = (outOfTen) => Math.round(outOfTen * 4);

  // ---- small parts ----
  const icon = (name, cls = "") => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const ratioOf = (title) => (title.type === "movie" ? 0.667 : title.type === "tv" ? 1.778 : title.type === "game" ? 0.75 : (title.ratio ?? 0.66));
  const toneOf = (title) => `--tone-h:${title.hue ?? 40};--tone-s:${clamp(title.sat ?? 0, 22, 78)}`;
  const glow = (title) => `--h:${title.hue ?? 40};--s:${clamp(title.sat ?? 0, 20, 80)}`;
  const href = (title) => `#t-${title.key}`;
  const med = (type, withLabel = true) => `<span class="med med--${type}">${icon(MEDIA[type].icon, "i--sm")}${withLabel ? MEDIA[type].one : ""}</span>`;

  function person(username) {
    if (username === ME.username) return ME;
    return PEOPLE[username] ?? null;
  }
  function avatar(username, size) {
    const who = person(username);
    const style = size ? `--sz:${size}px;` : "";
    if (!who) return `<span class="av" style="${style}--h:40;filter:grayscale(1)" aria-hidden="true">?</span>`;
    const initials = who.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
    return `<span class="av" style="${style}--h:${who.hue}" title="${esc(who.name)}" aria-hidden="true">${initials}</span>`;
  }
  const nameLink = (username) => {
    const who = person(username);
    return who ? `<a href="#p-${username}" class="who"><b>${esc(username === ME.username ? "You" : who.name.split(" ")[0])}</b></a>` : `<b>A Yousiverse member</b>`;
  };
  const fullName = (username) => person(username)?.name ?? "A Yousiverse member";

  function score(quarters, kind = "mine", large = false) {
    if (quarters === null || quarters === undefined) return "";
    return `<span class="score score--${kind}${large ? " score--lg" : ""}" title="${kind === "mine" ? "Your rating" : "Everyone's average"}"><i class="ring" style="--v:${(quarters / 40) * 100}"></i>${rating(quarters)}</span>`;
  }
  const average = (value) => (value === null ? "" : `<span class="score score--all" title="Everyone's average"><i class="ring" style="--v:${value * 10}"></i>${value.toFixed(1)}</span>`);

  /** A title's artwork in its medium's own shape: poster, screen, case, or book. */
  function art(title, { cls = "", link = true, check = false, eager = false } = {}) {
    const src = title.type === "tv" ? (title.backdrop ?? title.poster) : title.poster;
    const tag = link ? "a" : "div";
    const attrs = link ? ` href="${href(title)}" aria-label="${esc(title.title)}"` : "";
    const status = check ? D.library[title.key]?.status : null;
    return `<${tag} class="art art--${title.type} ${cls}"${attrs} style="--ratio:${ratioOf(title)};${glow(title)}">
      <img src="${src}" alt="" ${eager ? "" : 'loading="lazy"'} decoding="async">
      ${title.type === "tv" ? `<span class="art__title">${esc(title.title)}</span>` : ""}
      ${status ? `<span class="art__check" title="${statusLabel(status, title.type)}">${icon(STATUS[status].icon)}</span>` : ""}
    </${tag}>`;
  }
  const thumb = (title, options = {}) => art(title, { ...options, cls: `thumb ${options.cls ?? ""}` });

  function card(title, { meta = "", why = "", check = false } = {}) {
    return `<article class="card" style="--ratio:${ratioOf(title)}">
      ${art(title, { check })}
      <div>
        ${title.type === "tv" ? "" : `<a class="card__title" href="${href(title)}">${esc(title.title)}</a>`}
        <div class="card__meta">${meta}</div>
        ${why ? `<div class="card__why">${why}</div>` : ""}
      </div>
    </article>`;
  }
  const yearMeta = (title) => `${med(title.type, false)}<span>${title.year ?? "TBA"}</span>`;

  function row(title, { sub = "", end = "", cls = "", attrs = "" } = {}) {
    return `<div class="row ${cls}" ${attrs}>
      ${thumb(title)}
      <div style="min-width:0"><a class="row__title" href="${href(title)}" style="display:block">${esc(title.title)}</a><div class="row__sub">${sub}</div></div>
      <div class="row__end">${end}</div>
    </div>`;
  }

  // ---- library helpers ----
  const entriesOf = (status) => Object.keys(D.library).filter((key) => D.library[key].status === status).sort((a, b) => (D.library[b].at > D.library[a].at ? 1 : -1));
  function seasonsOf(title) {
    return title.seasons ?? [];
  }
  const aired = (episode) => Boolean(episode.date) && episode.date <= TODAY;
  function isWatched(key, season, episode) {
    const id = `${key}-${season}-${episode}`;
    if (id in S.watched) return S.watched[id];
    const entry = D.library[key];
    if (!entry) return false;
    if (entry.status === "finished") return true;
    const at = entry.progress;
    return Boolean(at?.season) && (season < at.season || (season === at.season && episode <= at.episode));
  }
  /** The next episode of a show the person is partway through, or null when they are caught up. */
  function nextEpisode(key) {
    for (const season of seasonsOf(C[key])) {
      for (const episode of season.eps) {
        if (!isWatched(key, season.n, episode.n)) return { season: season.n, ...episode, of: season.eps.length };
      }
    }
    return null;
  }
  function progressOf(key) {
    const title = C[key];
    const at = D.library[key]?.progress;
    if (!at) return null;
    if (title.type === "tv") {
      const next = nextEpisode(key);
      if (!next) return { text: "All caught up", value: 100 };
      const watchedInSeason = next.n - 1;
      return {
        text: aired(next) ? `Season ${next.season}, episode ${next.n} is next` : `Season ${next.season}, episode ${next.n} airs ${lc(until(next.date))}`,
        value: (watchedInSeason / next.of) * 100,
        next,
      };
    }
    if (title.type === "book") return { text: `Page ${at.page} of ${title.pages}`, value: (at.page / title.pages) * 100 };
    if (title.type === "game") return { text: `${at.hours} hours played`, value: null };
    return null;
  }

  /** What is coming out in the next 90 days: movies and games by release date, shows by episode. */
  function upcoming(scope, type) {
    const end = addDays(TODAY, 90);
    const entries = [];
    for (const title of Object.values(C)) {
      if (title.type === "book") continue;
      if (type !== "all" && title.type !== type) continue;
      const mine = D.library[title.key];
      if (scope === "library" && (!mine || mine.status === "dropped")) continue;
      if (title.type === "tv") {
        for (const season of seasonsOf(title)) {
          for (const episode of season.eps) {
            if (episode.date && episode.date >= TODAY && episode.date <= end) entries.push({ date: episode.date, title, season: season.n, episode });
          }
        }
      } else if (title.date && title.date >= TODAY && title.date <= end) {
        entries.push({ date: title.date, title });
      }
    }
    return entries.sort((a, b) => (a.date === b.date ? a.title.title.localeCompare(b.title.title) : a.date < b.date ? -1 : 1));
  }

  const universeOf = (key) => D.UNIVERSES.find((universe) => universe.nodes.includes(key));
  function relationTo(universe, from, to) {
    for (const [a, b, kind] of universe.edges) {
      if (a === to && b === from) return kind === "adapt" ? "Based on" : "Before this";
      if (a === from && b === to) return kind === "adapt" ? "Adapted as" : "After this";
    }
    return "Same universe";
  }

  window.Y = {
    C, D, S, TODAY, ME, PEOPLE, MEDIA, TYPES, STATUSES, STATUS, VISIBILITY,
    esc, clamp, plural, statusLabel, day, fmt, dateLong, dateShort, daysUntil, addDays, ago, until, lc, runtime, money, rating, toQuarters,
    icon, ratioOf, toneOf, glow, href, med, person, avatar, nameLink, fullName, score, average, art, thumb, card, yearMeta, row,
    entriesOf, seasonsOf, aired, isWatched, nextEpisode, progressOf, upcoming, universeOf, relationTo,
    views: {},
  };
})();
