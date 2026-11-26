// Screens, part two: For you, Calendar, Feed, Clubs, Lists, Profiles, Alerts, Import, Account, Search, and the front door.
(() => {
  const Y = window.Y;
  const { C, D, S, TODAY, ME, PEOPLE, MEDIA, TYPES, STATUSES, STATUS, VISIBILITY } = Y;
  const { esc, plural, icon, art, thumb, card, row, score, average, avatar, med, statusLabel, money, rating, sectionHead, moreLink } = Y;

  const visChip = (visibility) => `<span class="chip">${icon(VISIBILITY[visibility].icon, "i--sm")}${VISIBILITY[visibility].label}</span>`;
  const followButton = (username) => {
    const who = PEOPLE[username];
    return `<button type="button" class="btn btn--sm ${who.following ? "btn--soft" : "btn--primary"}" data-act="follow" data-user="${username}" aria-pressed="${who.following}">${who.following ? "Following" : who.followsYou ? "Follow back" : "Follow"}</button>`;
  };
  const personRow = (username, note) => {
    const who = Y.person(username);
    return `<li class="person"><a href="#p-${username}">${avatar(username, 40)}</a><a href="#p-${username}"><b>${esc(who.name)}</b><span>${note ?? `@${username}`}</span></a>${username === ME.username ? '<span class="chip">You</span>' : followButton(username)}</li>`;
  };
  Y.personRow = personRow;

  // ---------- for you ----------
  const BUDGETS = { hour: "An hour", two: "Two hours", evening: "An evening", weekend: "A weekend" };
  function fitsBudget(budget) {
    const picks = [];
    const add = (key, why) => C[key] && picks.push({ title: C[key], why });
    if (budget === "hour") {
      for (const key of Y.entriesOf("in_progress")) {
        const next = C[key].type === "tv" ? Y.nextEpisode(key) : null;
        if (next && Y.aired(next) && (next.min ?? 60) <= 65) add(key, `Episode ${next.n}, ${Y.runtime(next.min ?? 50)}`);
      }
      add("balatro", "A run or two");
      add("hades-ii", "One escape attempt");
    } else {
      const limit = budget === "two" ? 125 : 190;
      if (budget === "weekend") {
        add("chernobyl", "5 episodes, about 5h 30m");
        add("pluribus", "9 episodes, about 8h");
        add("silksong", "A good start");
        add("children-of-dune", "444 pages");
        add("two-towers-book", "352 pages");
      }
      for (const key of Y.entriesOf("want")) {
        const title = C[key];
        if (title.type === "movie" && title.runtime && title.runtime <= limit && (!title.date || title.date <= TODAY) && (budget !== "weekend")) add(key, Y.runtime(title.runtime));
      }
    }
    return picks;
  }
  function blendWith(username) {
    const theirs = Object.keys(C).filter((key) => (D.friendRatings(key)[username] ?? 0) >= 8.5 && !D.library[key]);
    const both = Y.entriesOf("want").filter((key) => (D.friendRatings(key)[username] ?? 0) >= 8);
    return [...both.map((key) => ({ key, why: `You want it, ${PEOPLE[username].name.split(" ")[0]} rated it ${D.friendRatings(key)[username]}` })), ...theirs.map((key) => ({ key, why: `${PEOPLE[username].name.split(" ")[0]} rated it ${D.friendRatings(key)[username]}` }))].slice(0, 8);
  }

  Y.views["for-you"] = () => {
    const fits = fitsBudget(S.budget);
    const friends = Object.keys(PEOPLE).filter((username) => PEOPLE[username].following && PEOPLE[username].followsYou);
    const blend = blendWith(S.blend);
    const html = `<div class="page">
      <header class="ph"><div class="ph__text"><h1 class="d2">For you</h1><p class="lede">Picked from what you rated 7 or higher. Nothing below is already finished, and each suggestion appears once.</p></div></header>

      <section class="panel" style="padding:26px" aria-labelledby="budget-h">
        <div class="sh" style="align-items:center;flex-wrap:wrap"><div><h2 class="d3" id="budget-h">How long have you got?</h2><p class="sh__sub">From your own library, sized to the time you have.</p></div>
          <div class="seg" role="group" aria-label="Time you have">${Object.entries(BUDGETS).map(([value, label]) => `<button type="button" data-act="budget" data-value="${value}" aria-pressed="${S.budget === value}">${label}</button>`).join("")}</div></div>
        <div class="shelf" style="margin:0 -26px;padding:6px 26px 6px;-webkit-mask-image:none;mask-image:none">${fits.length ? fits.map(({ title, why }) => card(title, { meta: `${med(title.type, false)}<span>${esc(why)}</span>` })).join("") : `<p class="dim">Nothing in your library fits. Try a longer stretch.</p>`}</div>
      </section>

      ${D.RECOMMENDATIONS.filter((rowData) => rowData.keys.length).map((rowData) => {
        const seed = C[rowData.seed];
        return `<section class="section">
          <div class="sh"><div style="display:flex;align-items:center;gap:16px">${thumb(seed)}<div><span class="label">${rowData.author ? `More by ${esc(rowData.author)}` : rowData.loose ? "Readers of this also rated highly" : "Because you rated"}</span><h2 class="d3" style="margin-top:4px"><a href="#t-${seed.key}">${esc(seed.title)}</a> <span class="dimmer">${rating(D.ratings[seed.key])}</span></h2></div></div></div>
          <div class="shelf">${rowData.keys.map((key) => card(C[key], { meta: `${Y.yearMeta(C[key])}${average(D.community(key).average)}` })).join("")}</div>
        </section>`;
      }).join("")}

      <section class="section panel" style="padding:26px" aria-labelledby="blend-h">
        <div class="sh" style="align-items:center;flex-wrap:wrap"><div><h2 class="d3" id="blend-h">Something for two</h2><p class="sh__sub">What you and a friend would both enjoy, from your want list and their favorites.</p></div>
          <div class="seg" role="group" aria-label="Friend">${friends.map((username) => `<button type="button" data-act="blend" data-value="${username}" aria-pressed="${S.blend === username}">${avatar(username, 22)}${esc(PEOPLE[username].name.split(" ")[0])}</button>`).join("")}</div></div>
        <div class="shelf" style="margin:0 -26px;padding:6px 26px 6px;-webkit-mask-image:none;mask-image:none">${blend.map(({ key, why }) => card(C[key], { meta: Y.yearMeta(C[key]), why: esc(why) })).join("")}</div>
      </section>
    </div>`;
    return { html, title: "For you" };
  };

  // ---------- calendar ----------
  Y.views.calendar = () => {
    const { scope, type } = S.cal;
    const entries = Y.upcoming(scope, type);
    const byDay = new Map();
    for (const entry of entries) {
      if (!byDay.has(entry.date)) byDay.set(entry.date, []);
      byDay.get(entry.date).push(entry);
    }
    const weekday = Y.day(TODAY).getDay();
    const endOfWeek = Y.addDays(TODAY, (7 - weekday) % 7);
    const endOfNext = Y.addDays(endOfWeek, 7);
    const groupOf = (date) => (date <= endOfWeek ? "This week" : date <= endOfNext ? "Next week" : Y.fmt(date, { month: "long" }));
    const groups = new Map();
    for (const date of byDay.keys()) {
      const name = groupOf(date);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(date);
    }
    const detail = (entry) => (entry.episode ? `Season ${entry.season}, episode ${entry.episode.n}${/^Episode \d+$/.test(entry.episode.name) ? "" : ` · ${esc(entry.episode.name)}`}` : entry.title.type === "movie" ? "In theaters" : (entry.title.platforms?.slice(0, 3).join(", ") ?? "Release day"));
    const month = (first) => {
      const start = Y.day(first);
      const year = start.getFullYear();
      const index = start.getMonth();
      const days = new Date(year, index + 1, 0).getDate();
      const cells = [];
      for (let blank = 0; blank < new Date(year, index, 1).getDay(); blank++) cells.push('<span class="month__d out"></span>');
      for (let date = 1; date <= days; date++) {
        const iso = `${year}-${String(index + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
        const here = byDay.get(iso) ?? [];
        const inWindow = iso >= TODAY && iso <= Y.addDays(TODAY, 90);
        const kinds = [...new Set(here.map((entry) => entry.title.type))];
        cells.push(`<${here.length ? `a href="#calendar" data-act="scroll-day" data-day="${iso}"` : "span"} class="month__d${inWindow ? " in" : ""}${here.length ? " has" : ""}${iso === TODAY ? " today" : ""}" ${here.length ? `title="${here.map((entry) => esc(entry.title.title)).join(", ")}"` : ""}>${date}${kinds.length ? `<span class="month__dots">${kinds.map((kind) => `<i style="background:var(--${kind})"></i>`).join("")}</span>` : ""}</${here.length ? "a" : "span"}>`);
      }
      return `<div class="month"><div class="month__name"><span>${Y.fmt(first, { month: "long" })}</span><span class="hint mono">${year}</span></div><div class="month__grid">${["S", "M", "T", "W", "T", "F", "S"].map((letter) => `<span>${letter}</span>`).join("")}${cells.join("")}</div></div>`;
    };

    const html = `<div class="page">
      <header class="ph">
        <div class="ph__text"><h1 class="d2">Calendar</h1><p class="lede">${scope === "library" ? "The next 90 days from your library, with new episodes of your shows." : "Everything in the catalog coming out in the next 90 days."} US dates, and they can move.</p></div>
        <div class="ph__actions"><div class="seg" role="group" aria-label="Which titles"><button type="button" data-act="cal" data-field="scope" data-value="library" aria-pressed="${scope === "library"}">Your library</button><button type="button" data-act="cal" data-field="scope" data-value="catalog" aria-pressed="${scope === "catalog"}">Everything</button></div></div>
      </header>
      <div class="tabs" role="group" aria-label="Medium">
        <button type="button" data-act="cal" data-field="type" data-value="all" aria-pressed="${type === "all"}">All <span class="n">${Y.upcoming(scope, "all").length}</span></button>
        ${["movie", "tv", "game"].map((candidate) => `<button type="button" data-act="cal" data-field="type" data-value="${candidate}" aria-pressed="${type === candidate}"><span class="c-${candidate}" style="display:inline-flex">${icon(MEDIA[candidate].icon, "i--sm")}</span>${MEDIA[candidate].label} <span class="n">${Y.upcoming(scope, candidate).length}</span></button>`).join("")}
      </div>
      <div class="cal" style="margin-top:34px">
        <div>${entries.length ? [...groups.entries()].map(([name, dates]) => `<section class="cal__week">
            <div class="cal__weekhead"><h2 class="d3">${name}</h2><span class="hint mono">${Y.dateShort(dates[0])}${dates.length > 1 ? ` to ${Y.dateShort(dates[dates.length - 1])}` : ""}</span></div>
            ${dates.map((date) => `<div class="day${date === TODAY ? " today" : ""}" id="day-${date}">
                <div class="day__date"><span>${date === TODAY ? "Today" : Y.fmt(date, { weekday: "short" })}</span><b>${Y.day(date).getDate()}</b></div>
                <div class="day__list">${byDay.get(date).map((entry) => {
                  const mine = D.library[entry.title.key];
                  return row(entry.title, { cls: "rel", sub: `${med(entry.title.type)}<span>${detail(entry)}</span>`, end: `<span class="chip chip--line">${Y.until(date)}</span>${mine ? `<span class="chip" title="In your library">${icon(STATUS[mine.status].icon, "i--sm")}${statusLabel(mine.status, entry.title.type)}</span>` : `<button type="button" class="btn btn--sm btn--soft" data-act="status" data-key="${entry.title.key}" data-status="want">${icon("plus", "i--sm")}Want</button>`}` });
                }).join("")}</div>
              </div>`).join("")}
          </section>`).join("") : `<div class="empty">Nothing ${scope === "library" ? "in your library" : "in the catalog"} has a date in the next 90 days.${scope === "library" ? ' <button type="button" class="link" data-act="cal" data-field="scope" data-value="catalog">See everything</button>' : ""}</div>`}
          <p class="hint" style="margin-top:22px">Books are not on the calendar: their source gives no release dates.</p>
        </div>
        <aside class="cal__aside" aria-label="Months">${[TODAY, "2026-12-01", "2027-01-01", "2027-02-01"].map(month).join("")}</aside>
      </div>
    </div>`;
    return { html, title: "Calendar" };
  };

  // ---------- feed ----------
  function post(item) {
    const head = (verb, what) => `<p class="act__line"><a href="#p-${item.who}"><b>${esc(Y.fullName(item.who))}</b></a> ${verb} ${what}</p>`;
    if (item.kind === "list") {
      const list = D.LISTS.find((candidate) => candidate.id === item.list);
      return `<li class="post">${avatar(item.who, 44)}<div>${head(item.shared ? "saved the list" : "made the list", `<a href="#l-${list.id}"><b>${esc(list.name)}</b></a>`)}
        <a class="post__media" href="#l-${list.id}"><div class="fan">${list.items.slice(0, 5).map(({ key }) => thumb(C[key], { link: false })).join("")}</div><div style="margin-left:auto;text-align:right"><div class="hint">${plural(list.items.length, "title")}</div></div></a></div></li>`;
    }
    const title = C[item.key];
    const what = `<a href="#t-${title.key}"><b>${esc(title.title)}</b></a>`;
    return `<li class="post toned" style="${Y.toneOf(title)}">${avatar(item.who, 44)}<div>${head(item.kind === "review" ? "reviewed" : Y.activity(item.status, title.type), what)}
      ${item.body ? `<blockquote class="post__quote">“${esc(item.body)}”</blockquote>` : ""}
      <a class="post__media" href="#t-${title.key}">${thumb(title, { link: false })}<div style="min-width:0"><div class="row__title">${esc(title.title)}</div><div class="row__sub">${med(title.type)}<span>${title.year ?? ""}</span></div></div>${item.rating ? `<div class="post__big" style="margin-left:auto">${item.rating}</div>` : ""}</a></div></li>`;
  }
  Y.views.feed = () => {
    const days = [...new Set(D.FEED.map((item) => item.at))];
    const following = Object.keys(PEOPLE).filter((username) => PEOPLE[username].following);
    const suggestions = Object.keys(PEOPLE).filter((username) => !PEOPLE[username].following);
    const html = `<div class="page">
      <header class="ph"><div class="ph__text"><h1 class="d2">Feed</h1><p class="lede">What the people you follow have been watching, playing, and reading.</p></div></header>
      <div class="feed">
        <div>${days.map((date) => `<h2 class="label feed__day">${Y.ago(date)}</h2><ul>${D.FEED.filter((item) => item.at === date).map(post).join("")}</ul>`).join("")}
          <button type="button" class="btn btn--soft" style="margin-top:24px" data-act="toast" data-msg="Older activity loads here, 40 at a time">Older activity</button></div>
        <aside>
          <div class="panel"><div class="panel__head"><h3 class="label">You follow</h3><a class="hint link" href="#p-${ME.username}">${following.length} people</a></div><ul>${following.slice(0, 5).map((username) => personRow(username, PEOPLE[username].followsYou ? "Friends" : `@${username}`)).join("")}</ul></div>
          <div class="panel" style="margin-top:18px"><div class="panel__head"><h3 class="label">People to follow</h3></div><ul>${suggestions.map((username) => personRow(username, PEOPLE[username].followsYou ? "Follows you" : `@${username}`)).join("")}</ul></div>
        </aside>
      </div>
    </div>`;
    return { html, title: "Feed" };
  };

  // ---------- clubs ----------
  const covers = (club) => club.types.map((type) => med(type, false)).join("");
  const accessChip = (club) => `<span class="chip">${icon(club.access === "public" ? "globe" : "lock", "i--sm")}${club.access === "public" ? "Public" : "Invite only"}</span>`;
  function clubTile(club) {
    const lead = C[club.picks[0]?.key];
    const latest = [...club.threads].sort((a, b) => (a.active < b.active ? 1 : -1))[0];
    return `<a class="tile toned" href="#c-${club.id}" style="${lead ? Y.toneOf(lead) : ""}">
      <div class="tile__art">${club.picks.slice(0, 4).map((pick) => thumb(C[pick.key], { link: false })).join("")}</div>
      <div><h3 class="d3">${esc(club.name)}</h3><p class="dim" style="margin-top:6px;font-size:14px">${esc(club.description)}</p></div>
      <div class="tile__meta"><span style="display:inline-flex;gap:8px">${covers(club)}</span>${accessChip(club)}<span class="avs">${club.members.slice(0, 4).map((username) => avatar(username, 22)).join("")}</span><span>${plural(club.memberCount, "member")}</span></div>
      <div class="tile__foot">${club.joined ? (latest ? `<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(latest.title)}</span><span class="thread__n">${icon("msg", "i--sm")}${latest.posts.length}</span>` : "<span>No discussions yet</span>") : `<span>Run by ${esc(Y.fullName(club.owner))}</span><span class="btn btn--sm btn--primary">Open</span>`}</div>
    </a>`;
  }
  Y.views.clubs = () => ({
    title: "Clubs",
    html: `<div class="page">
      <header class="ph"><div class="ph__text"><h1 class="d2">Clubs</h1><p class="lede">A group around some kinds of titles: a book club, a film club, a club for everything. Each keeps to the kinds its owner chose.</p></div>
        <div class="ph__actions"><button type="button" class="btn btn--primary" data-act="modal" data-modal="new-club">${icon("plus")}Start a club</button></div></header>
      <section>${sectionHead("Your clubs")}<div class="tiles">${D.CLUBS.filter((club) => club.joined).map(clubTile).join("")}</div></section>
      <section class="section">${sectionHead("Open to join", { sub: "Public clubs anyone can find" })}<div class="tiles">${D.CLUBS.filter((club) => !club.joined).map(clubTile).join("")}</div></section>
    </div>`,
  });

  Y.views.club = (id, invite) => {
    const club = D.CLUBS.find((candidate) => candidate.id === id);
    if (!club) return Y.views.missing();
    const owner = club.owner === ME.username;
    const inside = club.joined || club.access === "public";
    const lead = C[club.picks[0]?.key];
    const html = `<div class="page toned" style="${lead ? Y.toneOf(lead) : ""}">
      <a class="crumb" href="#clubs">${icon("chev-l", "i--sm")}Clubs</a>
      <header class="clubhead" style="margin-top:14px">
        <div class="ph__text">
          <div class="tile__meta"><span style="display:inline-flex;gap:12px">${club.types.map((type) => `<span class="med med--${type}">${icon(MEDIA[type].icon, "i--sm")}${MEDIA[type].label}</span>`).join("")}</span>${accessChip(club)}</div>
          <h1 class="d1">${esc(club.name)}</h1>
          <p class="lede">${esc(club.description)}</p>
          <div class="tile__meta" style="margin-top:4px"><span class="avs">${club.members.slice(0, 6).map((username) => avatar(username, 28)).join("")}</span><span>${plural(club.memberCount, "member")}, run by ${owner ? "you" : `<a class="link" href="#p-${club.owner}">${esc(Y.fullName(club.owner))}</a>`}</span></div>
        </div>
        <div class="ph__actions">${owner ? `<button type="button" class="btn btn--soft" data-act="copy" data-text="yousiverse.app/clubs/${club.id}?invite=${club.invite}">${icon("link")}Copy invite link</button><button type="button" class="btn btn--soft" data-act="toast" data-msg="Club details open for editing here">${icon("pencil")}Edit</button>` : club.joined ? `<button type="button" class="btn btn--soft" data-act="join" data-club="${club.id}">Leave club</button>` : `<button type="button" class="btn btn--primary btn--lg" data-act="join" data-club="${club.id}">${icon("plus")}Join club</button>`}</div>
      </header>
      ${inside ? `
      <section class="section">${sectionHead("Picks", { sub: club.joined ? "Pick a title for this club from its own page" : "" })}
        <div class="shelf">${club.picks.map((pick) => card(C[pick.key], { meta: `${pick.average ? `<span class="score score--all" title="Club average"><i class="ring" style="--v:${pick.average * 10}"></i>${pick.average.toFixed(1)}</span><span>from ${pick.count}</span>` : "<span>No club ratings yet</span>"}`, why: `${D.ratings[pick.key] ? `You ${rating(D.ratings[pick.key])} · ` : ""}picked by ${pick.by === ME.username ? "you" : esc(Y.fullName(pick.by).split(" ")[0])}` })).join("")}</div>
      </section>
      <section class="section">
        ${sectionHead("Discussions", { more: club.joined ? `<button type="button" class="btn btn--sm btn--primary" data-act="modal" data-modal="new-thread" data-club="${club.id}">${icon("plus", "i--sm")}Start a discussion</button>` : "" })}
        ${club.threads.length ? `<ul>${[...club.threads].sort((a, b) => (a.active < b.active ? 1 : -1)).map((thread) => `<li><a class="thread" href="#d-${club.id}--${thread.id}">${avatar(thread.by, 40)}<div style="min-width:0"><div class="thread__t">${esc(thread.title)}</div><div class="thread__s">Started by ${esc(Y.fullName(thread.by))} · last reply ${Y.lc(Y.ago(thread.active))}</div></div><span class="thread__n">${icon("msg", "i--sm")}${thread.posts.length}</span></a></li>`).join("")}</ul>` : `<div class="empty">No discussions yet.${club.joined ? " Start the first one." : ""}</div>`}
      </section>
      <section class="section">${sectionHead("Members", { sub: plural(club.memberCount, "member") })}<ul style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0 40px">${club.members.map((username) => personRow(username, username === club.owner ? "Runs this club" : undefined)).join("")}</ul></section>`
      : `<div class="empty" style="margin-top:40px">You have been invited to this club. Join it to see its picks, discussions, and members.</div>`}
    </div>`;
    return { html, title: club.name, ambient: lead?.backdrop ?? lead?.poster };
  };

  Y.views.thread = (clubId, threadId) => {
    const club = D.CLUBS.find((candidate) => candidate.id === clubId);
    const thread = club?.threads.find((candidate) => candidate.id === threadId);
    if (!thread) return Y.views.missing();
    const html = `<div class="page page--narrow">
      <a class="crumb" href="#c-${club.id}">${icon("chev-l", "i--sm")}${esc(club.name)}</a>
      <header class="ph" style="margin-top:14px"><div class="ph__text"><h1 class="d2">${esc(thread.title)}</h1><p class="dim">${plural(thread.posts.length - 1, "reply", "replies")} · started ${Y.lc(Y.ago(thread.at))}</p></div></header>
      <ol>${thread.posts.map((message, i) => `<li class="msg${i === 0 ? " msg--first" : ""}">${avatar(message.by, 44)}<div><div style="display:flex;align-items:baseline;gap:10px"><a href="#p-${message.by}"><b>${esc(Y.fullName(message.by))}</b></a><span class="hint">${Y.ago(message.at)}</span>${message.by === ME.username ? `<button type="button" class="hint link" style="margin-left:auto" data-act="toast" data-msg="Post deleted">Delete</button>` : ""}</div><p class="msg__body">${esc(message.body)}</p></div></li>`).join("")}</ol>
      ${club.joined ? `<form class="composer" style="margin-top:14px" data-act-submit="reply" data-club="${club.id}" data-thread="${thread.id}">${avatar(ME.username, 40)}<div style="flex:1;min-width:0"><label class="sr" for="reply-text">Your reply</label><textarea id="reply-text" placeholder="Add to the discussion" required></textarea><div class="composer__bar"><span class="hint">Posts cannot be edited after sending.</span><button class="btn btn--primary btn--sm" type="submit">Reply</button></div></div></form>` : `<div class="note" style="margin-top:20px">${icon("info")}<span>Join ${esc(club.name)} to reply.</span></div>`}
    </div>`;
    return { html, title: thread.title };
  };

  // ---------- lists ----------
  function listTile(list) {
    const lead = C[list.items[0]?.key];
    return `<a class="tile toned" href="#l-${list.id}" style="${lead ? Y.toneOf(lead) : ""}">
      <div class="tile__art">${list.items.slice(0, 4).map(({ key }) => thumb(C[key], { link: false })).join("")}</div>
      <div><h3 class="d3">${esc(list.name)}</h3>${list.description ? `<p class="dim" style="margin-top:6px;font-size:14px">${esc(list.description)}</p>` : ""}</div>
      <div class="tile__foot"><span>${plural(list.items.length, "title")}${list.by === ME.username ? "" : ` · by ${esc(Y.fullName(list.by))}`}</span>${visChip(list.visibility)}</div>
    </a>`;
  }
  Y.views.lists = () => ({
    title: "Lists",
    html: `<div class="page">
      <header class="ph"><div class="ph__text"><h1 class="d2">Lists</h1><p class="lede">Any mix of movies, shows, games, and books, in the order you put them.</p></div>
        <div class="ph__actions"><button type="button" class="btn btn--primary" data-act="modal" data-modal="new-list">${icon("plus")}New list</button></div></header>
      <section>${sectionHead("Yours")}<div class="tiles">${D.LISTS.filter((list) => list.by === ME.username).map(listTile).join("")}</div></section>
      <section class="section">${sectionHead("From people you follow")}<div class="tiles">${D.LISTS.filter((list) => list.by !== ME.username).map(listTile).join("")}</div></section>
    </div>`,
  });
  Y.views.list = (id) => {
    const list = D.LISTS.find((candidate) => candidate.id === id);
    if (!list) return Y.views.missing();
    const mine = list.by === ME.username;
    const lead = C[list.items[0]?.key];
    const html = `<div class="page page--narrow toned" style="${lead ? Y.toneOf(lead) : ""}">
      <a class="crumb" href="#lists">${icon("chev-l", "i--sm")}Lists</a>
      <header class="ph" style="margin-top:14px">
        <div class="ph__text"><h1 class="d1">${esc(list.name)}</h1>${list.description ? `<p class="lede">${esc(list.description)}</p>` : ""}
          <div class="tile__meta" style="margin-top:4px">${avatar(list.by, 26)}<span>${mine ? "Your list" : `By <a class="link" href="#p-${list.by}">${esc(Y.fullName(list.by))}</a>`} · ${plural(list.items.length, "title")}</span>${visChip(list.visibility)}</div></div>
        ${mine ? `<div class="ph__actions"><button type="button" class="btn btn--soft" data-act="copy" data-text="yousiverse.app/lists/${list.id}">${icon("link")}Copy link</button><button type="button" class="btn btn--soft" data-act="toast" data-msg="Name, description, and who can see it are edited here">${icon("pencil")}Edit</button></div>` : ""}
      </header>
      <ol>${list.items.map(({ key, note }, i) => `<li class="rank"><span class="rank__n">${i + 1}</span>${thumb(C[key])}<div style="min-width:0"><a class="row__title" href="#t-${key}" style="display:block;font-size:16.5px">${esc(C[key].title)}</a><div class="row__sub">${med(C[key].type)}<span>${C[key].year ?? ""}</span></div>${note ? `<p class="rank__note">${esc(note)}</p>` : ""}</div><div class="row__end">${score(D.ratings[key])}${mine ? `<button type="button" class="iconbtn iconbtn--sm" data-act="unlist" data-list="${list.id}" data-key="${key}" aria-label="Remove ${esc(C[key].title)} from this list">${icon("x", "i--sm")}</button>` : ""}</div></li>`).join("")}</ol>
      ${mine ? `<p class="hint" style="margin-top:18px">Add titles from their own pages. They appear here in the order you add them.</p>` : ""}
    </div>`;
    return { html, title: list.name, ambient: lead?.backdrop ?? lead?.poster };
  };

  // ---------- profiles ----------
  function libraryOf(username) {
    if (username === ME.username) return Object.keys(D.library).filter((key) => D.library[key].visibility === "public").map((key) => ({ key, status: D.library[key].status, rating: D.ratings[key] ?? null }));
    return Object.keys(C).map((key) => ({ key, rating: D.friendRatings(key)[username] })).filter((entry) => entry.rating).map((entry) => ({ key: entry.key, status: "finished", rating: Math.round(entry.rating * 4) }));
  }
  Y.views.profile = (username) => {
    const who = Y.person(username);
    if (!who) return Y.views.missing();
    const mine = username === ME.username;
    const entries = libraryOf(username);
    const rated = entries.filter((entry) => entry.rating !== null);
    const tab = S.profileTab[username] ?? "library";
    const byType = (type) => rated.filter((entry) => C[entry.key].type === type);
    const mean = (list) => (list.length ? (list.reduce((sum, entry) => sum + entry.rating, 0) / list.length / 4).toFixed(1) : "–");
    const bins = Array.from({ length: 21 }, (_, i) => rated.filter((entry) => Math.round(entry.rating / 2) === i).length);
    const peak = Math.max(...bins, 1);
    const top = [...rated].sort((a, b) => b.rating - a.rating).slice(0, 10);
    const followers = mine ? Object.keys(PEOPLE).filter((name) => PEOPLE[name].followsYou) : ["sam", "mara", "priya", "theo"].filter((name) => name !== username && (name !== ME.username || who.following));
    const following = mine ? Object.keys(PEOPLE).filter((name) => PEOPLE[name].following) : ["mara", "lena", "jonas", "sam"].filter((name) => name !== username && (name !== ME.username || who.followsYou));
    const shared = mine ? [] : rated.filter((entry) => D.ratings[entry.key]);
    const match = shared.length ? Math.round(100 - (shared.reduce((sum, entry) => sum + Math.abs(entry.rating - D.ratings[entry.key]), 0) / shared.length / 40) * 260) : null;
    const bothLoved = shared.filter((entry) => entry.rating >= 34 && D.ratings[entry.key] >= 34).slice(0, 5);
    const theirReviews = Object.keys(C).flatMap((key) => (mine ? (D.MY_REVIEWS[key] && D.MY_REVIEWS[key].visibility === "public" ? [{ key, ...D.MY_REVIEWS[key] }] : []) : D.reviewsFor(key).filter((review) => review.by === username).map((review) => ({ key, ...review }))));
    const lists = D.LISTS.filter((list) => list.by === username && (mine ? list.visibility === "public" : list.visibility !== "private"));
    const tabs = [["library", "Library", entries.length], ["reviews", "Reviews", theirReviews.length], ["lists", "Lists", lists.length], ["following", "Following", following.length], ["followers", "Followers", followers.length]];

    let body = "";
    if (tab === "library") body = `<div class="wall">${entries.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 36).map((entry) => card(C[entry.key], { meta: `${score(entry.rating)}<span>${statusLabel(entry.status, C[entry.key].type)}</span>` })).join("")}</div>`;
    if (tab === "reviews") body = theirReviews.length ? `<ul style="max-width:760px">${theirReviews.map((review) => `<li class="review">${thumb(C[review.key])}<div><div class="review__who"><a href="#t-${review.key}">${esc(C[review.key].title)}</a></div><div class="review__when">${med(C[review.key].type)} · ${Y.ago(review.at)}</div></div><div class="review__num">${review.rating}</div><p class="review__body">${esc(review.body)}</p></li>`).join("")}</ul>` : `<div class="empty">No reviews yet.</div>`;
    if (tab === "lists") body = lists.length ? `<div class="tiles">${lists.map(listTile).join("")}</div>` : `<div class="empty">No lists yet.</div>`;
    if (tab === "following" || tab === "followers") body = `<ul style="max-width:560px">${(tab === "following" ? following : followers).map((name) => personRow(name)).join("")}</ul><p class="hint" style="margin-top:14px">Who follows whom is public. People without a username are counted but not named.</p>`;

    const html = `<div class="page">
      <header class="prof">
        ${avatar(username)}
        <div><h1 class="d2">${esc(who.name)}</h1><p class="dim" style="margin-top:6px">@${username} · joined ${Y.fmt(who.joined, { month: "long", year: "numeric" })}</p>
          <div class="prof__counts"><button type="button" data-act="ptab" data-user="${username}" data-value="followers"><b>${followers.length}</b> followers</button><button type="button" data-act="ptab" data-user="${username}" data-value="following"><b>${following.length}</b> following</button>${!mine && who.following && who.followsYou ? `<span class="chip chip--good">${icon("check", "i--sm")}Friends</span>` : !mine && who.followsYou ? '<span class="chip">Follows you</span>' : ""}</div></div>
        <div class="ph__actions">${mine ? `<a class="btn btn--soft" href="#account">${icon("pencil")}Edit profile</a>` : followButton(username).replace("btn--sm", "")}</div>
      </header>
      ${mine ? `<div class="note" style="margin-top:22px">${icon("globe")}<span>This is your profile as everyone sees it. Friends also see what you marked friends only, and nobody sees what you marked private.</span></div>` : ""}
      ${match !== null ? `<div class="match" style="margin-top:26px"><i class="ring" style="--v:${match}"></i><div><b>${match}% in tune</b><div class="hint" style="margin-top:4px">across the ${plural(shared.length, "title")} you have both rated</div></div>${bothLoved.length ? `<div style="margin-left:auto;display:flex;align-items:center;gap:14px"><span class="hint">You both loved</span><div class="fan">${bothLoved.map((entry) => thumb(C[entry.key])).join("")}</div></div>` : ""}</div>` : ""}
      <div class="taste">
        ${TYPES.map((type) => `<div><span class="med med--${type}">${icon(MEDIA[type].icon, "i--sm")}${MEDIA[type].label}</span><b>${entries.filter((entry) => C[entry.key].type === type).length}</b><small>average ${mean(byType(type))}</small></div>`).join("")}
        <div><span class="label">How ${mine ? "you rate" : `${esc(who.name.split(" ")[0])} rates`}</span><div class="histo">${bins.map((count) => `<i style="height:${Math.max(4, (count / peak) * 100)}%"></i>`).join("")}</div><div class="histo__ax"><span>0</span><span>5</span><span>10</span></div><small>${plural(rated.length, "rating")}, average ${mean(rated)}</small></div>
      </div>
      <section class="section">${sectionHead("Highest rated")}<div class="shelf">${top.map((entry) => card(C[entry.key], { meta: `${score(entry.rating)}<span>${C[entry.key].year ?? ""}</span>` })).join("")}</div></section>
      <section class="section">
        <div class="tabs" role="group" aria-label="Profile sections">${tabs.map(([value, label, count]) => `<button type="button" data-act="ptab" data-user="${username}" data-value="${value}" aria-pressed="${tab === value}">${label} <span class="n">${count}</span></button>`).join("")}</div>
        <div style="margin-top:30px">${body}</div>
      </section>
    </div>`;
    return { html, title: who.name };
  };

  // ---------- alerts ----------
  Y.views.alerts = () => {
    const fired = D.ALERTS.filter((alert) => alert.state === "fired");
    const waiting = D.ALERTS.filter((alert) => alert.state === "waiting");
    const waitingFor = (alert) => (alert.kind === "price" ? `${money(alert.target)} or less at a PC store` : alert.kind === "mine" ? `On ${[...D.subscriptions].join(", ")}` : "Streaming anywhere, on a subscription or free");
    const html = `<div class="page">
      <header class="ph"><div class="ph__text"><h1 class="d2">Alerts</h1><p class="lede">Checked every morning. Each alert tells you once, then stays here until you remove it or set it again.</p></div></header>
      <div class="split">
        <div>
          <section>${sectionHead("Came through", { sub: plural(fired.length, "alert") })}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px">${fired.map((alert) => Y.cameCard(alert).replace('class="came toned"', 'class="came toned" data-flat')).join("")}</div></section>
          <section class="section">${sectionHead("Still waiting", { sub: plural(waiting.length, "alert") })}
            <ul>${waiting.map((alert) => {
              const title = C[alert.key];
              const gap = alert.kind === "price" ? `<div><div class="hint">Now <b class="mono" style="color:var(--fg)">${money(alert.price)}</b>, ${money(alert.price - alert.target)} to go</div><div class="bar" style="--v:${(alert.target / alert.price) * 100};margin-top:8px"><i></i></div></div>` : `<div class="hint">${title.date > TODAY ? `Opens ${Y.dateShort(title.date)}` : `Checked ${Y.lc(Y.ago(alert.checked))}`}</div>`;
              return `<li class="wait">${thumb(title)}<div style="min-width:0"><a class="row__title" href="#t-${title.key}" style="display:block;font-size:15.5px">${esc(title.title)}</a><div class="row__sub">${icon(alert.kind === "price" ? "tag" : "play", "i--sm")}<span>${waitingFor(alert)}</span></div></div>${gap}<button type="button" class="iconbtn iconbtn--sm" data-act="remove-alert" data-key="${alert.key}" aria-label="Remove the alert for ${esc(title.title)}">${icon("x", "i--sm")}</button></li>`;
            }).join("")}</ul>
            <p class="hint" style="margin-top:16px">Set an alert from any movie, show, or game page.</p>
          </section>
        </div>
        <aside style="display:flex;flex-direction:column;gap:18px">
          <div class="panel"><div class="kv" style="padding:0"><div><b>Email me</b><p>One email a morning with everything that came through, to ${esc(ME.email)}.</p></div><button type="button" class="switch" role="switch" aria-checked="${S.emailAlerts}" aria-label="Alert emails" data-act="email-alerts"></button></div></div>
          <div class="panel"><div class="panel__head"><h3 class="label">Alerts in use</h3><span class="mono hint">${D.ALERTS.length} of 100</span></div><div class="bar" style="--v:${D.ALERTS.length}"><i></i></div></div>
          <div class="note">${icon("clock")}<span>Availability is checked for up to 60 movies and shows a day, the longest unchecked first. With more than that waiting, each is checked less often.</span></div>
        </aside>
      </div>
    </div>`;
    return { html, title: "Alerts" };
  };

  // ---------- import ----------
  const SOURCES = {
    letterboxd: { name: "Letterboxd", brings: "Films you watched, ratings, reviews, and your watchlist", how: "In Letterboxd, open Settings, then Data, and choose Export your data. Unzip the download and pick watched.csv, ratings.csv, reviews.csv, and watchlist.csv.", input: "files" },
    imdb: { name: "IMDb", brings: "Rated films and shows, and your watchlist", how: "In IMDb, open Your ratings or Your watchlist, and choose Export from the menu. Pick the CSV files it downloads.", input: "files" },
    goodreads: { name: "Goodreads", brings: "Shelves, ratings, and reviews", how: "In Goodreads, open My Books, then Import and export, and choose Export library.", input: "files" },
    storygraph: { name: "StoryGraph", brings: "Books read, ratings, and reviews", how: "In StoryGraph, open Manage account, then Manage your data, and choose Export StoryGraph library.", input: "files" },
    steam: { name: "Steam", brings: "Every game on your account", how: "Your profile's game details must be public. Games you never played go in as wanted; you choose a status for the rest.", input: "Steam profile address or ID" },
    trakt: { name: "Trakt", brings: "Watched history, ratings, and watchlist", how: "Your Trakt profile must be public. A show counts as finished once every aired episode has been played.", input: "Trakt username" },
  };
  Y.views.import = () => {
    const { source, state, done, visibility } = S.importer;
    const info = SOURCES[source];
    const total = 251;
    const counts = { added: Math.round(done * 0.85), kept: Math.round(done * 0.12), missed: Math.round(done * 0.03) };
    const running = `<section class="section">
      ${sectionHead(state === "done" ? `${info.name} import finished` : `Importing from ${info.name}`, { sub: state === "done" ? "Nothing you already had was changed." : "Matching runs while this page is open. Leave and come back, and it carries on." })}
      <div class="bar" style="--v:${(done / total) * 100};height:6px;margin-bottom:22px"><i></i></div>
      <div class="counts"><div><b>${counts.added}</b><span>Added to your library</span></div><div><b>${counts.kept}</b><span>Already there, left as they were</span></div><div><b>${counts.missed}</b><span>Could not be matched</span></div></div>
      ${state === "done" ? `<div style="margin-top:30px">${sectionHead("Could not be matched", { sub: "A match has to be confident, so anything doubtful is left for you." })}<ul>${["Solaris (1972)", "The Thing (1982)", "Stalker", "Dune (1984)", "Ran", "Late Spring", "Nausicaä of the Valley of the Wind", "Playtime"].slice(0, counts.missed).map((name) => `<li class="kv"><span>${name}</span><a class="btn btn--sm btn--soft" href="#search" data-act="search-for" data-q="${name.replace(/ \(.*/, "")}">${icon("search", "i--sm")}Search</a></li>`).join("")}</ul></div>
      <div style="display:flex;gap:10px;margin-top:26px"><a class="btn btn--primary" href="#library">Open your library</a><button type="button" class="btn btn--soft" data-act="import-reset">Import something else</button></div>` : ""}
    </section>`;
    const html = `<div class="page page--narrow">
      <header class="ph"><div class="ph__text"><h1 class="d2">Import</h1><p class="lede">Bring your history with you. An import never changes anything you already have here: a status, rating, or review you set is kept.</p></div></header>
      ${state !== "idle" ? running : `
      <div class="sources" role="group" aria-label="Import from">${Object.entries(SOURCES).map(([id, item]) => `<button type="button" class="source" data-act="import-source" data-value="${id}" aria-pressed="${source === id}"><b>${item.name}</b><span>${item.brings}</span></button>`).join("")}</div>
      <section class="section panel" style="padding:28px">
        <div class="steps">
          <div class="step"><div><h3>Get your data out of ${info.name}</h3><p class="dim">${info.how}</p></div></div>
          <div class="step"><div><h3>${info.input === "files" ? "Add the files" : `Enter your ${info.input}`}</h3>
            ${info.input === "files" ? `<label class="drop" for="import-files">${icon("upload", "i--lg")}<span><b>Drop the files here</b>, or choose them</span><span class="hint">CSV files, as ${info.name} names them</span><input id="import-files" type="file" multiple class="sr"></label>` : `<label class="sr" for="import-profile">${info.input}</label><input id="import-profile" class="input" placeholder="${source === "steam" ? "steamcommunity.com/id/yourname" : "yourname"}">`}</div></div>
          <div class="step"><div><h3>Who can see what is imported</h3><div class="seg" role="group" aria-label="Who can see what is imported">${Object.entries(VISIBILITY).map(([value, item]) => `<button type="button" data-act="import-vis" data-value="${value}" aria-pressed="${visibility === value}">${icon(item.icon, "i--sm")}${item.label}</button>`).join("")}</div></div></div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:28px;padding-top:22px;border-top:1px solid var(--line)"><button type="button" class="btn btn--primary btn--lg" data-act="import-start">Start import</button><span class="hint">In this mockup, the import runs on sample data.</span></div>
      </section>`}
    </div>`;
    return { html, title: "Import" };
  };

  // ---------- account ----------
  Y.views.account = () => {
    const html = `<div class="page">
      <header class="ph"><div class="ph__text"><h1 class="d2">Account</h1></div></header>
      <div class="set">
        <nav class="set__nav" aria-label="Account sections"><a href="#account" data-act="scroll-to" data-id="set-profile">Profile</a><a href="#account" data-act="scroll-to" data-id="set-subs">Subscriptions</a><a href="#account" data-act="scroll-to" data-id="set-look">Appearance</a><a href="#account" data-act="scroll-to" data-id="set-email">Emails</a><a href="#account" data-act="scroll-to" data-id="set-signin">Sign-in</a></nav>
        <div>
          <section class="set__sec" id="set-profile"><div><h2 class="d3">Profile</h2><p class="sh__sub">Your reviews and lists are credited to your username. Your email and Google name are never shown.</p></div>
            <div style="display:flex;align-items:center;gap:18px">${avatar(ME.username, 72)}<p class="hint" style="max-width:40ch">Your picture is drawn from your name. Everyone gets one, and nobody has to upload anything.</p></div>
            <div class="formrow"><div class="field"><label for="set-name">Display name</label><input class="input" id="set-name" value="${esc(ME.name)}"></div><div class="field"><label for="set-user">Username</label><input class="input" id="set-user" value="${ME.username}"><span class="hint">yousiverse.app/u/${ME.username}</span></div></div>
            <div style="display:flex;gap:10px"><button type="button" class="btn btn--primary" data-act="toast" data-msg="Profile saved">Save profile</button><a class="btn btn--soft" href="#p-${ME.username}">View your profile</a></div>
          </section>
          <section class="set__sec" id="set-subs"><div><h2 class="d3">Subscriptions</h2><p class="sh__sub">Tick the services you pay for. Movie and show pages then put what you can already watch first. Only you can see this.</p></div>
            <div class="subs">${D.SUBSCRIPTION_SERVICES.map((name) => `<button type="button" class="svc" data-act="sub" data-name="${esc(name)}" aria-pressed="${D.subscriptions.has(name)}">${Y.svcMark(name)}${esc(name)}${icon("check", "i--sm")}</button>`).join("")}</div>
          </section>
          <section class="set__sec" id="set-look"><div><h2 class="d3">Appearance</h2></div>
            <div class="seg" role="group" aria-label="Appearance"><button type="button" data-act="mode" data-value="night" aria-pressed="${document.documentElement.dataset.mode === "night"}">${icon("moon", "i--sm")}Night</button><button type="button" data-act="mode" data-value="day" aria-pressed="${document.documentElement.dataset.mode === "day"}">${icon("sun", "i--sm")}Day</button></div>
          </section>
          <section class="set__sec" id="set-email"><div><h2 class="d3">Emails</h2></div>
            <div class="kv"><div><b>Alert emails</b><p>One email a morning when something you are waiting for comes through. With this off, alerts still show on the Alerts page.</p></div><button type="button" class="switch" role="switch" aria-checked="${S.emailAlerts}" aria-label="Alert emails" data-act="email-alerts"></button></div>
          </section>
          <section class="set__sec" id="set-signin"><div><h2 class="d3">Sign-in</h2></div>
            <div><div class="kv"><span class="dim">Email</span><b>${esc(ME.email)}</b></div><div class="kv"><span class="dim">Joined</span><b>${Y.dateLong(ME.joined)}</b></div><div class="kv"><span class="dim">Signs in with</span><b>Google, or a link sent by email</b></div></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn--soft" data-act="signout">${icon("logout")}Sign out</button>${ME.reviewer ? `<a class="btn btn--soft" href="#link-review">${icon("shield")}Review franchise links</a>` : ""}</div>
          </section>
        </div>
      </div>
    </div>`;
    return { html, title: "Account" };
  };

  // ---------- search ----------
  Y.find = (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return { titles: [], people: [], lists: [], clubs: [], universes: [] };
    const hit = (text) => text.toLowerCase().includes(q);
    const rank = (title) => (title.title.toLowerCase().startsWith(q) ? 0 : 1) + (D.library[title.key] ? 0 : 0.5);
    return {
      titles: Object.values(C).filter((title) => hit(title.title) || title.authors?.some(hit)).sort((a, b) => rank(a) - rank(b)),
      people: Object.keys(PEOPLE).filter((username) => hit(username) || hit(PEOPLE[username].name)),
      lists: D.LISTS.filter((list) => hit(list.name) && (list.by === ME.username || list.visibility === "public")),
      clubs: D.CLUBS.filter((club) => hit(club.name) && (club.joined || club.access === "public")),
      universes: D.UNIVERSES.filter((universe) => hit(universe.name)),
    };
  };
  Y.views.search = () => {
    const { q, type } = S.search;
    const found = Y.find(q);
    const titles = found.titles.filter((title) => type === "all" || title.type === type);
    const count = (candidate) => found.titles.filter((title) => title.type === candidate).length;
    const html = `<div class="page">
      <header class="ph" style="margin-bottom:20px"><div class="ph__text" style="width:100%"><h1 class="sr">Search</h1>
        <label class="sr" for="search-q">Search</label>
        <div class="pal__in" style="border:1px solid var(--line-strong);border-radius:16px;background:var(--surface);height:64px">${icon("search", "i--lg")}<input id="search-q" type="search" value="${esc(q)}" placeholder="Movies, shows, games, books, and people" autocomplete="off" data-search-page style="font-size:19px"></div></div></header>
      ${q ? `
      <div class="tabs" role="group" aria-label="Medium"><button type="button" data-act="search-type" data-value="all" aria-pressed="${type === "all"}">Everything <span class="n">${found.titles.length}</span></button>${TYPES.map((candidate) => `<button type="button" data-act="search-type" data-value="${candidate}" aria-pressed="${type === candidate}"><span class="c-${candidate}" style="display:inline-flex">${icon(MEDIA[candidate].icon, "i--sm")}</span>${MEDIA[candidate].label} <span class="n">${count(candidate)}</span></button>`).join("")}</div>
      ${found.people.length && type === "all" ? `<section style="margin-top:30px">${sectionHead("People")}<ul style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:0 40px">${found.people.map((username) => personRow(username)).join("")}</ul></section>` : ""}
      ${found.universes.length && type === "all" ? `<section style="margin-top:36px">${sectionHead("Universes")}<div class="tiles">${found.universes.map(Y.universeTile).join("")}</div></section>` : ""}
      <section style="margin-top:36px">${titles.length ? `${sectionHead("Titles", { sub: "From TMDB, IGDB, and Open Library. Each source appears as soon as it answers." })}<div class="wall">${titles.map((title) => card(title, { meta: `${Y.yearMeta(title)}${title.authors ? `<span>${esc(title.authors[0])}</span>` : ""}`, check: true })).join("")}</div>` : `<div class="empty">Nothing matches “${esc(q)}”. Check the spelling, or try fewer words.</div>`}</section>`
      : `<div class="empty" style="margin-top:20px">Start typing to search every movie, show, game, and book, and the people here.<br><span class="hint">Press <span class="kbd">⌘K</span> from anywhere for the quick version.</span></div>`}
    </div>`;
    return { html, title: q ? `“${q}”` : "Search" };
  };

  // ---------- franchise link review (reviewers only) ----------
  const RELATION = { adapt: "was adapted as", sequel: "is followed by", same: "shares a universe with" };
  Y.views["link-review"] = () => {
    const open = D.SUGGESTIONS.filter((_, i) => !(i in S.resolved));
    const html = `<div class="page page--narrow">
      <a class="crumb" href="#account">${icon("chev-l", "i--sm")}Account</a>
      <header class="ph" style="margin-top:14px"><div class="ph__text"><span class="label">${icon("shield", "i--sm")} Reviewers only</span><h1 class="d2">Franchise links</h1><p class="lede">Suggestions come from Wikidata and stay hidden until one of you approves them. A rejected suggestion is not raised again.</p></div>
        <div class="ph__actions"><button type="button" class="btn btn--soft" data-act="toast" data-msg="Search for two titles to link them by hand">${icon("link")}Link two titles</button></div></header>
      <div class="sh"><h2 class="d3">${plural(open.length, "suggestion")} waiting</h2><span class="hint"><span class="kbd">A</span> approve &nbsp; <span class="kbd">R</span> reject</span></div>
      ${open.length ? D.SUGGESTIONS.map((suggestion, i) => (i in S.resolved ? "" : `<div class="pair">
          <div class="pair__t">${thumb(C[suggestion.a])}<div style="min-width:0"><a class="row__title" href="#t-${suggestion.a}" style="display:block;white-space:normal">${esc(C[suggestion.a].title)}</a><div class="row__sub">${med(C[suggestion.a].type)}<span>${C[suggestion.a].year}</span></div></div></div>
          <div class="pair__rel">${icon("arrow-r")}<span>${RELATION[suggestion.relation]}</span></div>
          <div class="pair__t">${thumb(C[suggestion.b])}<div style="min-width:0"><a class="row__title" href="#t-${suggestion.b}" style="display:block;white-space:normal">${esc(C[suggestion.b].title)}</a><div class="row__sub">${med(C[suggestion.b].type)}<span>${C[suggestion.b].year}</span></div></div></div>
          <div class="pair__act"><button type="button" class="btn btn--sm btn--primary" data-act="resolve" data-index="${i}" data-value="approved">${icon("check", "i--sm")}Approve</button><button type="button" class="btn btn--sm btn--soft" data-act="resolve" data-index="${i}" data-value="rejected">Reject</button></div>
        </div>`)).join("") : `<div class="empty">Nothing waiting. New suggestions arrive as titles are looked up.</div>`}
    </div>`;
    return { html, title: "Franchise links" };
  };

  // ---------- the front door ----------
  Y.views.welcome = () => {
    const pool = Object.values(C).filter((title) => title.poster && (title.sat ?? 0) > 25);
    const column = (offset) => {
      const picks = pool.filter((_, i) => i % 4 === offset).slice(0, 9);
      return `<div class="door__col">${[...picks, ...picks].map((title) => art(title, { link: false })).join("")}</div>`;
    };
    const cta = S.door === "sent"
      ? `<div class="sent"><h2 class="d3">Check your email</h2><p class="dim">We sent a sign-in link to <b style="color:var(--fg)">sam@example.com</b>. It works once, for the next 10 minutes.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn--primary" data-act="signin">Open the link (mockup)</button><button type="button" class="btn btn--soft" disabled style="opacity:.6">Send again in 30s</button></div><button type="button" class="hint link" style="align-self:flex-start" data-act="door" data-value="start">Use a different email</button></div>`
      : `<div class="door__cta">
          <button type="button" class="btn btn--primary btn--lg" data-act="signin">Continue with Google</button>
          <div class="door__or">or</div>
          <form data-act-submit="send-link" style="display:flex;gap:8px"><label class="sr" for="door-email">Email address</label><input class="input" id="door-email" type="email" placeholder="you@example.com" value="sam@example.com" required style="height:50px"><button class="btn btn--soft btn--lg" type="submit">Email me a link</button></form>
          <p class="hint">No password. The first link creates your account.</p>
        </div>`;
    const html = `<div class="door">
      <div class="door__copy">
        <a class="brand" href="#welcome" style="padding:0">${Y.logo()}<span>Yousiverse</span></a>
        <h1 class="d1" style="margin-top:20px">Everything you watch, play, and read. One universe.</h1>
        <p class="lede">Keep your movies, shows, games, and books in one library. Rate them to the quarter point, see where to watch them, and follow a story across every medium it touches.</p>
        ${cta}
        <ul class="door__points">
          <li>${icon("orbit")}<span><b style="color:var(--fg)">Follow the story, not the format.</b> The book, its film, the series, and the game sit on one map.</span></li>
          <li>${icon("play")}<span><b style="color:var(--fg)">Know where it is tonight.</b> Your own subscriptions first, with alerts when something arrives or a price drops.</span></li>
          <li>${icon("import")}<span><b style="color:var(--fg)">Bring your history.</b> Letterboxd, IMDb, Goodreads, StoryGraph, Steam, and Trakt.</span></li>
        </ul>
      </div>
      <div class="door__wall" aria-hidden="true">${[0, 1, 2, 3].map(column).join("")}</div>
      <div class="door__glow"></div>
    </div>`;
    return { html, title: "Welcome", bare: true };
  };
})();
