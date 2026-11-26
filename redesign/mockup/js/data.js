// Sample state for the mockup. Titles, artwork, and release dates are real (see catalog.js).
// People, ratings, reviews, prices, and availability are invented examples.
(() => {
  const C = window.CATALOG;
  const TODAY = "2026-11-26";

  /** A stable number from text, so every "random" detail is the same on each load. */
  function seed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  const quarter = (n) => Math.round(n * 4) / 4;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  const ME = { username: "sam", name: "Sam Rivera", hue: 28, joined: "2025-03-02", email: "sam@example.com", reviewer: true };

  const PEOPLE = {
    mara: { name: "Mara Lindqvist", hue: 330, following: true, followsYou: true, joined: "2025-01-14" },
    theo: { name: "Theo Okafor", hue: 150, following: true, followsYou: true, joined: "2025-04-02" },
    priya: { name: "Priya Nair", hue: 262, following: true, followsYou: true, joined: "2025-02-20" },
    lena: { name: "Lena Castillo", hue: 12, following: true, followsYou: true, joined: "2025-06-09" },
    jonas: { name: "Jonas Weber", hue: 205, following: true, followsYou: false, joined: "2024-11-30" },
    kenji: { name: "Kenji Mori", hue: 95, following: false, followsYou: true, joined: "2025-08-17" },
    ada: { name: "Ada Bellamy", hue: 300, following: false, followsYou: false, joined: "2025-05-21" },
    omar: { name: "Omar Haddad", hue: 178, following: false, followsYou: false, joined: "2025-09-03" },
  };

  // key: [status, rating out of 10 or null, date changed, progress]
  const LIB = {
    // films
    "dune-part-two": ["finished", 9.25, "2026-03-02"],
    "dune-2021": ["finished", 8.5, "2025-11-14"],
    "mad-max-fury-road": ["finished", 9.5, "2025-07-19"],
    parasite: ["finished", 9.25, "2025-05-03"],
    "spirited-away": ["finished", 9.75, "2025-04-11"],
    "fellowship-film": ["finished", 9.5, "2025-12-27"],
    "two-towers-film": ["finished", 9.25, "2025-12-28"],
    "the-matrix": ["finished", 9, "2025-03-09"],
    "the-matrix-reloaded": ["finished", 6.25, "2025-03-10"],
    "spider-man-into-the-spider-verse": ["finished", 9.25, "2025-08-02"],
    "the-martian-film": ["finished", 8, "2025-09-20"],
    "project-hail-mary-film": ["finished", 8.5, "2026-03-22"],
    "blade-runner-2049": ["want", null, "2026-09-30"],
    arrival: ["want", null, "2026-10-12"],
    "past-lives": ["want", null, "2026-10-21"],
    "everything-everywhere-all-at-once": ["want", null, "2026-08-14"],
    oppenheimer: ["want", null, "2026-06-01"],
    "dune-part-three": ["want", null, "2026-11-02"],
    werwulf: ["want", null, "2026-11-18"],
    // tv
    severance: ["in_progress", 9.25, "2026-11-24", { season: 2, episode: 6 }],
    "the-gilded-age": ["in_progress", 8, "2026-11-23", { season: 4, episode: 4 }],
    "slow-horses": ["in_progress", 8.75, "2026-11-10", { season: 6, episode: 3 }],
    "breaking-bad": ["finished", 9.75, "2025-03-15"],
    "the-wire": ["finished", 9.5, "2025-03-15"],
    arcane: ["finished", 9, "2025-10-05"],
    "avatar-the-last-airbender": ["finished", 9.5, "2025-03-15"],
    "the-last-of-us-show": ["finished", 8.5, "2025-06-01"],
    shogun: ["finished", 9.25, "2026-01-18"],
    andor: ["finished", 9.25, "2025-05-20"],
    pluribus: ["want", null, "2026-11-05"],
    chernobyl: ["want", null, "2026-07-07"],
    fallout: ["want", null, "2026-02-10"],
    "the-bear": ["dropped", 7, "2025-08-30"],
    "dune-prophecy": ["dropped", 6, "2025-01-06"],
    // games
    "hades-ii": ["in_progress", 9, "2026-11-25", { hours: 38 }],
    "elden-ring": ["in_progress", 9.25, "2026-11-08", { hours: 62 }],
    balatro: ["in_progress", 8.5, "2026-10-28", { hours: 21 }],
    hades: ["finished", 9.5, "2025-03-20"],
    "disco-elysium": ["finished", 9.75, "2025-09-12"],
    "portal-2": ["finished", 9.5, "2025-03-20"],
    "the-last-of-us-game": ["finished", 9.25, "2025-03-20"],
    "the-last-of-us-part-ii": ["finished", 8.75, "2025-07-04"],
    "breath-of-the-wild": ["finished", 9.75, "2025-03-20"],
    "the-witcher-3": ["finished", 9.5, "2025-03-20"],
    "outer-wilds": ["finished", 10, "2026-02-08"],
    "tears-of-the-kingdom": ["want", null, "2026-04-19"],
    silksong: ["want", null, "2026-09-04"],
    "baldurs-gate-3": ["want", null, "2026-05-30"],
    "cyberpunk-2077": ["want", null, "2026-10-02"],
    fable: ["want", null, "2026-11-12"],
    "metro-2039": ["want", null, "2026-11-12"],
    "hollow-knight": ["dropped", 7.5, "2025-11-02"],
    // books
    "dune-messiah": ["in_progress", null, "2026-11-22", { page: 141 }],
    "the-last-wish": ["in_progress", null, "2026-10-30", { page: 96 }],
    "dune-book": ["finished", 9.5, "2025-10-28"],
    piranesi: ["finished", 9.5, "2026-06-14"],
    "project-hail-mary": ["finished", 8.75, "2025-12-02"],
    "the-martian": ["finished", 8.5, "2025-04-25"],
    "fellowship-book": ["finished", 9, "2025-03-22"],
    "the-hobbit": ["finished", 8.5, "2025-03-22"],
    "the-left-hand-of-darkness": ["finished", 9.25, "2026-08-23"],
    "tomorrow-x3": ["finished", 8.25, "2026-04-06"],
    "children-of-dune": ["want", null, "2026-11-22"],
    "jonathan-strange": ["want", null, "2026-06-15"],
    "two-towers-book": ["want", null, "2025-03-22"],
    babel: ["dropped", 6.5, "2026-01-11"],
  };
  const library = {};
  const ratings = {};
  for (const [key, [status, rating, at, progress]] of Object.entries(LIB)) {
    if (!C[key]) continue;
    library[key] = { status, at, visibility: "public", progress: progress ?? null };
    if (rating !== null) ratings[key] = Math.round(rating * 4);
  }
  library["dune-messiah"].visibility = "friends";
  library["the-bear"].visibility = "private";

  // What everyone thinks: an average and a count per title, a few set by hand.
  const KNOWN_AVERAGES = {
    "dune-part-two": 8.7, severance: 8.9, hades: 9.1, "hades-ii": 8.9, piranesi: 8.6, "dune-book": 8.8, "outer-wilds": 9.2,
    "the-matrix-reloaded": 6.4, "dune-prophecy": 6.8, "breaking-bad": 9.4, "the-wire": 9.3, "spirited-away": 9.1,
    "disco-elysium": 9.2, "elden-ring": 9.1, "the-gilded-age": 7.8, "tulsa-king": 7.1, "the-bear": 8.2, babel: 7.4,
  };
  function community(key) {
    const average = KNOWN_AVERAGES[key] ?? Number((7.3 + seed(`${key}avg`) * 1.8).toFixed(1));
    const count = Math.round(60 + seed(`${key}n`) ** 2 * 2600);
    const released = !C[key].date || C[key].date <= TODAY;
    return released ? { average, count } : { average: null, count: 0 };
  }
  /** How many people gave each half point, 0 to 10, as 21 bars. */
  function distribution(key) {
    const { average } = community(key);
    if (average === null) return new Array(21).fill(0);
    return Array.from({ length: 21 }, (_, i) => {
      const x = i / 2;
      const spread = x > average ? 0.9 : 1.6;
      const bell = Math.exp(-((x - average) ** 2) / (2 * spread ** 2));
      return bell * (0.82 + seed(`${key}d${i}`) * 0.36) + (i % 2 === 0 ? 0.05 : 0);
    });
  }

  const FRIEND_RATINGS = {
    "dune-part-two": { mara: 9.5, theo: 8, priya: 9, lena: 10, jonas: 7.5 },
    severance: { mara: 9.5, priya: 9, lena: 8.25 },
    hades: { theo: 9.75, mara: 8.75, jonas: 9 },
    "hades-ii": { theo: 9.25, jonas: 8.5 },
    piranesi: { priya: 9.75, lena: 9, mara: 7.75 },
    "dune-book": { priya: 9.5, mara: 8.5, lena: 9.25, jonas: 10 },
    "dune-messiah": { priya: 8.25, jonas: 9 },
    "outer-wilds": { theo: 10, jonas: 9.5 },
    "the-matrix": { mara: 9.25, theo: 9, lena: 8.5 },
  };
  function friendRatings(key) {
    if (FRIEND_RATINGS[key]) return FRIEND_RATINGS[key];
    const { average } = community(key);
    if (average === null) return {};
    const result = {};
    for (const username of Object.keys(PEOPLE)) {
      if (!PEOPLE[username].following) continue;
      if (seed(`${key}has${username}`) > 0.36) continue;
      result[username] = clamp(quarter(average + (seed(`${key}r${username}`) - 0.45) * 2.4), 4, 10);
    }
    return result;
  }

  const REVIEWS = {
    "dune-part-two": [
      { by: "lena", rating: 10, at: "2026-03-04", body: "I walked out of the theater and my ears were still ringing from the sandworm ride. The black-and-white arena sequence is the boldest thing a blockbuster has done in years.\n\nIt also understands the book: Paul winning is the tragedy." },
      { by: "mara", rating: 9.5, at: "2026-03-03", body: "Bigger than the first in every way, and somehow more intimate too. Chani is the heart of it, and the last shot belongs to her." },
      { by: "theo", rating: 8, at: "2026-03-10", body: "Staggering to look at. I wanted ten more minutes in the last act so the turn landed harder, but I'll be there opening night for Part Three." },
      { by: "ada", rating: 9, at: "2026-02-20", body: "The sound design alone is worth the ticket." },
      { by: null, rating: 7, at: "2026-01-11", body: "Gorgeous, cold, a little long. I admire it more than I love it." },
    ],
    severance: [
      { by: "mara", rating: 9.5, at: "2026-11-13", body: "The break room scenes get under your skin. Best office show since the one with the paper." },
      { by: "priya", rating: 9, at: "2026-10-02", body: "Every frame is composed like someone's job depended on it. Season 2 takes its time and earns it." },
      { by: "omar", rating: 8.5, at: "2026-09-18", body: "Come for the mystery, stay for Milchick's dancing." },
    ],
    hades: [
      { by: "theo", rating: 9.75, at: "2026-05-22", body: "The rare game where dying is the reward. Every run moves a relationship forward, so losing never feels like losing." },
      { by: "jonas", rating: 9, at: "2026-04-01", body: "Forty hours in and the dialogue still hasn't repeated. How." },
    ],
    piranesi: [
      { by: "priya", rating: 9.75, at: "2026-07-01", body: "The Beauty of the House is immeasurable; its Kindness infinite. I read it in one sitting and then sat very still for a while." },
      { by: "lena", rating: 9, at: "2026-06-20", body: "A puzzle box that turns out to be a hug. Go in knowing nothing." },
    ],
    "dune-book": [
      { by: "jonas", rating: 10, at: "2025-12-11", body: "Sixty years old and still the benchmark. The appendices alone build more world than most trilogies." },
      { by: "priya", rating: 9.5, at: "2025-11-02", body: "Reread it before the film. The ecology chapters hit differently now." },
    ],
    "the-matrix": [
      { by: null, rating: 9.25, at: "2026-11-12", body: "Saw it again last week and the lobby scene is still the best ten minutes of action anyone has filmed.\n\nThe sequels can't touch it." },
      { by: "lena", rating: 8.5, at: "2026-08-08", body: "The green tint has aged; the ideas haven't." },
    ],
  };
  const MY_REVIEWS = {
    "dune-part-two": { rating: 9.25, at: "2026-03-02", visibility: "public", body: "The rare sequel that makes the first film better in hindsight. Villeneuve shoots the desert like a cathedral, and the ending finally makes the story the warning Herbert wrote." },
    piranesi: { rating: 9.5, at: "2026-06-14", visibility: "public", body: "A small book that feels enormous on the inside. I keep thinking about the albatross." },
    "outer-wilds": { rating: 10, at: "2026-02-08", visibility: "public", body: "The only game I wish I could forget so I could play it again. Knowledge is the only upgrade, and the ending wrecked me." },
    "the-matrix-reloaded": { rating: 6.25, at: "2025-03-10", visibility: "friends", body: "A great freeway chase attached to a philosophy lecture." },
  };
  const GENERIC_REVIEWS = {
    movie: ["Stayed in my seat through the credits. That almost never happens.", "The second half drags a little, but the last twenty minutes are worth it.", "Looks incredible on the biggest screen you can find."],
    tv: ["The pilot is slow. Give it three episodes and you won't stop.", "One perfect season of television. I'd change nothing.", "Peaked early, but the cast keeps it watchable."],
    game: ["Respects your time and still manages to eat a whole weekend.", "The opening hours are rough. Then it clicks, and it's all you think about.", "Plays beautifully on a handheld."],
    book: ["Read it on a train and missed my stop.", "The prose is doing something quietly brilliant on every page.", "A slow middle, a perfect ending."],
  };
  function reviewsFor(key) {
    if (REVIEWS[key]) return REVIEWS[key];
    const { average } = community(key);
    if (average === null) return [];
    const pool = GENERIC_REVIEWS[C[key].type];
    const names = Object.keys(PEOPLE);
    const count = Math.floor(seed(`${key}rv`) * 3);
    return Array.from({ length: count }, (_, i) => {
      const by = names[Math.floor(seed(`${key}rb${i}`) * names.length)];
      return {
        by,
        rating: clamp(quarter(average + (seed(`${key}rr${i}`) - 0.5) * 2), 4, 10),
        at: `2026-${String(3 + Math.floor(seed(`${key}rm${i}`) * 8)).padStart(2, "0")}-${String(1 + Math.floor(seed(`${key}rd${i}`) * 27)).padStart(2, "0")}`,
        body: pool[(Math.floor(seed(`${key}rt`) * pool.length) + i) % pool.length],
      };
    });
  }

  // Where to watch. Names only; the real app gets these from Watchmode.
  const SERVICES = {
    Netflix: 2, Max: 262, "Apple TV+": 215, "Prime Video": 196, Hulu: 152, "Disney+": 228, Peacock: 44, "Paramount+": 218,
    Tubi: 20, "Pluto TV": 52, "Apple TV": 215, Amazon: 30, "Fandango at Home": 205, YouTube: 0,
    Steam: 210, GOG: 280, "Humble Store": 8, Fanatical: 24, "Epic Games Store": 240, GreenManGaming: 120,
  };
  const SUBSCRIPTION_SERVICES = ["Netflix", "Max", "Apple TV+", "Prime Video", "Hulu", "Disney+", "Peacock", "Paramount+"];
  const subscriptions = new Set(["Netflix", "Max", "Apple TV+"]);
  const STREAMING = {
    severance: ["Apple TV+"], "slow-horses": ["Apple TV+"], pluribus: ["Apple TV+"], silo: ["Apple TV+"], "the-studio": ["Apple TV+"],
    "the-gilded-age": ["Max"], "dune-part-two": ["Max"], "dune-2021": ["Max", "Netflix"], "the-wire": ["Max"], succession: ["Max"],
    chernobyl: ["Max"], "the-last-of-us-show": ["Max"], "house-of-the-dragon": ["Max"], "dune-prophecy": ["Max"], "spirited-away": ["Max"],
    "princess-mononoke": ["Max"], "howl-s-moving-castle": ["Max"], "mad-max-fury-road": ["Max"], "furiosa-a-mad-max-saga": ["Max", "Netflix"],
    "the-matrix": ["Max"], "the-matrix-reloaded": ["Max"], "fellowship-film": ["Max"], "two-towers-film": ["Max"],
    arcane: ["Netflix"], "stranger-things": ["Netflix"], "breaking-bad": ["Netflix"], "better-call-saul": ["Netflix"], dark: ["Netflix"],
    "the-witcher-show": ["Netflix"], "avatar-the-last-airbender": ["Netflix", "Paramount+"], "blade-runner-2049": ["Netflix"],
    "past-lives": ["Netflix"], arrival: ["Netflix", "Paramount+"], "everything-everywhere-all-at-once": ["Max"],
    shogun: ["Hulu", "Disney+"], "the-bear": ["Hulu"], parasite: ["Hulu"], andor: ["Disney+"], fallout: ["Prime Video"],
    oppenheimer: ["Peacock", "Prime Video"], "tulsa-king": ["Paramount+"], interstellar: ["Paramount+", "Prime Video"],
    "spider-man-into-the-spider-verse": ["Netflix"], whiplash: ["Netflix"], "the-grand-budapest-hotel": ["Hulu"],
    "the-martian-film": ["Disney+"], "project-hail-mary-film": [], "spider-man-brand-new-day": [],
  };
  function streaming(key) {
    const title = C[key];
    if (title.date && title.date > TODAY) return { unreleased: true };
    const subs = STREAMING[key] ?? [SUBSCRIPTION_SERVICES[Math.floor(seed(`${key}svc`) * SUBSCRIPTION_SERVICES.length)]];
    const free = seed(`${key}free`) > 0.84 ? ["Tubi"] : [];
    const price = title.type === "tv" ? [199, 299] : [399, 1499];
    const cheaper = seed(`${key}sale`) > 0.6 ? 100 : 0;
    return {
      subscription: subs,
      free,
      rent: title.type === "tv" ? [] : [["Apple TV", price[0]], ["Amazon", price[0] - cheaper], ["Fandango at Home", price[0] + 100]],
      buy: [["Apple TV", price[1]], ["Amazon", price[1] - cheaper * 2]],
      checked: "today",
    };
  }

  const GAME_PRICES = {
    "hades-ii": { regular: 2999, deals: [["Fanatical", 2249], ["Steam", 2999], ["Humble Store", 2999], ["Epic Games Store", 2999]], low: 2249 },
    "baldurs-gate-3": { regular: 5999, deals: [["GOG", 4799], ["Steam", 4799], ["Fanatical", 5099]], low: 4199 },
    "cyberpunk-2077": { regular: 5999, deals: [["GOG", 2999], ["Steam", 2999], ["Epic Games Store", 2999], ["GreenManGaming", 3239]], low: 1999 },
    "elden-ring": { regular: 5999, deals: [["GreenManGaming", 3599], ["Steam", 5999], ["Humble Store", 5999]], low: 3359 },
    hades: { regular: 2499, deals: [["Steam", 999], ["Epic Games Store", 999], ["Fanatical", 1124], ["Humble Store", 2499]], low: 749 },
  };
  function gamePrices(key) {
    const title = C[key];
    if (!title.steam) return { deals: null };
    if (title.date && title.date > TODAY) return { deals: [], unreleased: true };
    if (GAME_PRICES[key]) return GAME_PRICES[key];
    const regular = [1499, 1999, 2499, 2999, 3999, 5999][Math.floor(seed(`${key}p`) * 6)];
    const cut = [0, 0.2, 0.33, 0.5, 0.6][Math.floor(seed(`${key}c`) * 5)];
    const sale = Math.round((regular * (1 - cut)) / 100) * 100 - 1;
    const stores = ["Steam", "GOG", "Humble Store", "Fanatical"];
    return {
      regular,
      deals: stores.map((store, i) => [store, i === 0 ? sale : i === 3 ? Math.round(sale * 1.06) : regular]).sort((a, b) => a[1] - b[1]),
      low: Math.round((sale * 0.8) / 100) * 100 - 1,
    };
  }

  // Story universes: verified links between titles, drawn as one map.
  // Edge kinds: "adapt" (the second is based on the first), "sequel" (the second follows the first).
  const UNIVERSES = [
    {
      id: "dune", name: "Dune",
      blurb: "Frank Herbert's desert planet, from the 1965 novel to Denis Villeneuve's films, a prequel series, and a survival game.",
      nodes: ["dune-book", "dune-messiah", "children-of-dune", "dune-2021", "dune-part-two", "dune-part-three", "dune-prophecy", "dune-awakening"],
      edges: [["dune-book", "dune-messiah", "sequel"], ["dune-messiah", "children-of-dune", "sequel"], ["dune-book", "dune-2021", "adapt"], ["dune-book", "dune-part-two", "adapt"], ["dune-messiah", "dune-part-three", "adapt"], ["dune-2021", "dune-part-two", "sequel"], ["dune-part-two", "dune-part-three", "sequel"]],
    },
    {
      id: "the-last-of-us", name: "The Last of Us",
      blurb: "Naughty Dog's two games and the series that retells them.",
      nodes: ["the-last-of-us-game", "the-last-of-us-part-ii", "the-last-of-us-show"],
      edges: [["the-last-of-us-game", "the-last-of-us-part-ii", "sequel"], ["the-last-of-us-game", "the-last-of-us-show", "adapt"]],
    },
    {
      id: "the-witcher", name: "The Witcher",
      blurb: "Andrzej Sapkowski's stories, the games that continue them, and the series that adapts them.",
      nodes: ["the-last-wish", "the-witcher-2", "the-witcher-3", "the-witcher-show"],
      edges: [["the-witcher-2", "the-witcher-3", "sequel"], ["the-last-wish", "the-witcher-show", "adapt"], ["the-last-wish", "the-witcher-2", "sequel"]],
    },
    {
      id: "middle-earth", name: "Middle-earth",
      blurb: "Tolkien's books and Peter Jackson's films of them.",
      nodes: ["the-hobbit", "fellowship-book", "two-towers-book", "fellowship-film", "two-towers-film"],
      edges: [["the-hobbit", "fellowship-book", "sequel"], ["fellowship-book", "two-towers-book", "sequel"], ["fellowship-book", "fellowship-film", "adapt"], ["two-towers-book", "two-towers-film", "adapt"], ["fellowship-film", "two-towers-film", "sequel"]],
    },
    { id: "the-matrix", name: "The Matrix", blurb: "The Wachowskis' simulation.", nodes: ["the-matrix", "the-matrix-reloaded"], edges: [["the-matrix", "the-matrix-reloaded", "sequel"]] },
    { id: "mad-max", name: "Mad Max", blurb: "George Miller's wasteland.", nodes: ["mad-max-fury-road", "furiosa-a-mad-max-saga"], edges: [["mad-max-fury-road", "furiosa-a-mad-max-saga", "sequel"]] },
    { id: "hades", name: "Hades", blurb: "Supergiant's underworld.", nodes: ["hades", "hades-ii"], edges: [["hades", "hades-ii", "sequel"]] },
    { id: "hyrule", name: "The Legend of Zelda", blurb: "Hyrule, twice over.", nodes: ["breath-of-the-wild", "tears-of-the-kingdom"], edges: [["breath-of-the-wild", "tears-of-the-kingdom", "sequel"]] },
    { id: "hallownest", name: "Hollow Knight", blurb: "Team Cherry's buried kingdoms.", nodes: ["hollow-knight", "silksong"], edges: [["hollow-knight", "silksong", "sequel"]] },
    { id: "the-martian", name: "The Martian", blurb: "Andy Weir's novel and Ridley Scott's film.", nodes: ["the-martian", "the-martian-film"], edges: [["the-martian", "the-martian-film", "adapt"]] },
    { id: "project-hail-mary", name: "Project Hail Mary", blurb: "Andy Weir's novel and its 2026 film.", nodes: ["project-hail-mary", "project-hail-mary-film"], edges: [["project-hail-mary", "project-hail-mary-film", "adapt"]] },
  ].map((universe) => ({ ...universe, nodes: universe.nodes.filter((key) => C[key]), edges: universe.edges.filter(([a, b]) => C[a] && C[b]) }));

  const LISTS = [
    {
      id: "desert-island", name: "Desert-island ten", by: "sam", visibility: "public",
      description: "If the boat only had room for ten things, in the order I'd grab them.",
      items: [["outer-wilds", "Twenty-two minutes at a time, forever."], ["spirited-away"], ["dune-book", "Long enough to last the wait for rescue."], ["breaking-bad"], ["disco-elysium"], ["piranesi", "Fitting, really."], ["mad-max-fury-road"], ["breath-of-the-wild"], ["the-wire"], ["fellowship-film"]],
    },
    { id: "worlds-to-move-to", name: "Worlds I'd move to", by: "sam", visibility: "public", description: "Rent permitting.", items: [["spirited-away"], ["breath-of-the-wild"], ["the-hobbit"], ["piranesi"], ["arcane"], ["hades"]] },
    { id: "comfort-rewatches", name: "Comfort rewatches", by: "sam", visibility: "friends", description: "For sick days and Sunday evenings.", items: [["avatar-the-last-airbender"], ["the-matrix"], ["spider-man-into-the-spider-verse"], ["fellowship-film"], ["portal-2"]] },
    { id: "2026-ranked", name: "2026, ranked as I go", by: "sam", visibility: "private", description: "Everything I finished this year.", items: [["outer-wilds"], ["piranesi"], ["dune-part-two"], ["shogun"], ["the-left-hand-of-darkness"], ["project-hail-mary-film"], ["tomorrow-x3"]] },
    { id: "better-as-films", name: "Books that became better films", by: "mara", visibility: "public", description: "Controversial. Fight me in the club.", items: [["the-martian-film"], ["fellowship-film"], ["dune-part-two"], ["arrival"], ["blade-runner-2049"]] },
    { id: "respect-my-time", name: "Games that respect my time", by: "theo", visibility: "public", description: "Done in a weekend, remembered for years.", items: [["portal-2"], ["outer-wilds"], ["return-of-the-obra-dinn"], ["celeste"], ["hades"], ["balatro"]] },
  ].map((list) => ({ ...list, items: list.items.filter(([key]) => C[key]).map(([key, note]) => ({ key, note })) }));

  const CLUBS = [
    {
      id: "slow-winter", name: "Long Books, Slow Winter", types: ["book"], access: "invite", owner: "sam", joined: true, memberCount: 8,
      description: "One doorstop a season, read slowly, argued about weekly. No spoilers past the agreed chapter.",
      members: ["sam", "priya", "lena", "mara", "jonas"], invite: "k7m2-winter",
      picks: [["jonathan-strange", "priya", null, 0], ["dune-messiah", "sam", 8.6, 3], ["the-left-hand-of-darkness", "lena", 9.1, 6], ["piranesi", "priya", 9.3, 7]],
      threads: [
        {
          id: "messiah-ch-1-12", title: "Dune Messiah, chapters 1 to 12: is Paul the villain now?", by: "priya", at: "2026-11-19", active: "2026-11-25",
          posts: [
            { by: "priya", at: "2026-11-19", body: "Twelve years have passed and sixty-one billion people are dead in his name. Herbert isn't being subtle. Did anyone else feel the first book rearrange itself in their head?" },
            { by: "sam", at: "2026-11-20", body: "The stone burner conversation did it for me. He can see every path and still can't find one that isn't a catastrophe. It reads like a man trapped inside his own legend." },
            { by: "lena", at: "2026-11-22", body: "Counterpoint: Alia is the most interesting person in this book and it isn't close." },
            { by: "jonas", at: "2026-11-25", body: "I think this is why the film changes the ending of Part Two. It needed you to already distrust him going into Part Three." },
          ],
        },
        { id: "next-pick", title: "Vote: what do we read after Jonathan Strange?", by: "lena", at: "2026-11-11", active: "2026-11-23", posts: [{ by: "lena", at: "2026-11-11", body: "Three candidates so far: The Dispossessed, The Buried Giant, Station Eleven. Make your case." }, { by: "mara", at: "2026-11-23", body: "The Dispossessed, and I will not be taking questions." }] },
        { id: "footnotes", title: "Do we read the footnotes?", by: "mara", at: "2026-10-30", active: "2026-11-02", posts: [{ by: "mara", at: "2026-10-30", body: "Jonathan Strange has a hundred and eighty-five of them. Asking for my sleep schedule." }, { by: "priya", at: "2026-11-02", body: "The footnotes are the book." }] },
      ],
    },
    {
      id: "sunday-subtitles", name: "Sunday Subtitles", types: ["movie", "tv"], access: "public", owner: "mara", joined: true, memberCount: 124,
      description: "World cinema and television, one pick every Sunday. Dubs are a bannable offense.",
      members: ["mara", "sam", "theo", "ada", "omar", "kenji"],
      picks: [["past-lives", "mara", 8.9, 41], ["shogun", "ada", 9.2, 77], ["parasite", "omar", 9.4, 102], ["spirited-away", "sam", 9.3, 96], ["dark", "kenji", 8.4, 38]],
      threads: [
        { id: "past-lives-ending", title: "Past Lives: who was the bar scene really for?", by: "mara", at: "2026-11-22", active: "2026-11-26", posts: [{ by: "mara", at: "2026-11-22", body: "Arthur sits there not understanding a word and it is somehow his scene. Discuss." }, { by: "ada", at: "2026-11-26", body: "It's for us. We're the ones at the other end of the bar guessing who they are to each other." }] },
        { id: "shogun-s2", title: "Shōgun season 2 wishlist", by: "ada", at: "2026-11-05", active: "2026-11-18", posts: [{ by: "ada", at: "2026-11-05", body: "More Mariko flashbacks is not an option, sadly." }] },
      ],
    },
    {
      id: "couch-co-op", name: "Couch Co-op", types: ["game"], access: "public", owner: "theo", joined: true, memberCount: 57,
      description: "A game a month, finished or abandoned together. Backlog shame stays outside.",
      members: ["theo", "sam", "jonas", "kenji"],
      picks: [["hades-ii", "theo", 9, 23], ["balatro", "jonas", 8.7, 31], ["baldurs-gate-3", "kenji", 9.5, 19], ["outer-wilds", "sam", 9.6, 28]],
      threads: [{ id: "hades-ii-builds", title: "Hades II: your most broken build", by: "theo", at: "2026-11-20", active: "2026-11-24", posts: [{ by: "theo", at: "2026-11-20", body: "Torches, Hestia, and no self-respect." }, { by: "jonas", at: "2026-11-24", body: "Axe with Poseidon. I have not been hit since Tuesday." }] }],
    },
    { id: "adaptation-court", name: "The Adaptation Court", types: ["book", "movie", "tv", "game"], access: "public", owner: "ada", joined: false, memberCount: 312, description: "We read it, we watch it, we deliver a verdict. Book against film against series against game.", members: ["ada", "omar", "priya"], picks: [["dune-book", "ada", 9, 140], ["dune-part-two", "ada", 8.8, 151], ["the-last-of-us-show", "omar", 8.3, 97], ["the-last-of-us-game", "omar", 9.4, 88]], threads: [] },
    { id: "prestige-anonymous", name: "Prestige TV Anonymous", types: ["tv"], access: "public", owner: "omar", joined: false, memberCount: 203, description: "Hi, we're still thinking about that finale.", members: ["omar", "lena"], picks: [["the-wire", "omar", 9.5, 120], ["succession", "lena", 9.1, 133], ["better-call-saul", "omar", 9.3, 110]], threads: [] },
    { id: "backlog-busters", name: "Backlog Busters", types: ["game"], access: "public", owner: "kenji", joined: false, memberCount: 89, description: "Pick one game you already own. Finish it. Report back.", members: ["kenji", "jonas"], picks: [["disco-elysium", "kenji", 9.4, 52], ["celeste", "jonas", 9, 47], ["return-of-the-obra-dinn", "kenji", 9.1, 33]], threads: [] },
  ].map((club) => ({ ...club, picks: club.picks.filter(([key]) => C[key]).map(([key, by, average, count]) => ({ key, by, average, count })) }));

  const FEED = [
    { who: "mara", kind: "review", key: "severance", rating: 9.5, at: "2026-11-26", body: REVIEWS.severance[0].body },
    { who: "theo", kind: "library", key: "hades-ii", status: "finished", rating: 9.25, at: "2026-11-26" },
    { who: "priya", kind: "library", key: "dune-messiah", status: "finished", rating: 8.25, at: "2026-11-25" },
    { who: "jonas", kind: "list", list: "respect-my-time", owner: "theo", at: "2026-11-25", shared: true },
    { who: "lena", kind: "library", key: "pluribus", status: "in_progress", rating: null, at: "2026-11-25" },
    { who: "mara", kind: "list", list: "better-as-films", at: "2026-11-24" },
    { who: "theo", kind: "review", key: "outer-wilds", rating: 10, at: "2026-11-23", body: "I have nothing to add except: don't look anything up. Not one thing." },
    { who: "priya", kind: "library", key: "jonathan-strange", status: "in_progress", rating: null, at: "2026-11-22" },
    { who: "lena", kind: "library", key: "past-lives", status: "finished", rating: 9, at: "2026-11-22" },
    { who: "jonas", kind: "library", key: "silksong", status: "dropped", rating: 7, at: "2026-11-21" },
    { who: "mara", kind: "library", key: "the-gilded-age", status: "in_progress", rating: 8.5, at: "2026-11-20" },
    { who: "theo", kind: "library", key: "fable", status: "want", rating: null, at: "2026-11-19" },
  ].filter((item) => !item.key || C[item.key]);

  const ALERTS = [
    { key: "blade-runner-2049", kind: "mine", state: "fired", set: "2026-09-30", fired: "2026-11-24", service: "Netflix" },
    { key: "hades-ii", kind: "price", state: "fired", set: "2026-10-01", fired: "2026-11-25", target: 2400, store: "Fanatical", price: 2249 },
    { key: "oppenheimer", kind: "mine", state: "waiting", set: "2026-06-01", checked: "2026-11-26" },
    { key: "project-hail-mary-film", kind: "any", state: "waiting", set: "2026-03-22", checked: "2026-11-25" },
    { key: "dune-part-three", kind: "any", state: "waiting", set: "2026-11-02", checked: "2026-11-26" },
    { key: "baldurs-gate-3", kind: "price", state: "waiting", set: "2026-05-30", checked: "2026-11-26", target: 3999, price: 4799 },
    { key: "cyberpunk-2077", kind: "price", state: "waiting", set: "2026-10-02", checked: "2026-11-26", target: 2000, price: 2999 },
  ].filter((alert) => C[alert.key]);

  const RECOMMENDATIONS = [
    { seed: "spirited-away", keys: ["princess-mononoke", "howl-s-moving-castle", "the-grand-budapest-hotel", "interstellar"] },
    { seed: "breaking-bad", keys: ["better-call-saul", "succession", "dark", "the-studio", "stranger-things", "silo"] },
    { seed: "outer-wilds", keys: ["return-of-the-obra-dinn", "celeste", "expedition-33", "red-dead-redemption-2", "the-witcher-2"] },
    { seed: "the-left-hand-of-darkness", keys: ["the-dispossessed", "a-wizard-of-earthsea"], author: "Ursula K. Le Guin" },
    { seed: "mad-max-fury-road", keys: ["furiosa-a-mad-max-saga", "whiplash", "interstellar", "the-grand-budapest-hotel"] },
    { seed: "piranesi", keys: ["the-buried-giant", "klara-and-the-sun", "station-eleven", "three-body-problem"], loose: true },
  ].map((row) => ({ ...row, keys: row.keys.filter((key) => C[key] && !library[key]) }));

  const SUGGESTIONS = [
    { a: "dune-messiah", b: "dune-part-three", relation: "adapt", source: "Wikidata" },
    { a: "dune-book", b: "dune-prophecy", relation: "same", source: "Wikidata" },
    { a: "dune-book", b: "dune-awakening", relation: "same", source: "Wikidata" },
    { a: "the-last-of-us-part-ii", b: "the-last-of-us-show", relation: "adapt", source: "Wikidata" },
    { a: "the-witcher-3", b: "cyberpunk-2077", relation: "same", source: "Wikidata" },
  ].filter((suggestion) => C[suggestion.a] && C[suggestion.b]);

  /** Everyone's average for one episode, steady per show and a little higher toward a finale. */
  function episodeAverage(key, season, episode, total) {
    const base = community(key).average ?? 8;
    const lift = (episode / total) * 0.5;
    return clamp(Number((base - 0.7 + lift + (seed(`${key}s${season}e${episode}`) - 0.5) * 1.5).toFixed(1)), 5.5, 9.9);
  }
  const episodeRatings = {};
  for (let episode = 1; episode <= 9; episode++) episodeRatings[`severance-1-${episode}`] = Math.round(quarter(8.4 + seed(`mine1${episode}`) * 1.5) * 4);
  for (let episode = 1; episode <= 6; episode++) episodeRatings[`severance-2-${episode}`] = Math.round(quarter(8.2 + seed(`mine2${episode}`) * 1.7) * 4);

  window.DATA = {
    TODAY, ME, PEOPLE, SERVICES, SUBSCRIPTION_SERVICES, UNIVERSES, LISTS, CLUBS, FEED, ALERTS, RECOMMENDATIONS, SUGGESTIONS, MY_REVIEWS,
    library, ratings, subscriptions, episodeRatings,
    community, distribution, friendRatings, reviewsFor, streaming, gamePrices, episodeAverage, seed,
  };
})();
