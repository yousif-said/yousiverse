// The shell around every screen: routing, the sidebar, search, and what happens when things are clicked.
(() => {
  const Y = window.Y;
  const { C, D, S, TODAY, ME, PEOPLE, MEDIA, STATUS, VISIBILITY } = Y;
  const { esc, icon, avatar, thumb, plural, statusLabel, rating } = Y;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const view = $("#view");
  const side = $("#side");
  const tabbar = $("#tabbar");
  const palette = $("#palette");
  const modal = $("#modal");
  const root = document.documentElement;

  Y.logo = () => `<svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke-width="4" stroke-linecap="round">
    ${["movie", "tv", "game", "book"].map((type, i) => `<circle cx="14" cy="14" r="10" stroke="var(--${type})" stroke-dasharray="9.4 53.5" transform="rotate(${i * 90 - 72} 14 14)"/>`).join("")}
    <circle cx="14" cy="14" r="2.6" fill="var(--fg)" stroke="none"/></svg>`;

  // ---------- routes ----------
  function parse() {
    const hash = decodeURIComponent(location.hash.slice(1)) || "home";
    let m;
    if ((m = /^t-(.+)$/.exec(hash))) return ["title", m[1]];
    if ((m = /^e-(.+)-(\d+)-(\d+)$/.exec(hash))) return ["episode", m[1], Number(m[2]), Number(m[3])];
    if ((m = /^u-(.+)$/.exec(hash))) return ["universe", m[1]];
    if ((m = /^d-(.+)--(.+)$/.exec(hash))) return ["thread", m[1], m[2]];
    if ((m = /^c-(.+)$/.exec(hash))) return ["club", m[1]];
    if ((m = /^l-(.+)$/.exec(hash))) return ["list", m[1]];
    if ((m = /^p-(.+)$/.exec(hash))) return ["profile", m[1]];
    return Y.views[hash] ? [hash] : ["missing"];
  }
  const SECTION_OF = { universe: "universes", club: "clubs", thread: "clubs", list: "lists" };

  const NAV = [["home", "Home", "home"], ["library", "Library", "library"], ["universes", "Universes", "orbit"], ["for-you", "For you", "spark"], ["calendar", "Calendar", "calendar"]];
  const TOGETHER = [["feed", "Feed", "feed"], ["clubs", "Clubs", "clubs"], ["lists", "Lists", "list"]];

  function renderShell(name, args) {
    const current = SECTION_OF[name] ?? name;
    const link = ([id, label, glyph], extra = "") => `<a href="#${id}" ${current === id ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span>${extra}</a>`;
    const fired = D.ALERTS.filter((alert) => alert.state === "fired").length;
    side.innerHTML = `
      <a class="brand" href="#home" aria-label="Yousiverse, home">${Y.logo()}<span>Yousiverse</span></a>
      <button type="button" class="side__search" data-act="palette">${icon("search")}<span>Search</span><span class="kbd">⌘K</span></button>
      <nav class="nav" aria-label="Yours">${NAV.map((item) => link(item)).join("")}</nav>
      <div class="label nav__label">Together</div>
      <nav class="nav" aria-label="Together">${TOGETHER.map((item) => link(item)).join("")}</nav>
      <div class="label nav__label">Your clubs</div>
      <nav class="nav nav--pins" aria-label="Your clubs">${D.CLUBS.filter((club) => club.joined).map((club) => `<a href="#c-${club.id}" ${name === "club" && args[0] === club.id ? 'aria-current="page"' : ""}><span class="nav__dot"><i style="--h:${C[club.picks[0]?.key]?.hue ?? 40}"></i></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(club.name)}</span></a>`).join("")}</nav>
      <div class="side__foot">
        <nav class="nav" aria-label="More">${link(["alerts", "Alerts", "bell"], fired ? `<span class="badge" aria-label="${fired} came through">${fired}</span>` : "")}${link(["import", "Import", "import"])}</nav>
        <button type="button" class="me" data-act="me-menu" aria-haspopup="menu">${avatar(ME.username, 34)}<span class="me__text"><div class="me__name">${esc(ME.name)}</div><div class="me__user">@${ME.username}</div></span>${icon("more")}</button>
      </div>`;
    const tab = (id, label, glyph) => `<a href="#${id}" ${current === id || (id === `p-${ME.username}` && name === "profile") ? 'aria-current="page"' : ""}>${icon(glyph, "i--lg")}${label}</a>`;
    tabbar.innerHTML = `${tab("home", "Home", "home")}${tab("library", "Library", "library")}<button type="button" data-act="palette">${icon("search", "i--lg")}Search</button>${tab("calendar", "Calendar", "calendar")}${tab(`p-${ME.username}`, "You", "user")}`;
  }

  const footer = () => `<footer class="foot"><p>This is a design mockup. The titles, artwork, and release dates are real; the people, ratings, reviews, prices, and availability are examples. Movie and TV data and images come from <a href="https://www.themoviedb.org">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB. Game data and images come from <a href="https://www.igdb.com">IGDB</a>. Streaming availability comes from <a href="https://www.watchmode.com">Watchmode</a>. PC game prices come from <a href="https://isthereanydeal.com">IsThereAnyDeal</a>. Book data and covers come from <a href="https://openlibrary.org">Open Library</a>.</p></footer>`;

  function render({ keep = false } = {}) {
    let [name, ...args] = parse();
    if (!S.signedIn) [name, args] = ["welcome", []];
    else if (name === "welcome") [name, args] = ["home", []];
    const out = Y.views[name](...args);
    document.body.classList.toggle("bare", Boolean(out.bare));
    view.classList.toggle("fresh", !keep);
    view.innerHTML = out.html + (out.bare ? "" : footer());
    document.title = `${out.title} · Yousiverse`;
    $("#ambient").innerHTML = out.ambient ? `<div class="ambient__img" style="background-image:url('${out.ambient}')"></div>` : "";
    renderShell(name, args);
    drawMap();
    if (!keep) window.scrollTo(0, 0);
  }
  /** Redraws the current screen after something changed, without losing the person's place. */
  function update() {
    const y = window.scrollY;
    const focused = document.activeElement?.id;
    render({ keep: true });
    window.scrollTo(0, y);
    if (focused) {
      const again = document.getElementById(focused);
      if (again) {
        again.focus({ preventScroll: true });
        if (again.setSelectionRange && again.type !== "email" && again.type !== "file") again.setSelectionRange(again.value.length, again.value.length);
      }
    }
  }
  function go(hash) {
    if (location.hash === `#${hash}`) render();
    else location.hash = hash;
  }
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener("hashchange", () => {
    closeOverlays();
    if (document.startViewTransition && !calm.matches) document.startViewTransition(() => render());
    else render();
  });

  // ---------- small feedback ----------
  function toast(message) {
    const item = document.createElement("div");
    item.className = "toast";
    item.innerHTML = `${icon("check", "i--sm")}<span>${esc(message)}</span>`;
    $("#toasts").append(item);
    setTimeout(() => item.classList.add("out"), 2600);
    setTimeout(() => item.remove(), 3000);
  }

  // ---------- the rating instrument ----------
  const saving = new WeakMap();
  function setDial(dial, quarters) {
    const [kind, id] = [dial.dataset.dial.slice(0, 1), dial.dataset.dial.slice(2)];
    const store = kind === "t" ? D.ratings : D.episodeRatings;
    if (quarters === null) delete store[id];
    else store[id] = quarters;
    const rated = quarters !== null;
    const number = $(".dial__num", dial);
    number.textContent = rated ? rating(quarters) : "–";
    number.classList.toggle("is-empty", !rated);
    const needle = $(".dial__needle", dial);
    needle.hidden = !rated;
    if (rated) needle.style.left = `${(quarters / 40) * 100}%`;
    $$(".dial__hist i", dial).forEach((bar, i) => bar.classList.toggle("on", rated && i / 2 <= quarters / 4));
    $(".dial__state", dial).textContent = rated ? "out of 10" : "Not rated yet";
    $('[data-act="clear-rating"]', dial).hidden = !rated;
    const scale = $(".dial__scale", dial);
    scale.setAttribute("aria-valuenow", rated ? quarters / 4 : 0);
    scale.setAttribute("aria-valuetext", rated ? `${rating(quarters)} out of 10` : "Not rated");
    // Dragging passes through many values; only the one it rests on is saved.
    const saved = $(".dial__saved", dial);
    saved.classList.remove("on");
    clearTimeout(saving.get(dial));
    saving.set(dial, setTimeout(() => {
      saved.lastChild.textContent = rated ? "Saved" : "Cleared";
      saved.classList.add("on");
      setTimeout(() => saved.classList.remove("on"), 1800);
    }, 420));
  }
  const currentDial = (dial) => {
    const [kind, id] = [dial.dataset.dial.slice(0, 1), dial.dataset.dial.slice(2)];
    return (kind === "t" ? D.ratings : D.episodeRatings)[id] ?? null;
  };
  document.addEventListener("pointerdown", (event) => {
    const scale = event.target.closest(".dial__scale");
    if (!scale || event.target.closest("a") || event.button !== 0) return;
    const dial = scale.closest(".dial");
    const at = (clientX) => {
      const box = scale.getBoundingClientRect();
      return Y.clamp(Math.round(((clientX - box.left) / box.width) * 40), 0, 40);
    };
    dial.classList.add("dragging");
    scale.setPointerCapture(event.pointerId);
    setDial(dial, at(event.clientX));
    const move = (moved) => setDial(dial, at(moved.clientX));
    const stop = () => {
      dial.classList.remove("dragging");
      scale.removeEventListener("pointermove", move);
      scale.removeEventListener("pointerup", stop);
      scale.removeEventListener("pointercancel", stop);
    };
    scale.addEventListener("pointermove", move);
    scale.addEventListener("pointerup", stop);
    scale.addEventListener("pointercancel", stop);
    scale.focus({ preventScroll: true });
    event.preventDefault();
  });
  function dialKey(event) {
    const scale = event.target.closest?.(".dial__scale");
    if (!scale) return false;
    const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 };
    const dial = scale.closest(".dial");
    const now = currentDial(dial) ?? 20;
    let next = null;
    if (event.key in steps) next = Y.clamp(now + steps[event.key], 0, 40);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = 40;
    if (next === null) return false;
    setDial(dial, next);
    event.preventDefault();
    return true;
  }

  // ---------- the universe map's lines ----------
  function drawMap() {
    const map = $("[data-map]");
    if (!map) return;
    const universe = D.UNIVERSES.find((candidate) => candidate.id === map.dataset.map);
    const grid = $(".map__grid", map);
    const svg = $(".map__edges", map);
    const frame = grid.getBoundingClientRect();
    const box = (key) => {
      const node = $(`[data-node="${key}"]`, map);
      if (!node) return null;
      const picture = $(".art", node).getBoundingClientRect();
      return { left: picture.left - frame.left, right: picture.right - frame.left, top: picture.top - frame.top, bottom: node.getBoundingClientRect().bottom - frame.top, x: picture.left - frame.left + picture.width / 2, y: picture.top - frame.top + picture.height / 2 };
    };
    // Titles in one medium join side to side; a link between mediums drops from one lane to the next.
    const between = universe.edges.filter(([from, to]) => box(from) && box(to) && Math.abs(box(from).y - box(to).y) >= 40);
    svg.innerHTML = universe.edges.map(([from, to, kind]) => {
      const [a, b] = [box(from), box(to)];
      if (!a || !b) return "";
      if (Math.abs(a.y - b.y) < 40) {
        const [left, right] = a.x < b.x ? [a, b] : [b, a];
        return `<path class="${kind}" d="M${left.right + 6} ${left.y} L${right.left - 6} ${right.y}"/>`;
      }
      const [upper, lower] = a.y < b.y ? [a, b] : [b, a];
      const [y1, y2] = [upper.bottom + 6, lower.top - 6];
      // Links that cross the same gap each take their own height, so they never run on top of one another.
      const turn = between.findIndex(([f, t]) => f === from && t === to) + 1;
      const middle = y1 + ((y2 - y1) * turn) / (between.length + 1);
      return `<path class="${kind}" d="M${upper.x} ${y1} C${upper.x} ${middle}, ${lower.x} ${middle}, ${lower.x} ${y2}"/>`;
    }).join("");
  }
  window.addEventListener("resize", drawMap);

  // ---------- search (⌘K) ----------
  const PAGES = [["home", "Home", "home"], ["library", "Library", "library"], ["universes", "Universes", "orbit"], ["for-you", "For you", "spark"], ["calendar", "Calendar", "calendar"], ["feed", "Feed", "feed"], ["clubs", "Clubs", "clubs"], ["lists", "Lists", "list"], ["alerts", "Alerts", "bell"], ["import", "Import", "import"], ["account", "Account", "sliders"]];
  let selected = 0;
  function paletteItems(query) {
    const q = query.trim();
    const page = ([id, label, glyph]) => ({ hash: id, lead: `<span class="pal__ico">${icon(glyph)}</span>`, name: label, sub: "Go to" });
    if (!q) {
      return [
        ["Pick up where you left off", Y.entriesOf("in_progress").slice(0, 4).map((key) => ({ hash: `t-${key}`, lead: thumb(C[key], { link: false }), name: C[key].title, sub: Y.progressOf(key)?.text ?? MEDIA[C[key].type].one }))],
        ["Go to", PAGES.map(page)],
      ];
    }
    const found = Y.find(q);
    const groups = [
      ["Titles", found.titles.slice(0, 7).map((title) => {
        const mine = D.library[title.key];
        return { hash: `t-${title.key}`, lead: thumb(title, { link: false }), name: title.title, sub: `${MEDIA[title.type].one} · ${title.year ?? "TBA"}${title.authors ? ` · ${title.authors[0]}` : ""}${mine ? ` · ${statusLabel(mine.status, title.type)}` : ""}` };
      })],
      ["People", found.people.map((username) => ({ hash: `p-${username}`, lead: avatar(username, 34), name: PEOPLE[username].name, sub: `@${username}${PEOPLE[username].following ? " · Following" : ""}` }))],
      ["Universes", found.universes.map((universe) => ({ hash: `u-${universe.id}`, lead: `<span class="pal__ico">${icon("orbit")}</span>`, name: universe.name, sub: `Universe · ${plural(universe.nodes.length, "title")}` }))],
      ["Lists and clubs", [...found.lists.map((list) => ({ hash: `l-${list.id}`, lead: `<span class="pal__ico">${icon("list")}</span>`, name: list.name, sub: `List · ${plural(list.items.length, "title")}` })), ...found.clubs.map((club) => ({ hash: `c-${club.id}`, lead: `<span class="pal__ico">${icon("clubs")}</span>`, name: club.name, sub: `Club · ${plural(club.memberCount, "member")}` }))]],
      ["Go to", PAGES.filter(([, label]) => label.toLowerCase().includes(q.toLowerCase())).map(page)],
    ].filter(([, items]) => items.length);
    groups.push(["", [{ hash: "search", query: q, lead: `<span class="pal__ico">${icon("search")}</span>`, name: `Search everything for “${q}”`, sub: "Movies, shows, games, books, and people" }]]);
    return groups;
  }
  function renderPalette(query) {
    let index = 0;
    $("#pal-list").innerHTML = paletteItems(query).map(([label, items]) => `${label ? `<div class="label pal__group">${label}</div>` : ""}${items.map((item) => {
      const i = index++;
      return `<a class="pal__item${i === selected ? " sel" : ""}" href="#${item.hash}" data-pal="${i}" ${item.query ? `data-q="${esc(item.query)}"` : ""}>${item.lead}<div style="min-width:0"><b>${esc(item.name)}</b><span>${esc(item.sub)}</span></div><span class="kbd">↵</span></a>`;
    }).join("")}`).join("");
  }
  function openPalette() {
    closeOverlays();
    selected = 0;
    palette.hidden = false;
    palette.innerHTML = `<div class="pal" role="dialog" aria-modal="true" aria-label="Search">
      <div class="pal__in">${icon("search", "i--lg")}<label class="sr" for="pal-q">Search</label><input id="pal-q" type="text" placeholder="Search titles, people, lists, and clubs" autocomplete="off" spellcheck="false"><span class="kbd">esc</span></div>
      <div class="pal__list" id="pal-list"></div>
      <div class="pal__foot"><span><span class="kbd">↑</span><span class="kbd">↓</span> move</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">esc</span> close</span></div>
    </div>`;
    renderPalette("");
    const input = $("#pal-q");
    input.focus();
    input.addEventListener("input", () => {
      selected = 0;
      renderPalette(input.value);
    });
  }
  function paletteKey(event) {
    if (palette.hidden) return false;
    const items = $$("[data-pal]", palette);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      selected = (selected + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((item, i) => item.classList.toggle("sel", i === selected));
      items[selected]?.scrollIntoView({ block: "nearest" });
      event.preventDefault();
      return true;
    }
    if (event.key === "Enter" && items[selected]) {
      items[selected].click();
      event.preventDefault();
      return true;
    }
    return false;
  }

  // ---------- menus and dialogs ----------
  let menu = null;
  function closeOverlays() {
    palette.hidden = true;
    palette.innerHTML = "";
    modal.hidden = true;
    modal.innerHTML = "";
    menu?.remove();
    menu = null;
  }
  function openMenu(anchor) {
    if (menu) return closeOverlays();
    closeOverlays();
    const night = root.dataset.mode === "night";
    menu = document.createElement("div");
    menu.className = "menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <a href="#p-${ME.username}" role="menuitem">${icon("user")}Your profile</a>
      <a href="#account" role="menuitem">${icon("sliders")}Account</a>
      <hr>
      <button type="button" role="menuitem" data-act="mode" data-value="${night ? "day" : "night"}">${icon(night ? "sun" : "moon")}Switch to ${night ? "day" : "night"}</button>
      ${ME.reviewer ? `<a href="#link-review" role="menuitem">${icon("shield")}Review franchise links</a>` : ""}
      <hr>
      <button type="button" role="menuitem" data-act="signout">${icon("logout")}Sign out</button>`;
    document.body.append(menu);
    const box = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(12, Math.min(box.left, window.innerWidth - 250))}px`;
    menu.style.bottom = `${window.innerHeight - box.top + 8}px`;
  }

  const draft = { types: new Set(["book"]), access: "public", visibility: "public" };
  const MODALS = {
    "add-to-list": ({ key }) => {
      const mine = D.LISTS.filter((list) => list.by === ME.username);
      return `<div><h2 class="d3">Add to a list</h2><p class="sh__sub">${esc(C[key].title)}</p></div>
        <ul class="rows">${mine.map((list) => {
          const has = list.items.some((item) => item.key === key);
          return `<li><button type="button" class="row" style="width:100%;text-align:left;grid-template-columns:auto minmax(0,1fr) auto" data-act="list-toggle" data-list="${list.id}" data-key="${key}" aria-pressed="${has}"><span class="tick" aria-pressed="${has}" style="width:26px;height:26px">${icon("check")}</span><span><span class="row__title" style="display:block">${esc(list.name)}</span><span class="row__sub">${plural(list.items.length, "title")} · ${VISIBILITY[list.visibility].label}</span></span></button></li>`;
        }).join("")}</ul>
        <div class="dialog__foot"><button type="button" class="btn btn--ghost" data-act="modal" data-modal="new-list">${icon("plus", "i--sm")}New list</button><button type="button" class="btn btn--primary" data-act="close">Done</button></div>`;
    },
    "pick-for-club": ({ key }) => {
      const clubs = D.CLUBS.filter((club) => club.joined && club.types.includes(C[key].type));
      return `<div><h2 class="d3">Pick for a club</h2><p class="sh__sub">Only clubs that cover ${MEDIA[C[key].type].label.toLowerCase()} are offered.</p></div>
        <ul class="rows">${clubs.map((club) => {
          const has = club.picks.some((pick) => pick.key === key);
          return `<li><button type="button" class="row" style="width:100%;text-align:left;grid-template-columns:auto minmax(0,1fr)" data-act="club-pick" data-club="${club.id}" data-key="${key}" aria-pressed="${has}"><span class="tick" aria-pressed="${has}" style="width:26px;height:26px">${icon("check")}</span><span><span class="row__title" style="display:block">${esc(club.name)}</span><span class="row__sub">${plural(club.memberCount, "member")}</span></span></button></li>`;
        }).join("")}</ul>
        <div class="dialog__foot"><button type="button" class="btn btn--primary" data-act="close">Done</button></div>`;
    },
    "new-list": () => `<form data-act-submit="new-list" style="display:contents"><h2 class="d3">New list</h2>
        <div class="field"><label for="nl-name">Name</label><input class="input" id="nl-name" required maxlength="80" placeholder="Rainy-day rewatches"></div>
        <div class="field"><label for="nl-desc">Description <span class="hint">(optional)</span></label><textarea class="textarea" id="nl-desc" style="min-height:80px"></textarea></div>
        <div class="field"><span>Who can see it</span><div class="seg" role="group">${Object.entries(VISIBILITY).map(([value, item]) => `<button type="button" data-act="draft" data-field="visibility" data-value="${value}" aria-pressed="${draft.visibility === value}">${icon(item.icon, "i--sm")}${item.label}</button>`).join("")}</div></div>
        <div class="dialog__foot"><button type="button" class="btn btn--ghost" data-act="close">Cancel</button><button class="btn btn--primary" type="submit">Create list</button></div></form>`,
    "new-club": () => `<form data-act-submit="new-club" style="display:contents"><h2 class="d3">Start a club</h2>
        <div class="field"><label for="nc-name">Name</label><input class="input" id="nc-name" required maxlength="80" placeholder="Thursday Night Noir"></div>
        <div class="field"><label for="nc-desc">What is it about?</label><textarea class="textarea" id="nc-desc" style="min-height:80px"></textarea></div>
        <div class="field"><span>What it covers</span><div class="picks">${Object.entries(MEDIA).map(([type, item]) => `<button type="button" data-act="draft" data-field="types" data-value="${type}" aria-pressed="${draft.types.has(type)}"><span class="c-${type}">${icon(item.icon, "i--lg")}</span>${item.label}</button>`).join("")}</div><span class="hint">Members can only pick these kinds of titles.</span></div>
        <div class="field"><span>Who can join</span><div class="seg" role="group"><button type="button" data-act="draft" data-field="access" data-value="public" aria-pressed="${draft.access === "public"}">${icon("globe", "i--sm")}Anyone</button><button type="button" data-act="draft" data-field="access" data-value="invite" aria-pressed="${draft.access === "invite"}">${icon("lock", "i--sm")}Invite link only</button></div></div>
        <div class="dialog__foot"><button type="button" class="btn btn--ghost" data-act="close">Cancel</button><button class="btn btn--primary" type="submit">Start club</button></div></form>`,
    "new-thread": ({ club }) => `<form data-act-submit="new-thread" data-club="${club}" style="display:contents"><h2 class="d3">Start a discussion</h2>
        <div class="field"><label for="nt-title">Title</label><input class="input" id="nt-title" required maxlength="120"></div>
        <div class="field"><label for="nt-body">Opening post</label><textarea class="textarea" id="nt-body" required></textarea><span class="hint">Posts cannot be edited after sending.</span></div>
        <div class="dialog__foot"><button type="button" class="btn btn--ghost" data-act="close">Cancel</button><button class="btn btn--primary" type="submit">Post</button></div></form>`,
  };
  let openModalArgs = null;
  function openModal(name, data) {
    closeOverlays();
    openModalArgs = [name, data];
    modal.hidden = false;
    modal.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${MODALS[name](data)}</div>`;
    $("input, textarea, button", modal)?.focus();
  }
  const refreshModal = () => {
    const values = $$("input, textarea", modal).map((field) => field.value);
    modal.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${MODALS[openModalArgs[0]](openModalArgs[1])}</div>`;
    $$("input, textarea", modal).forEach((field, i) => { field.value = values[i] ?? ""; });
  };

  // ---------- what clicks do ----------
  let importTimer = null;
  const ACTIONS = {
    status(el) {
      const { key, status } = el.dataset;
      const existing = D.library[key];
      D.library[key] = { status, at: TODAY, visibility: existing?.visibility ?? "public", progress: existing?.progress ?? null };
      toast(`${C[key].title}: ${statusLabel(status, C[key].type).toLowerCase()}`);
      update();
    },
    remove(el) {
      delete D.library[el.dataset.key];
      toast("Removed from your library");
      update();
    },
    visibility(el) {
      const order = Object.keys(VISIBILITY);
      const entry = D.library[el.dataset.key];
      entry.visibility = order[(order.indexOf(entry.visibility) + 1) % order.length];
      toast(`Visible to: ${VISIBILITY[entry.visibility].label.toLowerCase()}`);
      update();
    },
    "clear-rating": (el) => setDial(el.closest(".dial"), null),
    watched(el) {
      const [, key, season, episode] = /^(.+)-(\d+)-(\d+)$/.exec(el.dataset.id);
      S.watched[el.dataset.id] = !Y.isWatched(key, Number(season), Number(episode));
      toast(S.watched[el.dataset.id] ? `Episode ${episode} marked watched` : `Episode ${episode} unmarked`);
      update();
    },
    season(el) { S.season[el.dataset.key] = Number(el.dataset.season); update(); },
    lib(el) { S.lib[el.dataset.field] = el.dataset.value; update(); },
    "lib-jump": (el) => { S.lib.status = el.dataset.status; S.lib.view = "grid"; return true; },
    cal(el) { S.cal[el.dataset.field] = el.dataset.value; update(); },
    budget(el) { S.budget = el.dataset.value; update(); },
    blend(el) { S.blend = el.dataset.value; update(); },
    ptab(el) { S.profileTab[el.dataset.user] = el.dataset.value; update(); $(".tabs")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); },
    follow(el) {
      const who = PEOPLE[el.dataset.user];
      who.following = !who.following;
      toast(who.following ? `Following ${who.name}${who.followsYou ? ". You are friends now." : ""}` : `Unfollowed ${who.name}`);
      update();
    },
    join(el) {
      const club = D.CLUBS.find((candidate) => candidate.id === el.dataset.club);
      club.joined = !club.joined;
      club.memberCount += club.joined ? 1 : -1;
      club.members = club.joined ? [...club.members, ME.username] : club.members.filter((name) => name !== ME.username);
      toast(club.joined ? `You joined ${club.name}` : `You left ${club.name}`);
      update();
    },
    sub(el) {
      const name = el.dataset.name;
      if (D.subscriptions.has(name)) D.subscriptions.delete(name);
      else D.subscriptions.add(name);
      update();
    },
    alert(el) {
      const id = `${el.dataset.key}:${el.dataset.kind}`;
      S.alertsOn[id] = el.getAttribute("aria-pressed") !== "true";
      toast(S.alertsOn[id] ? "Alert set. You will hear about it once." : "Alert removed");
      update();
    },
    "price-alert": (el) => {
      const on = el.getAttribute("aria-pressed") === "true";
      S.alertsOn[`${el.dataset.key}:price`] = on ? false : Number(el.dataset.target);
      toast(on ? "Price alert removed" : "Price alert set. You will hear about it once.");
      update();
    },
    "remove-alert": (el) => {
      D.ALERTS.splice(D.ALERTS.findIndex((alert) => alert.key === el.dataset.key && alert.state === "waiting"), 1);
      toast("Alert removed");
      update();
    },
    "email-alerts": () => { S.emailAlerts = !S.emailAlerts; update(); },
    "import-source": (el) => { S.importer.source = el.dataset.value; update(); },
    "import-vis": (el) => { S.importer.visibility = el.dataset.value; update(); },
    "import-start": () => {
      Object.assign(S.importer, { state: "running", done: 0 });
      update();
      clearInterval(importTimer);
      importTimer = setInterval(() => {
        S.importer.done = Math.min(251, S.importer.done + 9);
        if (S.importer.done >= 251) {
          S.importer.state = "done";
          clearInterval(importTimer);
        }
        if (parse()[0] === "import") update();
      }, 140);
    },
    "import-reset": () => { clearInterval(importTimer); Object.assign(S.importer, { state: "idle", done: 0 }); update(); },
    "search-for": (el) => { S.search.q = el.dataset.q; return true; },
    "search-type": (el) => { S.search.type = el.dataset.value; update(); },
    mode(el) {
      root.dataset.mode = el.dataset.value;
      try { localStorage.setItem("yv-mode", el.dataset.value); } catch { /* storage can be unavailable; the choice just does not persist */ }
      closeOverlays();
      update();
    },
    palette: openPalette,
    "me-menu": (el) => openMenu(el),
    modal: (el) => openModal(el.dataset.modal, { ...el.dataset }),
    close: closeOverlays,
    draft(el) {
      const { field, value } = el.dataset;
      if (field === "types") draft.types.has(value) ? draft.types.delete(value) : draft.types.add(value);
      else draft[field] = value;
      refreshModal();
    },
    "list-toggle": (el) => {
      const list = D.LISTS.find((candidate) => candidate.id === el.dataset.list);
      const at = list.items.findIndex((item) => item.key === el.dataset.key);
      if (at >= 0) list.items.splice(at, 1);
      else list.items.push({ key: el.dataset.key });
      refreshModal();
      render({ keep: true });
    },
    "club-pick": (el) => {
      const club = D.CLUBS.find((candidate) => candidate.id === el.dataset.club);
      const at = club.picks.findIndex((pick) => pick.key === el.dataset.key);
      if (at >= 0) club.picks.splice(at, 1);
      else club.picks.unshift({ key: el.dataset.key, by: ME.username, average: null, count: 0 });
      refreshModal();
      render({ keep: true });
    },
    unlist(el) {
      const list = D.LISTS.find((candidate) => candidate.id === el.dataset.list);
      list.items = list.items.filter((item) => item.key !== el.dataset.key);
      toast("Removed from the list");
      update();
    },
    "want-all": (el) => {
      const universe = D.UNIVERSES.find((candidate) => candidate.id === el.dataset.universe);
      for (const key of universe.nodes) D.library[key] ??= { status: "want", at: TODAY, visibility: "public", progress: null };
      toast(`The rest of ${universe.name} is on your want list`);
      update();
    },
    resolve(el) {
      S.resolved[el.dataset.index] = el.dataset.value;
      toast(el.dataset.value === "approved" ? "Link approved. It now shows on both titles." : "Suggestion rejected. It will not be raised again.");
      update();
    },
    "scroll-day": (el) => document.getElementById(`day-${el.dataset.day}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    "scroll-to": (el) => document.getElementById(el.dataset.id)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    toast: (el) => toast(el.dataset.msg),
    outbound: (el) => toast(`This opens ${el.dataset.name} in a new tab`),
    copy(el) {
      const done = () => toast("Link copied");
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(el.dataset.text).then(done, () => toast(`Copy this link: ${el.dataset.text}`));
      else toast(`Copy this link: ${el.dataset.text}`);
    },
    signin() { S.signedIn = true; go("home"); },
    signout() { S.signedIn = false; S.door = "start"; closeOverlays(); go("welcome"); },
    door(el) { S.door = el.dataset.value; update(); },
  };

  const SUBMITS = {
    "post-review": (form) => {
      const key = form.dataset.key;
      const target = form.dataset.target;
      const mine = target.startsWith("t:") ? D.ratings[key] : D.episodeRatings[target.slice(2)];
      const review = { rating: mine ? rating(mine) : "", at: TODAY, visibility: "public", body: $("textarea", form).value.trim() };
      S.posted[target.startsWith("t:") ? key : target] = review;
      toast("Review posted");
      update();
    },
    reply(form) {
      const club = D.CLUBS.find((candidate) => candidate.id === form.dataset.club);
      const thread = club.threads.find((candidate) => candidate.id === form.dataset.thread);
      thread.posts.push({ by: ME.username, at: TODAY, body: $("textarea", form).value.trim() });
      thread.active = TODAY;
      update();
    },
    "send-link": () => { S.door = "sent"; update(); },
    "new-list": () => {
      const id = `list-${D.LISTS.length + 1}`;
      D.LISTS.unshift({ id, name: $("#nl-name").value.trim(), description: $("#nl-desc").value.trim(), by: ME.username, visibility: draft.visibility, items: [] });
      closeOverlays();
      toast("List created");
      go(`l-${id}`);
    },
    "new-club": () => {
      const id = `club-${D.CLUBS.length + 1}`;
      D.CLUBS.unshift({ id, name: $("#nc-name").value.trim(), description: $("#nc-desc").value.trim(), types: [...draft.types], access: draft.access, owner: ME.username, joined: true, memberCount: 1, members: [ME.username], invite: "new-club", picks: [], threads: [] });
      closeOverlays();
      toast("Club started");
      go(`c-${id}`);
    },
    "new-thread": (form) => {
      const club = D.CLUBS.find((candidate) => candidate.id === form.dataset.club);
      const id = `thread-${club.threads.length + 1}`;
      club.threads.push({ id, title: $("#nt-title").value.trim(), by: ME.username, at: TODAY, active: TODAY, posts: [{ by: ME.username, at: TODAY, body: $("#nt-body").value.trim() }] });
      closeOverlays();
      go(`d-${club.id}--${id}`);
    },
  };

  document.addEventListener("click", (event) => {
    if (menu && !event.target.closest(".menu") && !event.target.closest('[data-act="me-menu"]')) closeOverlays();
    if ((event.target === palette || event.target === modal) && !event.target.closest(".pal, .dialog")) return closeOverlays();

    const result = event.target.closest("[data-pal]");
    if (result?.dataset.q) S.search.q = result.dataset.q;

    // The artwork that was clicked grows into the next page's poster.
    const artwork = event.target.closest("a.art, .card a");
    if (artwork?.getAttribute("href")?.startsWith("#t-")) {
      $$(".hero__art").forEach((el) => { el.style.viewTransitionName = "none"; });
      const picture = artwork.classList.contains("art") ? artwork : artwork.closest(".card")?.querySelector(".art");
      if (picture && !picture.classList.contains("art--tv")) picture.style.viewTransitionName = "hero-art";
    }

    const el = event.target.closest("[data-act]");
    if (!el) return;
    const keepDefault = ACTIONS[el.dataset.act]?.(el, event);
    if (keepDefault !== true) event.preventDefault();
  });
  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-act-submit]");
    event.preventDefault();
    if (form) SUBMITS[form.dataset.actSubmit](form);
  });
  document.addEventListener("input", (event) => {
    if (!event.target.matches("[data-search-page]")) return;
    S.search.q = event.target.value;
    update();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      return palette.hidden ? openPalette() : closeOverlays();
    }
    if (event.key === "Escape") return closeOverlays();
    if (paletteKey(event) || dialKey(event)) return;
    const typing = event.target.matches("input, textarea, select") || event.metaKey || event.ctrlKey || event.altKey;
    if (typing || !S.signedIn) return;
    if (event.key === "/") {
      event.preventDefault();
      openPalette();
    }
    if (parse()[0] === "link-review" && ["a", "r"].includes(event.key.toLowerCase())) {
      $(`[data-act="resolve"][data-value="${event.key.toLowerCase() === "a" ? "approved" : "rejected"}"]`)?.click();
    }
  });

  // Dragging a title between columns on the library board.
  document.addEventListener("dragstart", (event) => {
    const item = event.target.closest?.("[data-drag]");
    if (!item) return;
    event.dataTransfer.setData("text/plain", item.dataset.drag);
    event.dataTransfer.effectAllowed = "move";
    item.classList.add("dragging");
  });
  document.addEventListener("dragend", (event) => event.target.closest?.("[data-drag]")?.classList.remove("dragging"));
  document.addEventListener("dragover", (event) => {
    const column = event.target.closest?.("[data-drop]");
    if (!column) return;
    event.preventDefault();
    $$(".board__col.over").forEach((el) => el !== column && el.classList.remove("over"));
    column.classList.add("over");
  });
  document.addEventListener("drop", (event) => {
    const column = event.target.closest?.("[data-drop]");
    const key = event.dataTransfer?.getData("text/plain");
    if (!column || !D.library[key]) return;
    event.preventDefault();
    D.library[key] = { ...D.library[key], status: column.dataset.drop, at: TODAY };
    toast(`${C[key].title}: ${statusLabel(column.dataset.drop, C[key].type).toLowerCase()}`);
    update();
  });

  try {
    const saved = localStorage.getItem("yv-mode");
    if (saved === "day" || saved === "night") root.dataset.mode = saved;
  } catch { /* storage can be unavailable; the mockup opens in its default look */ }
  render();
})();
