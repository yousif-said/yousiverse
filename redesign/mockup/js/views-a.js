// Screens, part one: Home, a title's page, an episode, Library, and story universes.
(() => {
  const Y = window.Y;
  const { C, D, S, TODAY, ME, MEDIA, TYPES, STATUSES, STATUS, VISIBILITY } = Y;
  const { esc, plural, icon, art, thumb, card, row, score, average, avatar, med, statusLabel, money, rating } = Y;

  const sectionHead = (title, { sub = "", more = "", id = "" } = {}) =>
    `<div class="sh"><div><h2 class="d3"${id ? ` id="${id}"` : ""}>${title}</h2>${sub ? `<p class="sh__sub">${sub}</p>` : ""}</div>${more}</div>`;
  const moreLink = (label, hash) => `<a class="sh__more" href="${hash}">${label}${icon("arrow-r", "i--sm")}</a>`;
  Y.sectionHead = sectionHead;
  Y.moreLink = moreLink;

  const svcMark = (name) => `<span class="svc__mark" style="--h:${D.SERVICES[name] ?? 40}">${esc(name[0])}</span>`;
  Y.svcMark = svcMark;

  /** The status control: one click puts a title in the library or moves it along. */
  function statusControl(title) {
    const current = D.library[title.key]?.status;
    return `<div class="status" role="group" aria-label="Your library">
      ${STATUSES.map((status) => `<button type="button" data-act="status" data-key="${title.key}" data-status="${status}" aria-pressed="${current === status}">${icon(STATUS[status].icon)}${statusLabel(status, title.type)}</button>`).join("")}
    </div>`;
  }

  /** The rating instrument: a ruler in quarter points, laid over how everyone else rated. */
  function dial(target, quarters, key, { friends = true } = {}) {
    const bars = D.distribution(key);
    const peak = Math.max(...bars, 0.001);
    const everyone = D.community(key);
    const friendRatings = friends ? D.friendRatings(key) : {};
    const friendValues = Object.values(friendRatings);
    const rated = quarters !== null && quarters !== undefined;
    return `<section class="dial toned" data-dial="${target}" aria-label="Your rating">
      <div class="dial__read">
        <span class="label">Your rating</span>
        <div class="dial__num${rated ? "" : " is-empty"}">${rated ? rating(quarters) : "–"}</div>
        <div class="dial__sub">
          <span class="dial__state">${rated ? "out of 10" : "Not rated yet"}</span>
          <span class="dial__saved">${icon("check", "i--sm")}Saved</span>
          <button type="button" data-act="clear-rating" ${rated ? "" : "hidden"}>Clear</button>
        </div>
      </div>
      <div class="dial__scale" role="slider" tabindex="0" aria-label="Your rating out of 10" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${rated ? quarters / 4 : 0}" aria-valuetext="${rated ? `${rating(quarters)} out of 10` : "Not rated"}">
        <div class="dial__friends">${Object.entries(friendRatings).map(([username, value]) => `<a href="#p-${username}" style="position:absolute;left:${value * 10}%" title="${esc(Y.fullName(username))} rated it ${value}">${avatar(username)}</a>`).join("")}</div>
        <div class="dial__hist" style="left:-2.5%;right:-2.5%">${bars.map((value, i) => `<i style="height:${Math.max(3, (value / peak) * 100)}%" class="${rated && i / 2 <= quarters / 4 ? "on" : ""}"></i>`).join("")}</div>
        <div class="dial__base"></div>
        <div class="dial__ticks">${Array.from({ length: 41 }, (_, i) => `<i class="${i % 4 === 0 ? "whole" : i % 2 === 0 ? "half" : ""}" style="left:${i * 2.5}%"></i>`).join("")}</div>
        <div class="dial__nums">${Array.from({ length: 11 }, (_, i) => `<span style="left:${i * 10}%">${i}</span>`).join("")}</div>
        <div class="dial__needle" style="left:${rated ? (quarters / 40) * 100 : 50}%" ${rated ? "" : "hidden"}></div>
      </div>
      <div class="dial__foot">
        ${everyone.average === null ? "<span>No ratings yet. It isn't out.</span>" : `<span>Everyone <b>${everyone.average.toFixed(1)}</b> from ${plural(everyone.count, "rating")}</span>`}
        ${friendValues.length ? `<span>People you follow <b>${(friendValues.reduce((a, b) => a + b, 0) / friendValues.length).toFixed(1)}</b> from ${friendValues.length}</span>` : ""}
        <span class="dimmer" style="margin-left:auto">Drag, click, or use the arrow keys</span>
      </div>
    </section>`;
  }
  Y.dial = dial;

  function whereToWatch(title) {
    const offers = D.streaming(title.key);
    const alertOn = (kind) => S.alertsOn[`${title.key}:${kind}`] ?? D.ALERTS.some((alert) => alert.key === title.key && alert.kind === kind && alert.state === "waiting");
    const alertButton = (kind, label) => `<button type="button" class="btn btn--sm ${alertOn(kind) ? "btn--primary" : "btn--soft"}" data-act="alert" data-key="${title.key}" data-kind="${kind}" aria-pressed="${alertOn(kind)}">${icon("bell", "i--sm")}${alertOn(kind) ? "Alert set" : label}</button>`;
    if (offers.unreleased) {
      return `<div class="offers toned">
        <div class="offers__now"><div><span class="label">${title.type === "movie" ? "In theaters" : "Premieres"}</span><div class="d3" style="margin-top:6px">${Y.dateLong(title.date)}</div><p>${Y.until(title.date)}. Streaming details appear once it is out.</p></div>
        ${alertButton("any", "Tell me when it can be streamed")}</div>
      </div>`;
    }
    const mine = offers.subscription.filter((name) => D.subscriptions.has(name));
    const others = offers.subscription.filter((name) => !D.subscriptions.has(name));
    const tile = (name, cents) => `<a class="svc" href="#" data-act="outbound" data-name="${esc(name)}">${svcMark(name)}${esc(name)}${cents ? `<span class="mono">${money(cents)}</span>` : ""}</a>`;
    const rows = [
      ["Subscription", others.map((name) => tile(name))],
      ["Free with ads", offers.free.map((name) => tile(name))],
      [title.type === "tv" ? "Buy an episode" : "Rent", (title.type === "tv" ? offers.buy : offers.rent).map(([name, cents]) => tile(name, cents))],
      [title.type === "tv" ? "" : "Buy", title.type === "tv" ? [] : offers.buy.map(([name, cents]) => tile(name, cents))],
    ].filter(([, tiles]) => tiles.length);
    return `<div class="offers toned">
      ${mine.length ? `<div class="offers__now">
          <div><span class="label">Included with your subscriptions</span><div class="d3" style="margin-top:6px">${mine.map(esc).join(" and ")}</div></div>
          <a class="btn btn--tone btn--lg" href="#" data-act="outbound" data-name="${esc(mine[0])}">${icon("play")}Watch on ${esc(mine[0])}</a>
        </div>` : `<div class="offers__now" style="background:none">
          <div><span class="label">Not on your subscriptions</span><p style="font-size:15px;color:var(--fg);margin-top:6px">${others.length ? `Streaming on ${others.map(esc).join(" and ")}.` : "Not streaming on a subscription right now."}</p></div>
          ${alertButton("mine", "Tell me when it's on mine")}
        </div>`}
      <dl>${rows.map(([label, tiles]) => `<div class="offers__row"><dt>${label}</dt><dd>${tiles.join("")}</dd></div>`).join("")}</dl>
      <div class="offers__foot"><span>US only${title.type === "tv" ? ", and prices are for one episode" : ""}. Checked today.</span><a class="link" href="#account">Your subscriptions</a></div>
    </div>`;
  }

  function whereToBuy(title) {
    const prices = D.gamePrices(title.key);
    if (prices.deals === null) return `<div class="note">${icon("info")}<span>No PC store sells this game, so there are no prices to show. Console prices are not covered yet.</span></div>`;
    if (prices.unreleased) return `<div class="offers toned"><div class="offers__now"><div><span class="label">Out</span><div class="d3" style="margin-top:6px">${Y.dateLong(title.date)}</div><p>${Y.until(title.date)}. Store prices appear at release.</p></div></div></div>`;
    const [bestStore, bestPrice] = prices.deals[0];
    const off = Math.round((1 - bestPrice / prices.regular) * 100);
    const mine = D.ALERTS.find((alert) => alert.key === title.key && alert.kind === "price");
    const target = (S.alertsOn[`${title.key}:price`] ?? mine?.target) || null;
    const lo = Math.min(prices.low, target ?? prices.low) * 0.9;
    const span = prices.regular - lo;
    const at = (cents) => `${Y.clamp(((cents - lo) / span) * 100, 4, 96)}%`;
    return `<div class="offers toned">
      <div class="offers__now">
        <div><span class="label">Cheapest right now</span><div class="d3" style="margin-top:6px"><span class="mono" style="font-family:var(--display)">${money(bestPrice)}</span> at ${esc(bestStore)}</div><p>${off > 0 ? `${off}% off the usual ${money(prices.regular)}.` : "Full price everywhere today."} The lowest it has ever been is ${money(prices.low)}.</p></div>
        <a class="btn btn--tone btn--lg" href="#" data-act="outbound" data-name="${esc(bestStore)}">${icon("ext")}Open ${esc(bestStore)}</a>
      </div>
      ${prices.deals.map(([store, cents]) => `<a class="deal" href="#" data-act="outbound" data-name="${esc(store)}"><span class="svc" style="background:none;padding-left:0">${svcMark(store)}${esc(store)}</span>${cents < prices.regular ? `<span class="deal__was">${money(prices.regular)}</span>` : "<span></span>"}<span class="deal__price">${money(cents)}</span></a>`).join("")}
      <div style="padding:16px 22px 6px;border-top:1px solid var(--line)">
        <div class="pricebar"><div class="pricebar__line"></div>
          <span class="pricebar__pt" style="left:${at(prices.low)}">Lowest ever ${money(prices.low)}</span>
          ${target ? `<span class="pricebar__pt goal" style="left:${at(target)};top:-13px;flex-direction:column-reverse">Your alert ${money(target)}</span>` : ""}
          <span class="pricebar__pt now" style="left:${at(bestPrice)};top:-13px;flex-direction:column-reverse${target ? ";display:none" : ""}">Now ${money(bestPrice)}</span>
        </div>
      </div>
      <div class="offers__foot">
        <span>US PC stores. Console prices are not covered yet.</span>
        ${target ? `<button type="button" class="btn btn--sm btn--primary" data-act="price-alert" data-key="${title.key}" aria-pressed="true">${icon("bell", "i--sm")}Alert at ${money(target)}</button>` : `<button type="button" class="btn btn--sm btn--soft" data-act="price-alert" data-key="${title.key}" data-target="${Math.round((bestPrice * 0.8) / 100) * 100 - 1}">${icon("bell", "i--sm")}Tell me at ${money(Math.round((bestPrice * 0.8) / 100) * 100 - 1)}</button>`}
      </div>
    </div>`;
  }

  function episodes(title) {
    const seasons = Y.seasonsOf(title).filter((season) => season.eps.length);
    if (!seasons.length) return "";
    const mineAt = D.library[title.key]?.progress?.season;
    const selected = S.season[title.key] ?? mineAt ?? seasons[seasons.length - 1].n;
    const season = seasons.find((candidate) => candidate.n === selected) ?? seasons[0];
    const columns = Math.max(...seasons.map((candidate) => candidate.eps.length));
    const heat = seasons.length > 12 ? "" : `<div class="heat toned" style="--cols:${columns}">
      <div class="heat__row heat__head"><span></span>${Array.from({ length: columns }, (_, i) => `<span style="text-align:center">${i + 1}</span>`).join("")}</div>
      ${seasons.map((candidate) => `<div class="heat__row"><span>S${candidate.n}</span>${candidate.eps.map((episode) => {
        if (!Y.aired(episode)) return `<a class="heat__cell none" href="#e-${title.key}-${candidate.n}-${episode.n}" title="${esc(episode.name)}${episode.date ? `, ${Y.dateShort(episode.date)}` : ""}">·</a>`;
        const value = D.episodeAverage(title.key, candidate.n, episode.n, candidate.eps.length);
        const q = Y.clamp((value - 7.2) / 2.4, 0, 1);
        const mine = D.episodeRatings[`${title.key}-${candidate.n}-${episode.n}`];
        return `<a class="heat__cell${q > 0.52 ? " hi" : ""}${mine ? " mine" : ""}" style="--q:${q.toFixed(2)}" href="#e-${title.key}-${candidate.n}-${episode.n}" title="${esc(episode.name)}: everyone ${value}${mine ? `, you ${rating(mine)}` : ""}">${value.toFixed(1)}</a>`;
      }).join("")}</div>`).join("")}
    </div>
    <div class="heat__key toned"><span>Lower</span><i></i><span>Higher</span><span style="margin-left:14px">Everyone's average for each episode. A white underline marks the ones you rated.</span></div>`;

    const hasStills = season.eps.some((episode) => episode.still);
    return `<section aria-labelledby="episodes-h">
      ${Y.sectionHead("Episodes", { id: "episodes-h", sub: `${plural(seasons.length, "season")}, ${plural(seasons.reduce((n, candidate) => n + candidate.eps.length, 0), "episode")}` })}
      ${heat}
      <div class="toolbar" style="margin:28px 0 6px">
        <div class="seg seg--sm" role="group" aria-label="Season">${seasons.map((candidate) => `<button type="button" data-act="season" data-key="${title.key}" data-season="${candidate.n}" aria-pressed="${candidate.n === season.n}">Season ${candidate.n}</button>`).join("")}</div>
      </div>
      <ol class="eps">${season.eps.map((episode) => {
        const id = `${title.key}-${season.n}-${episode.n}`;
        const mine = D.episodeRatings[id];
        const out = Y.aired(episode);
        const watched = Y.isWatched(title.key, season.n, episode.n);
        return `<li class="ep" ${hasStills ? "" : 'style="grid-template-columns:30px minmax(0,1fr) auto"'}>
          <span class="ep__n">${episode.n}</span>
          ${hasStills ? `<a class="ep__still" href="#e-${id}" tabindex="-1" aria-hidden="true">${episode.still ? `<img src="${episode.still}" alt="" loading="lazy">` : ""}</a>` : ""}
          <div style="min-width:0">
            <a class="ep__name" href="#e-${id}">${esc(episode.name)}</a>
            <div class="ep__sub"><span>${episode.date ? Y.dateLong(episode.date) : "Date to be announced"}</span>${episode.min ? `<span>${Y.runtime(episode.min)}</span>` : ""}${out ? average(D.episodeAverage(title.key, season.n, episode.n, season.eps.length)) : ""}</div>
            ${episode.overview ? `<p class="ep__text">${esc(episode.overview)}</p>` : ""}
          </div>
          <div class="ep__end">
            ${mine ? score(mine, "mine", true) : out ? `<a class="btn btn--sm btn--ghost" href="#e-${id}">Rate</a>` : `<span class="chip chip--line">${Y.until(episode.date ?? TODAY)}</span>`}
            ${out ? `<button type="button" class="tick" data-act="watched" data-id="${id}" aria-pressed="${watched}" aria-label="${watched ? "Watched" : "Mark watched"}: episode ${episode.n}">${icon("check")}</button>` : ""}
          </div>
        </li>`;
      }).join("")}</ol>
    </section>`;
  }

  function universeStrip(title) {
    const universe = Y.universeOf(title.key);
    if (!universe) return "";
    const nodes = universe.nodes.map((key) => C[key]).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
    const done = nodes.filter((node) => D.library[node.key]?.status === "finished").length;
    return `<section aria-labelledby="universe-h">
      ${Y.sectionHead(`The ${esc(universe.name)} universe`, { id: "universe-h", sub: `${plural(nodes.length, "title")} across ${plural(new Set(nodes.map((node) => node.type)).size, "medium", "mediums")}. You have finished ${done}.`, more: Y.moreLink("See the map", `#u-${universe.id}`) })}
      <div class="uni toned">${nodes.map((node) => `<div class="uni__node${node.key === title.key ? " here" : ""}">
          <span class="label uni__rel">${node.key === title.key ? "You are here" : Y.relationTo(universe, title.key, node.key)}</span>
          <span class="uni__rail"></span>
          ${card(node, { meta: Y.yearMeta(node), check: true })}
        </div>`).join("")}</div>
    </section>`;
  }

  function reviewItem(review, { friend = false, mine = false } = {}) {
    const who = mine ? ME.username : review.by;
    return `<li class="review${friend || mine ? " review--friend" : ""}">
      ${avatar(who, 40)}
      <div><div class="review__who">${who ? `<a href="#p-${who}">${esc(Y.fullName(who))}</a>` : "A Yousiverse member"}${friend ? ' <span class="chip" style="margin-left:6px">Following</span>' : ""}${mine ? ` <span class="chip" style="margin-left:6px">${icon(VISIBILITY[review.visibility].icon, "i--sm")}${VISIBILITY[review.visibility].label}</span>` : ""}</div><div class="review__when">${Y.ago(review.at)}</div></div>
      <div class="review__num">${review.rating}</div>
      <p class="review__body">${esc(review.body)}</p>
      ${mine ? `<div style="grid-column:2/-1;display:flex;gap:8px;margin-top:6px"><button type="button" class="btn btn--sm btn--soft" data-act="toast" data-msg="Your review opens for editing here">${icon("pencil", "i--sm")}Edit</button><button type="button" class="btn btn--sm btn--ghost" data-act="toast" data-msg="Review deleted">Delete</button></div>` : ""}
    </li>`;
  }
  function reviews(target, key) {
    const all = D.reviewsFor(key);
    const mine = target.startsWith("t:") ? (S.posted[key] ?? D.MY_REVIEWS[key]) : S.posted[target];
    const following = all.filter((review) => review.by && Y.PEOPLE[review.by]?.following);
    const others = all.filter((review) => !following.includes(review));
    return `<section aria-labelledby="reviews-h">
      ${Y.sectionHead("Reviews", { id: "reviews-h", sub: all.length + (mine ? 1 : 0) ? `${plural(all.length + (mine ? 1 : 0), "review")}. People you follow come first.` : "" })}
      ${mine ? "" : `<form class="composer" data-act-submit="post-review" data-target="${target}" data-key="${key}">
        ${avatar(ME.username, 40)}
        <div style="flex:1;min-width:0">
          <label class="sr" for="review-text">Your review</label>
          <textarea id="review-text" placeholder="What did you think?" required></textarea>
          <div class="composer__bar"><span class="hint">${icon("globe", "i--sm")} Everyone can read this. Change it after posting.</span><button class="btn btn--primary btn--sm" type="submit">Post review</button></div>
        </div>
      </form>`}
      <ul style="margin-top:${mine ? 0 : 10}px">
        ${mine ? reviewItem(mine, { mine: true }) : ""}
        ${following.map((review) => reviewItem(review, { friend: true })).join("")}
        ${others.map((review) => reviewItem(review)).join("")}
      </ul>
      ${all.length || mine ? "" : `<p class="dim" style="margin-top:18px">Nobody has reviewed this yet. Yours would be the first.</p>`}
    </section>`;
  }
  Y.reviews = reviews;

  function facts(title) {
    const rows = {
      movie: [["Released", title.date && Y.dateLong(title.date)], ["Runtime", title.runtime && Y.runtime(title.runtime)], ["Genres", title.genres?.join(", ")]],
      tv: [["First aired", title.date && Y.dateLong(title.date)], ["Status", title.status?.replace("Returning Series", "Returning")], ["Seasons", Y.seasonsOf(title).length || null], ["Genres", title.genres?.join(", ")]],
      game: [["Released", title.date && Y.dateLong(title.date)], ["Developer", title.developers?.join(", ")], ["Publisher", title.publishers?.join(", ")], ["Platforms", title.platforms?.join(", ")], ["Genres", title.genres?.join(", ")]],
      book: [["Author", title.authors?.join(", ")], ["First published", title.year], ["Length", title.pages && `${title.pages} pages`], ["Subjects", title.genres?.join(", ")]],
    }[title.type].filter(([, value]) => value);
    const source = { movie: "TMDB", tv: "TMDB", game: "IGDB", book: "Open Library" }[title.type];
    return `<div class="panel"><div class="panel__head"><h3 class="label">Details</h3></div><dl class="facts">${rows.map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`).join("")}</dl><p class="hint" style="margin-top:14px">From ${source}</p></div>`;
  }

  function friendsPanel(title) {
    const ratings = Object.entries(D.friendRatings(title.key));
    if (!ratings.length) return "";
    return `<div class="panel"><div class="panel__head"><h3 class="label">People you follow</h3><span class="hint">${ratings.length}</span></div>
      <ul class="rows" style="margin:0 -8px">${ratings.sort((a, b) => b[1] - a[1]).map(([username, value]) => `<li><a class="row" href="#p-${username}" style="grid-template-columns:auto minmax(0,1fr) auto;padding:7px 8px">${avatar(username)}<span class="row__title">${esc(Y.fullName(username))}</span>${score(value * 4, "mine")}</a></li>`).join("")}</ul></div>`;
  }

  function collectPanel(title) {
    const lists = D.LISTS.filter((list) => list.by === ME.username && list.items.some((item) => item.key === title.key));
    const clubs = D.CLUBS.filter((club) => club.joined && club.picks.some((pick) => pick.key === title.key));
    const canPick = D.CLUBS.some((club) => club.joined && club.types.includes(title.type));
    return `<div class="panel"><div class="panel__head"><h3 class="label">Lists and clubs</h3></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${lists.map((list) => `<a class="row" href="#l-${list.id}" style="grid-template-columns:auto minmax(0,1fr);padding:7px 8px;margin:0 -8px">${icon("list")}<span class="row__title">${esc(list.name)}</span></a>`).join("")}
        ${clubs.map((club) => `<a class="row" href="#c-${club.id}" style="grid-template-columns:auto minmax(0,1fr) auto;padding:7px 8px;margin:0 -8px">${icon("clubs")}<span class="row__title">${esc(club.name)}</span>${average(club.picks.find((pick) => pick.key === title.key).average)}</a>`).join("")}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:${lists.length || clubs.length ? 8 : 0}px">
          <button type="button" class="btn btn--sm btn--soft" data-act="modal" data-modal="add-to-list" data-key="${title.key}">${icon("plus", "i--sm")}Add to a list</button>
          ${canPick ? `<button type="button" class="btn btn--sm btn--soft" data-act="modal" data-modal="pick-for-club" data-key="${title.key}">${icon("clubs", "i--sm")}Pick for a club</button>` : ""}
        </div>
      </div></div>`;
  }

  // ---------- a title's page ----------
  Y.views.title = (key) => {
    const title = C[key];
    if (!title) return Y.views.missing();
    const entry = D.library[key];
    const everyone = D.community(key);
    const by = title.type === "book" ? title.authors?.join(" and ") : title.type === "game" ? title.developers?.join(" and ") : null;
    const meta = [
      med(title.type),
      title.type === "tv" && title.year ? `${title.year}${title.status === "Ended" ? "" : " to now"}` : (title.year ?? "Date to be announced"),
      title.type === "movie" && title.runtime ? Y.runtime(title.runtime) : null,
      title.type === "tv" ? plural(Y.seasonsOf(title).length, "season") : null,
      title.type === "book" && title.pages ? `${title.pages} pages` : null,
      title.type === "game" ? title.platforms?.slice(0, 4).join(", ") : null,
      title.genres?.slice(0, 2).join(", "),
    ].filter(Boolean);
    const plain = !title.backdrop;
    const progress = Y.progressOf(key);
    const hero = `<header class="hero night toned${plain ? " hero--plain" : ""}" style="${Y.toneOf(title)}">
      <div class="hero__bg"><img src="${title.backdrop ?? title.poster}" alt=""></div>
      <div class="hero__in${title.type === "tv" ? " hero__in--solo" : ""}">
        ${title.type === "tv" ? "" : art(title, { cls: "hero__art", link: false, eager: true })}
        <div style="min-width:0">
          <div class="hero__meta">${meta.join('<span class="sep"></span>')}</div>
          <h1 class="d1${title.title.length > 26 ? " long" : ""}">${esc(title.title)}</h1>
          ${by ? `<p class="hero__by">by ${esc(by)}</p>` : title.tagline ? `<p class="hero__tag">${esc(title.tagline)}</p>` : ""}
          <div class="hero__actions">
            ${statusControl(title)}
            ${entry ? `<button type="button" class="btn btn--ghost btn--sm" data-act="visibility" data-key="${key}" title="Who can see this in your library">${icon(VISIBILITY[entry.visibility].icon, "i--sm")}${VISIBILITY[entry.visibility].label}</button><button type="button" class="btn btn--ghost btn--sm" data-act="remove" data-key="${key}">Remove</button>` : ""}
          </div>
          ${progress ? `<div style="display:flex;align-items:center;gap:14px;margin-top:18px;max-width:440px"><span style="font-size:14px;font-weight:600;white-space:nowrap">${progress.text}</span>${progress.value === null ? "" : `<div class="bar" style="flex:1;--v:${progress.value}"><i></i></div>`}</div>` : ""}
          <div class="hero__stats">
            ${everyone.average === null ? `<div class="stat"><span class="label">${title.type === "game" ? "Out" : "In theaters"}</span><b>${Y.dateShort(title.date)}</b></div><div class="stat"><span class="label">Countdown</span><b>${Y.daysUntil(title.date)} days</b></div>` : `<div class="stat"><span class="label">Everyone</span><b><i class="ring" style="--v:${everyone.average * 10}"></i>${everyone.average.toFixed(1)}</b></div>`}
            ${Object.keys(D.friendRatings(key)).length ? `<div class="stat"><span class="label">People you follow</span><b><span class="avs">${Object.keys(D.friendRatings(key)).slice(0, 4).map((username) => avatar(username, 26)).join("")}</span></b></div>` : ""}
            ${Y.universeOf(key) ? `<a class="stat" href="#u-${Y.universeOf(key).id}"><span class="label">Universe</span><b>${icon("orbit", "i--lg")}${esc(Y.universeOf(key).name)}</b></a>` : ""}
          </div>
        </div>
      </div>
    </header>`;

    const html = `${hero}
      <div class="tgrid toned" style="${Y.toneOf(title)}">
        <div class="tmain">
          ${everyone.average === null ? "" : dial(`t:${key}`, D.ratings[key], key)}
          <section aria-label="About"><p class="prose">${esc(title.overview ?? "No description yet.")}</p></section>
          ${title.type === "movie" || title.type === "tv" ? `<section aria-labelledby="watch-h">${sectionHead("Where to watch", { id: "watch-h" })}${whereToWatch(title)}</section>` : ""}
          ${title.type === "game" ? `<section aria-labelledby="buy-h">${sectionHead("Where to buy", { id: "buy-h" })}${whereToBuy(title)}</section>` : ""}
          ${title.type === "tv" ? episodes(title) : ""}
          ${universeStrip(title)}
          ${everyone.average === null ? "" : reviews(`t:${key}`, key)}
        </div>
        <aside class="taside" aria-label="More about this title">
          ${facts(title)}
          ${friendsPanel(title)}
          ${collectPanel(title)}
          ${title.type === "book" ? `<div class="note">${icon("info")}<span>Book prices are not covered yet.</span></div>` : ""}
        </aside>
      </div>`;
    return { html, title: title.title, ambient: title.poster, flush: true };
  };

  // ---------- one episode ----------
  Y.views.episode = (key, seasonNumber, episodeNumber) => {
    const title = C[key];
    const season = title && Y.seasonsOf(title).find((candidate) => candidate.n === seasonNumber);
    const index = season ? season.eps.findIndex((candidate) => candidate.n === episodeNumber) : -1;
    if (index < 0) return Y.views.missing();
    const episode = season.eps[index];
    const id = `${key}-${seasonNumber}-${episodeNumber}`;
    const out = Y.aired(episode);
    const [previous, next] = [season.eps[index - 1], season.eps[index + 1]];
    const html = `<div class="page page--narrow toned" style="${Y.toneOf(title)}">
      <a class="crumb" href="#t-${key}">${icon("chev-l", "i--sm")}${esc(title.title)}</a>
      <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:28px;margin-top:18px">
        <div class="art art--tv" style="aspect-ratio:21/9;border-radius:22px"><img src="${episode.still ?? title.backdrop}" alt=""></div>
        <div class="ph" style="margin:0">
          <div class="ph__text">
            <span class="label">Season ${seasonNumber}, episode ${episodeNumber}</span>
            <h1 class="d2">${esc(episode.name)}</h1>
            <p class="dim">${[episode.date ? Y.dateLong(episode.date) : "Date to be announced", episode.min ? Y.runtime(episode.min) : null].filter(Boolean).join(" · ")}</p>
          </div>
          ${out ? `<div class="ph__actions"><button type="button" class="btn ${Y.isWatched(key, seasonNumber, episodeNumber) ? "btn--primary" : "btn--soft"}" data-act="watched" data-id="${id}" aria-pressed="${Y.isWatched(key, seasonNumber, episodeNumber)}">${icon("check")}${Y.isWatched(key, seasonNumber, episodeNumber) ? "Watched" : "Mark watched"}</button></div>` : ""}
        </div>
        ${out ? dial(`e:${id}`, D.episodeRatings[id], key, { friends: false }) : `<div class="note">${icon("clock")}<span>This episode airs ${Y.lc(Y.until(episode.date ?? TODAY))}. You can rate it once it is out.</span></div>`}
        ${episode.overview ? `<p class="prose">${esc(episode.overview)}</p>` : ""}
        <div style="display:flex;justify-content:space-between;gap:12px;padding-top:20px;border-top:1px solid var(--line)">
          ${previous ? `<a class="btn btn--soft" href="#e-${key}-${seasonNumber}-${previous.n}">${icon("chev-l", "i--sm")}Episode ${previous.n}</a>` : "<span></span>"}
          ${next ? `<a class="btn btn--soft" href="#e-${key}-${seasonNumber}-${next.n}">Episode ${next.n}${icon("chev-r", "i--sm")}</a>` : ""}
        </div>
        ${out ? `<section>${Y.sectionHead("Reviews of this episode")}<form class="composer" data-act-submit="post-review" data-target="e:${id}" data-key="${key}">${avatar(ME.username, 40)}<div style="flex:1;min-width:0"><label class="sr" for="review-text">Your review</label><textarea id="review-text" placeholder="What did you think of this one?" required></textarea><div class="composer__bar"><span class="hint">Episode reviews are separate from the show's.</span><button class="btn btn--primary btn--sm" type="submit">Post review</button></div></div></form>${S.posted[`e:${id}`] ? `<ul>${reviewItem(S.posted[`e:${id}`], { mine: true })}</ul>` : ""}</section>` : ""}
      </div>
    </div>`;
    return { html, title: `${title.title}: ${episode.name}`, ambient: episode.still ?? title.backdrop };
  };

  // ---------- home ----------
  Y.views.home = () => {
    const inProgress = Y.entriesOf("in_progress");
    const leadKey = inProgress.find((key) => C[key].type === "tv" && Y.nextEpisode(key) && Y.aired(Y.nextEpisode(key))) ?? inProgress[0];
    const lead = C[leadKey];
    const next = lead.type === "tv" ? Y.nextEpisode(leadKey) : null;
    const leadProgress = Y.progressOf(leadKey);
    const others = inProgress.filter((key) => key !== leadKey).slice(0, 3);

    const soon = [];
    for (const entry of Y.upcoming("library", "all")) {
      if (!soon.some((existing) => existing.title.key === entry.title.key)) soon.push(entry);
    }
    const ready = Y.entriesOf("want")
      .map((key) => ({ title: C[key], on: (D.streaming(key).subscription ?? []).filter((name) => D.subscriptions.has(name)) }))
      .filter(({ title, on }) => (title.type === "movie" || title.type === "tv") && on.length);
    const fired = D.ALERTS.filter((alert) => alert.state === "fired");
    const threads = D.CLUBS.filter((club) => club.joined).flatMap((club) => club.threads.map((thread) => ({ club, thread }))).sort((a, b) => (a.thread.active < b.thread.active ? 1 : -1)).slice(0, 3);
    const recommendation = D.RECOMMENDATIONS[2];
    const firstSoon = soon[0];
    const bigSoon = soon.find((entry) => entry.title.type === "movie");

    const html = `<div class="page">
      <header class="hello">
        <span class="label">${Y.fmt(TODAY, { weekday: "long", month: "long", day: "numeric" })}</span>
        <h1 class="d1">Good evening, ${esc(ME.name.split(" ")[0])}.</h1>
        <p class="lede">${next ? `Episode ${next.n} of <a class="link" href="#t-${leadKey}">${esc(lead.title)}</a> is next` : `You are partway through ${plural(inProgress.length, "thing")}`}${firstSoon ? `, <a class="link" href="#t-${firstSoon.title.key}">${esc(firstSoon.title.title)}</a> is back ${Y.lc(Y.until(firstSoon.date))}` : ""}${bigSoon ? `, and <a class="link" href="#t-${bigSoon.title.key}">${esc(bigSoon.title.title)}</a> opens in ${Y.daysUntil(bigSoon.date)} days` : ""}.</p>
      </header>

      <section class="resume" aria-label="Pick up where you left off">
        <div class="resume__main night toned" style="${Y.toneOf(lead)}">
          <img src="${lead.backdrop ?? lead.poster}" alt="">
          <div class="resume__body">
            <span class="label" style="color:var(--fg-2)">Pick up where you left off</span>
            <a href="#t-${leadKey}"><h2 class="d2">${esc(lead.title)}</h2></a>
            ${next ? `<p style="font-size:15.5px;color:var(--fg-2)">Season ${next.season}, episode ${next.n} · <span style="color:var(--fg)">${esc(next.name)}</span>${next.min ? ` · ${Y.runtime(next.min)}` : ""}</p>` : ""}
            ${leadProgress?.value !== null && leadProgress ? `<div class="bar" style="--v:${leadProgress.value};max-width:340px"><i></i></div>` : ""}
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
              ${next ? `<button type="button" class="btn btn--primary" data-act="watched" data-id="${leadKey}-${next.season}-${next.n}">${icon("check")}Mark episode ${next.n} watched</button><a class="btn btn--soft" href="#e-${leadKey}-${next.season}-${next.n}">Rate it</a>` : `<a class="btn btn--primary" href="#t-${leadKey}">Open</a>`}
            </div>
          </div>
        </div>
        <div class="resume__side">
          ${others.map((key) => {
            const progress = Y.progressOf(key);
            return `<a class="prog toned" href="#t-${key}" style="${Y.toneOf(C[key])}">${thumb(C[key], { link: false })}<div style="min-width:0"><div class="prog__t">${esc(C[key].title)}</div><div class="prog__s">${med(C[key].type, false)} ${progress?.text ?? statusLabel("in_progress", C[key].type)}</div>${progress?.value ? `<div class="bar" style="--v:${progress.value}"><i></i></div>` : ""}</div></a>`;
          }).join("")}
          <a class="sh__more" href="#library" data-act="lib-jump" data-status="in_progress" style="padding:4px 6px">All ${inProgress.length} in progress${icon("arrow-r", "i--sm")}</a>
        </div>
      </section>

      <section class="section" aria-labelledby="soon-h">
        ${sectionHead("Coming up for you", { id: "soon-h", sub: "From your library, in the next 90 days", more: moreLink("Calendar", "#calendar") })}
        <div class="shelf">${soon.slice(0, 8).map((entry) => `<div style="display:flex;flex-direction:column;gap:12px;flex:none">
            <div><span class="d3">${Y.daysUntil(entry.date) === 0 ? "Today" : Y.daysUntil(entry.date)}</span>${Y.daysUntil(entry.date) === 0 ? "" : ` <span class="label">${Y.daysUntil(entry.date) === 1 ? "day" : "days"}</span>`}<div class="hint" style="margin-top:2px">${Y.fmt(entry.date, { weekday: "short", month: "short", day: "numeric" })}</div></div>
            ${card(entry.title, { meta: entry.episode ? `<span>Season ${entry.season}, episode ${entry.episode.n}</span>` : `${med(entry.title.type, false)}<span>${entry.title.type === "movie" ? "In theaters" : "Release day"}</span>` })}
          </div>`).join("")}</div>
      </section>

      <section class="section" aria-labelledby="ready-h">
        ${sectionHead("Ready when you are", { id: "ready-h", sub: "From your want list, on services you already pay for", more: moreLink("Your subscriptions", "#account") })}
        <div class="shelf">${ready.map(({ title, on }) => card(title, { meta: `<span class="svc" style="height:26px;padding:0 9px 0 3px;font-size:12px;border-radius:8px">${svcMark(on[0]).replace('class="svc__mark"', 'class="svc__mark" style="width:20px;height:20px;border-radius:6px;font-size:10px;--h:' + (D.SERVICES[on[0]] ?? 40) + '"')}${esc(on[0])}</span>` })).join("")}</div>
      </section>

      <section class="section duo">
        <div>
          ${sectionHead("From people you follow", { more: moreLink("Feed", "#feed") })}
          <ul>${D.FEED.filter((item) => item.key).slice(0, 4).map((item) => `<li class="act">
              ${avatar(item.who, 38)}
              <div><p class="act__line">${Y.nameLink(item.who)} ${item.kind === "review" ? "reviewed" : Y.activity(item.status, C[item.key].type)} <a href="#t-${item.key}"><b>${esc(C[item.key].title)}</b></a>${item.rating ? ` &nbsp;${score(item.rating * 4, "mine")}` : ""}</p><p class="act__when">${Y.ago(item.at)}</p>${item.body ? `<p class="act__quote">“${esc(item.body)}”</p>` : ""}</div>
              ${thumb(C[item.key])}
            </li>`).join("")}</ul>
        </div>
        <div>
          ${sectionHead("Alerts that came through", { more: moreLink("All alerts", "#alerts") })}
          ${fired.map((alert) => Y.cameCard(alert)).join("")}
          <div style="margin-top:36px">${sectionHead("In your clubs", { more: moreLink("Clubs", "#clubs") })}
            <ul>${threads.map(({ club, thread }) => `<li><a class="thread" href="#d-${club.id}--${thread.id}" style="grid-template-columns:minmax(0,1fr) auto;padding:14px 4px"><div><div class="thread__t">${esc(thread.title)}</div><div class="thread__s">${esc(club.name)} · last reply ${Y.lc(Y.ago(thread.active))}</div></div><span class="thread__n">${icon("msg", "i--sm")}${thread.posts.length}</span></a></li>`).join("")}</ul>
          </div>
        </div>
      </section>

      <section class="section" aria-labelledby="rec-h">
        ${sectionHead(`Because you rated ${esc(C[recommendation.seed].title)} ${rating(D.ratings[recommendation.seed])}`, { id: "rec-h", more: moreLink("For you", "#for-you") })}
        <div class="shelf">${recommendation.keys.map((key) => card(C[key], { meta: `${Y.yearMeta(C[key])}${average(D.community(key).average)}` })).join("")}</div>
      </section>
    </div>`;
    return { html, title: "Home", ambient: lead.backdrop ?? lead.poster };
  };

  Y.activity = (status, type) => ({ want: { movie: "wants to watch", tv: "wants to watch", game: "wants to play", book: "wants to read" }, in_progress: { movie: "is watching", tv: "is watching", game: "is playing", book: "is reading" }, finished: { movie: "watched", tv: "finished", game: "finished", book: "finished" }, dropped: { movie: "dropped", tv: "dropped", game: "dropped", book: "dropped" } })[status][type];

  Y.cameCard = (alert) => {
    const title = C[alert.key];
    const text = alert.kind === "price" ? `${money(alert.price)} at ${esc(alert.store)}, under your ${money(alert.target)}` : `Now streaming on ${esc(alert.service)}, one of yours`;
    return `<div class="came toned" style="${Y.toneOf(title)}">${thumb(title)}<div style="min-width:0"><div class="came__t"><a href="#t-${title.key}">${esc(title.title)}</a></div><div class="came__s">${text} · ${Y.lc(Y.ago(alert.fired))}</div><a class="btn btn--sm btn--tone" href="#t-${title.key}">${icon(alert.kind === "price" ? "tag" : "play", "i--sm")}${alert.kind === "price" ? "See the deal" : `Watch on ${esc(alert.service)}`}</a></div></div>`;
  };

  // ---------- library ----------
  Y.views.library = () => {
    const { view, type, status, sort } = S.lib;
    const all = Object.keys(D.library);
    const ofType = all.filter((key) => type === "all" || C[key].type === type);
    const sorted = (keys) => [...keys].sort((a, b) => sort === "rating" ? (D.ratings[b] ?? -1) - (D.ratings[a] ?? -1) : sort === "title" ? C[a].title.localeCompare(C[b].title) : D.library[b].at > D.library[a].at ? 1 : -1);
    const count = (candidate) => all.filter((key) => C[key].type === candidate).length;
    const meta = (key) => {
      const entry = D.library[key];
      const progress = entry.status === "in_progress" ? Y.progressOf(key) : null;
      return `${score(D.ratings[key])}${progress ? `<span>${progress.text}</span>` : `<span>${C[key].year ?? ""}</span>`}${entry.visibility === "public" ? "" : `<span title="${VISIBILITY[entry.visibility].label}">${icon(VISIBILITY[entry.visibility].icon, "i--sm")}</span>`}`;
    };
    const wall = (keys) => `<div class="wall">${keys.map((key) => card(C[key], { meta: meta(key) })).join("")}</div>`;

    let body;
    if (view === "board") {
      body = `<div class="board">${STATUSES.map((column) => {
        const keys = sorted(ofType.filter((key) => D.library[key].status === column));
        return `<section class="board__col" data-drop="${column}" aria-label="${STATUS[column].label}">
          <div class="board__head"><span>${icon(STATUS[column].icon, "i--sm")} ${STATUS[column].label}</span><span class="mono">${keys.length}</span></div>
          ${keys.map((key) => row(C[key], { cls: "", attrs: `draggable="true" data-drag="${key}"`, sub: `${med(C[key].type, false)}<span>${C[key].year ?? ""}</span>`, end: score(D.ratings[key]) })).join("")}
        </section>`;
      }).join("")}</div><p class="hint" style="margin-top:14px">Drag a title to another column to change its status.</p>`;
    } else if (status === "all") {
      body = ["in_progress", "want", "finished", "dropped"].map((group) => {
        const keys = sorted(ofType.filter((key) => D.library[key].status === group));
        return keys.length ? `<section class="group"><div class="group__head"><h2 class="d3">${STATUS[group].label}</h2><span class="mono">${keys.length}</span></div>${wall(keys)}</section>` : "";
      }).join("");
    } else {
      const keys = sorted(ofType.filter((key) => D.library[key].status === status));
      body = keys.length ? wall(keys) : `<div class="empty">Nothing here matches these filters.</div>`;
    }

    const html = `<div class="page">
      <header class="ph">
        <div class="ph__text"><h1 class="d2">Library</h1><p class="lede">${plural(all.length, "title")}: ${TYPES.map((candidate) => `${count(candidate)} ${candidate === "tv" ? "shows" : MEDIA[candidate].label.toLowerCase()}`).join(", ")}.</p></div>
        <div class="ph__actions">
          <div class="seg seg--sm" role="group" aria-label="View"><button type="button" data-act="lib" data-field="view" data-value="grid" aria-pressed="${view === "grid"}">${icon("grid", "i--sm")}Shelves</button><button type="button" data-act="lib" data-field="view" data-value="board" aria-pressed="${view === "board"}">${icon("board", "i--sm")}Board</button></div>
          <a class="btn btn--soft btn--sm" href="#import">${icon("import", "i--sm")}Import</a>
        </div>
      </header>
      <div class="tabs" role="group" aria-label="Medium">
        <button type="button" data-act="lib" data-field="type" data-value="all" aria-pressed="${type === "all"}">Everything <span class="n">${all.length}</span></button>
        ${TYPES.map((candidate) => `<button type="button" data-act="lib" data-field="type" data-value="${candidate}" aria-pressed="${type === candidate}"><span class="c-${candidate}" style="display:inline-flex">${icon(MEDIA[candidate].icon, "i--sm")}</span>${MEDIA[candidate].label} <span class="n">${count(candidate)}</span></button>`).join("")}
      </div>
      <div class="toolbar">
        <div class="toolbar__group">${view === "board" ? "" : `<div class="seg seg--sm" role="group" aria-label="Status"><button type="button" data-act="lib" data-field="status" data-value="all" aria-pressed="${status === "all"}">Any status</button>${STATUSES.map((candidate) => `<button type="button" data-act="lib" data-field="status" data-value="${candidate}" aria-pressed="${status === candidate}">${STATUS[candidate].label}</button>`).join("")}</div>`}</div>
        <div class="toolbar__group"><span class="hint">Sort</span><div class="seg seg--sm" role="group" aria-label="Sort">${[["recent", "Recent"], ["rating", "Your rating"], ["title", "A to Z"]].map(([value, label]) => `<button type="button" data-act="lib" data-field="sort" data-value="${value}" aria-pressed="${sort === value}">${label}</button>`).join("")}</div></div>
      </div>
      ${body}
    </div>`;
    return { html, title: "Library" };
  };

  // ---------- universes ----------
  const universeProgress = (universe) => {
    const statuses = universe.nodes.map((key) => D.library[key]?.status);
    return { total: universe.nodes.length, finished: statuses.filter((status) => status === "finished").length, started: statuses.filter((status) => status === "in_progress").length, wanted: statuses.filter((status) => status === "want").length };
  };
  Y.universeTile = (universe) => {
    const progress = universeProgress(universe);
    const nodes = universe.nodes.map((key) => C[key]);
    const lead = nodes.find((node) => node.sat > 30) ?? nodes[0];
    return `<a class="tile toned" href="#u-${universe.id}" style="${Y.toneOf(lead)}">
      <div class="tile__art">${nodes.slice(0, 4).map((node) => thumb(node, { link: false })).join("")}</div>
      <div><h3 class="d3">${esc(universe.name)}</h3><p class="dim" style="margin-top:6px;font-size:14px">${esc(universe.blurb)}</p></div>
      <div class="tile__foot"><span style="display:inline-flex;gap:10px">${[...new Set(nodes.map((node) => node.type))].map((type) => med(type, false)).join("")}<span>${plural(progress.total, "title")}</span></span><span class="score score--mine"><i class="ring" style="--v:${(progress.finished / progress.total) * 100}"></i>${progress.finished} of ${progress.total}</span></div>
    </a>`;
  };

  Y.views.universes = () => ({
    title: "Universes",
    html: `<div class="page">
      <header class="ph"><div class="ph__text"><h1 class="d2">Universes</h1><p class="lede">A story rarely stays in one medium. These are the books, films, shows, and games that belong together, and how far through each you are.</p></div></header>
      <div class="tiles">${D.UNIVERSES.map(Y.universeTile).join("")}</div>
    </div>`,
  });

  Y.views.universe = (id) => {
    const universe = D.UNIVERSES.find((candidate) => candidate.id === id);
    if (!universe) return Y.views.missing();
    const nodes = universe.nodes.map((key) => C[key]);
    const years = [...new Set(nodes.map((node) => node.year))].sort((a, b) => a - b);
    const lanes = ["book", "movie", "tv", "game"].filter((type) => nodes.some((node) => node.type === type));
    const progress = universeProgress(universe);
    const lead = nodes.find((node) => node.backdrop && node.sat > 40) ?? nodes.find((node) => node.backdrop) ?? nodes[0];
    const inOrder = [...nodes].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
    const missing = nodes.filter((node) => !D.library[node.key]);
    const html = `<div class="page toned" style="${Y.toneOf(lead)}">
      <a class="crumb" href="#universes">${icon("chev-l", "i--sm")}Universes</a>
      <header class="ph" style="margin-top:14px">
        <div class="ph__text"><span class="label">${icon("orbit", "i--sm")} Story universe</span><h1 class="d1">${esc(universe.name)}</h1><p class="lede">${esc(universe.blurb)}</p></div>
        <div class="match"><i class="ring" style="--v:${(progress.finished / progress.total) * 100};--ring-c:var(--tone)"></i><div><b>${progress.finished} of ${progress.total}</b><div class="hint" style="margin-top:4px">finished${progress.started ? `, ${progress.started} in progress` : ""}${progress.wanted ? `, ${progress.wanted} wanted` : ""}</div></div>${missing.length ? `<button type="button" class="btn btn--sm btn--soft" data-act="want-all" data-universe="${universe.id}" style="margin-left:8px">${icon("plus", "i--sm")}Want the other ${missing.length}</button>` : ""}</div>
      </header>
      <div class="map" data-map="${universe.id}">
        <div class="map__grid" style="--cols:${years.length}">
          <span class="map__year"></span>${years.map((year) => `<span class="map__year">${year}</span>`).join("")}
          ${lanes.map((lane) => `<span class="map__lane c-${lane}">${icon(MEDIA[lane].icon, "i--sm")}<span style="color:var(--fg-2)">${MEDIA[lane].label}</span></span>${years.map((year) => {
            const here = nodes.filter((node) => node.type === lane && node.year === year);
            return `<div class="map__cell">${here.map((node) => `<a class="map__node" href="#t-${node.key}" data-node="${node.key}">${art(node, { link: false, check: true })}<span>${esc(node.title)}</span></a>`).join("")}</div>`;
          }).join("")}`).join("")}
          <svg class="map__edges" aria-hidden="true"></svg>
        </div>
      </div>
      <div class="legend"><span><i></i>Follows</span><span><i class="adapt"></i>Adapted as</span><span>Every link here was checked by a reviewer before it appeared.</span></div>

      <section class="section">
        ${sectionHead("In release order", { sub: "A sensible way through, if you are starting from nothing" })}
        <ol>${inOrder.map((node, i) => {
          const entry = D.library[node.key];
          return `<li class="rank"><span class="rank__n">${i + 1}</span>${thumb(node)}<div style="min-width:0"><a class="row__title" href="#t-${node.key}" style="display:block;font-size:16px">${esc(node.title)}</a><div class="row__sub">${med(node.type)}<span>${node.year}</span>${average(D.community(node.key).average)}</div></div>
            <div class="row__end">${score(D.ratings[node.key])}${entry ? `<span class="chip">${icon(STATUS[entry.status].icon, "i--sm")}${statusLabel(entry.status, node.type)}</span>` : `<button type="button" class="btn btn--sm btn--soft" data-act="status" data-key="${node.key}" data-status="want">${icon("plus", "i--sm")}Want</button>`}</div></li>`;
        }).join("")}</ol>
      </section>
      <section class="section">${sectionHead("More universes")}<div class="tiles">${D.UNIVERSES.filter((candidate) => candidate.id !== id).slice(0, 3).map(Y.universeTile).join("")}</div></section>
    </div>`;
    return { html, title: `${universe.name} universe`, ambient: lead.backdrop ?? lead.poster };
  };

  Y.views.missing = () => ({
    title: "Not found",
    html: `<div class="page page--narrow"><div class="empty" style="margin-top:80px"><h1 class="d2">Nothing here.</h1><p style="margin-top:12px">That page does not exist, or you are not allowed to see it.</p><a class="btn btn--primary" href="#home" style="margin-top:20px">Back to Home</a></div></div>`,
  });
})();
