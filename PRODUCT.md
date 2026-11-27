# Yousiverse product

Yousiverse catalogs movies, TV shows, video games, and books in one place. It takes the best features of similar apps, improves them, and adds new ones. It should feel fast, clean, and modern everywhere. US market first.

## In the app

### Foundation

- **App shell:** a sidebar with every section and the person's clubs, which becomes a tab bar on a phone. Night and day looks, night by default, chosen from the person's menu. Keyboard navigable. Every medium keeps its own shape wherever it is shown: a movie is a poster, a show a wide screen with its name on it, a game a case, a book a book.
- **Search palette:** Search in the sidebar (or ⌘K) opens a palette over any page. Empty, it offers what the person has in progress, the sections, and their lists and clubs; typing finds titles, people, and universes, with a way through to the full search page.
- **Front door:** a signed-out visitor to the home page sees what the app is, over a wall of artwork from the catalog, with sign-in on the page.
- **Home:** a signed-in person's home page opens on the title they are in the middle of, with its next episode (which can be marked watched there), their progress, and their other titles in progress. Below it: what is coming up from their library in the next 90 days, "Ready when you are" (titles they want that are on a service they pay for, from availability the app already holds), what the people they follow did lately, alerts that came through, their clubs' latest discussions, and a shelf of suggestions. A new account sees three ways to start: search, import, and people to follow.
- **Sign-in:** with Google, or with a link sent by email. Entering an email address sends a link that signs the person in, creating their account the first time; there is no password. The link works once and for 10 minutes, and the database keeps only a hash of it. After sending, the form is replaced by "Check your email" with the address, a "Send again" button that unlocks after 30 seconds, and a way to use a different email. A protected account page shows email and join date, with sign out.
- **Limits on sign-in emails:** one address is sent at most three links in 15 minutes, and the app sends at most 95 emails a day in all, which is what its email service allows. The sign-in page says so when a limit is reached.
- **Usernames:** on the account page a person chooses a username and a display name. Public reviews and lists are credited to the username; until one is chosen they show no name. Email addresses and Google account names are never shown to others.
- **Development sign-in:** outside production the sign-in link is printed to the server terminal instead of emailed, and no email is sent.

### Profiles

- **Public profile pages** at `/u/<username>` for everyone who has chosen a username, showing their display name, library (filterable by type and status), lists, and reviews. Visitors see what is public, friends also see what is friends only, and the owner sees their own profile as the public does.
- **Taste in numbers:** a profile shows how many titles of each medium the person has and what they rate them on average, how their ratings spread from 0 to 10, and the titles they rated highest. It counts only what the viewer may see.
- **In tune:** on someone else's profile a signed-in person sees how closely their ratings agree, as a percentage over the titles both rated, and titles both loved. It appears once they share enough rated titles to mean something.
- Usernames on reviews and lists link to the author's profile.

### Following

- **Follow anyone with a profile**, with no approval needed, and unfollow again. Two people who follow each other are friends.
- Profiles show how many followers a person has and how many people they follow, each opening a page that lists them. Followers who have not chosen a username are counted but not named.
- **Friends-only privacy:** a library entry, review, or list can be shown to everyone, to friends only, or to its owner alone. Friends-only content appears to friends on the owner's profile, on title pages, and at a list's link; everyone else sees nothing.
- **Feed:** a page listing what the people a person follows have lately added to their libraries (with their rating), reviewed, and made lists of, newest first, 40 at a time with a link to older activity. It only includes what the viewer is allowed to see.
- **Finding people:** searching also matches usernames and display names, and lists the people found above the titles.
- **People to follow:** beside the feed, the app suggests people the person does not follow yet: those who follow them, then those followed by the people they follow.

### Catalog

- **Search** for movies, TV shows, games, and books by title, with results as you type. Results are grouped by type and each group appears as soon as its source answers. A filter narrows the search to one type. If one source is down, the rest still show and the page says what is missing. A book's result names its authors, and a title already in the person's library is marked. People and universes that match are listed too.
- **Movie pages:** poster, description, release date, runtime, and genres.
- **TV show pages:** a wide picture, description, first air date, status, and genres. Every episode is on the page, a season at a time, with air date, runtime, and description, under a grid of all the episodes colored by everyone's average rating. Each season also has its own page.
- A title's page takes its color from its artwork, measured once when the title is saved.
- **Book pages:** cover, author, description, year first published, length, and subjects.
- **Game pages:** cover, description, release date, developer, publisher, platforms, and genres.
- Titles are added to the catalog the first time someone opens them and refreshed weekly. Movie and TV data comes from TMDB, game data from IGDB, and book data from Open Library.

### Library

- **Personal library** across all four media types. Each title page has a status control: want, in progress, finished, or dropped, worded for the type (want to read, playing). A title can be shown to everyone, friends only, or its owner alone, and removed again.
- **Library page** showing everything in the library on a shelf per status, filterable by media type and by status, and sorted by most recently changed, by the person's rating, or by name.
- **Board:** the library can also be seen as four columns, one per status. A title is moved by dragging it to another column or from its menu, and can be removed there.
- **Progress:** a show's episodes can each be ticked as watched, from the show's page, an episode's page, or Home, and the show then says which episode is next. A book records the page reached and a game the hours played. Ticking an episode of a show that is not in the library, or only wanted, puts it in progress.
- Library entries are public by default and appear on their owner's profile.

### Ratings

- **Ratings out of 10 in 0.25 steps** on every title, set on the title's page by dragging, clicking, or the arrow keys along a scale, and saved automatically. A rating can be changed or cleared.
- The scale is drawn over how everyone's ratings of the title spread from 0 to 10, and marks where the people the viewer follows rated it. A followed person's rating is shown only where their library entry for the title is visible to the viewer.
- **TV episode ratings:** each episode can be rated from its own page, separately from the rating for the whole show.
- Title and episode pages show the average rating and how many people rated, to everyone.

### Reviews

- **Text reviews** on every title: one per person, which can be edited or deleted. Reviews are public by default and can be limited to friends or to the author alone.
- **TV episode pages**, opened from a season, where an episode can be rated and reviewed separately from its show.
- A title's or episode's page lists other people's public reviews, newest first, each with its author's username and rating.

### Lists

- **Custom lists** holding any mix of movies, shows, games, and books, each with a name and an optional description. Titles are added and removed from their own pages, or removed from the list's page, and appear in the order they were added. The owner can write a note beside each title.
- **Lists page** showing a person's lists and how many titles each holds, with a way to create a new one, and the lists made by people they follow.
- Lists are public by default: anyone with the link can open one. A list can be limited to friends or made private, renamed, or deleted by its owner.

### Where to watch

- **Movie and TV show pages list where to watch** in the US: streaming subscriptions, free services, services that need a TV provider login, and rent and buy prices, each linking to the title on that service. Prices for TV shows are for one episode. Data comes from Watchmode and is checked at most once a week per title. Every service and store is shown with its own icon.
- **Game pages list what the game costs in US PC stores**, cheapest first, with any discount and the lowest price it has ever had. Each store links to the game there. Data comes from IsThereAnyDeal, found through the game's Steam id, so games that were never on Steam have no prices. Console prices are not covered, and the page says so.
- **Your subscriptions:** on the account page a person ticks the streaming services they pay for. A movie or show on one of them then opens its where-to-watch panel with "Included with your subscriptions" and a button to watch it there. A person's subscriptions are never shown to anyone else.
- Book prices are not covered.

### Release calendar

- **A calendar of the next 90 days**, by week and then by month: movies and games on their release dates, and shows by episode, with a show's episodes on one day listed together. Each entry links to its title and says how far off it is; one that is not in the person's library can be put on their want list from there. Small month grids beside the list mark the days with something on them. Dates are US calendar days.
- A signed-in person sees the titles in their library that they have not dropped, and can switch to the whole catalog. Signed-out visitors see the whole catalog. Both can be filtered by movies, TV, or games.
- Every morning the app fetches fresh details for up to 150 library titles whose dates could still change: shows that have not ended, and movies and games not yet out, just out, or undated. That is how new seasons and moved dates reach the calendar.
- Books are not on the calendar: their source gives no release dates.

### Alerts

- **Availability alerts:** from a movie's or show's page a person asks to be told when it reaches one of the services they subscribe to, or when it can be streamed at all (on a subscription or a free service).
- **Price alerts:** from a game's page a person names a price and is told when a PC store sells the game for that or less.
- An alert that would have nothing to wait for is refused with the reason: the title is already there, or already that cheap. A person can hold up to 100 alerts.
- **Checked once a day.** Every morning the app refreshes availability and prices for the titles people are waiting on and emails each person once about everything of theirs that came through. An alert fires once, then stays on record until it is removed or set again.
- **Alerts page** listing what came through and what is still waiting, with a switch for alert emails. Every alert email has a link that stops them without signing in. With emails off, alerts still show on the page.
- The availability source allows 2,500 requests a month, so at most 60 movies and shows are refreshed a day for alerts, the longest unchecked first. With more than that waiting, each is checked less often than daily. At most 60 alert emails go out a day; the rest wait for the next morning.

### Clubs

- **Clubs** are groups around some kinds of titles. Whoever starts a club names it, describes it, and picks which media types it covers (a book club covers only books).
- A club is **public**, so anyone can find and join it, or **invite only**, so it can be seen and joined only through its invite link. The owner can make a new link, which stops the old one working.
- The clubs page lists a person's clubs and the public clubs they could join. A club's page shows what it covers, who runs it, and its members.
- **Club picks:** any member can pick a title for a club from the title's page, as long as it is a kind the club covers; the page only offers clubs that do. The club's page shows its picks with the average of its members' ratings. A member can remove their own picks and the owner any pick. If a club stops covering a media type, picks of that type stop showing.
- **Club discussions:** any member can start a discussion with a title and an opening post, and members reply underneath. A club lists its discussions with the most recently active first. Anyone can read a public club's discussions; an invite-only club's are for its members. A post can be deleted by whoever wrote it or by the club's owner, and it stays, without a name, if its author's account is deleted. Posts cannot be edited.
- Members can leave. The owner can change the club's details, remove members, and delete the club. Starting or joining a club needs a username, because members are shown by username.

### Youniverses

- **A universe** is every title joined by verified links, across all four media types: the books, the films made from them, the show, the game. The Youniverses page lists them all, each with how much of it the person has finished.
- **A universe's page** draws its titles as a map of what is based on what and what follows what, then lists them in order with the person's status and rating beside each. Titles they do not have can be put on their want list one at a time or all at once. A reviewer gives a universe its name and description; until then it goes by its first title.
- **On a title's page** a strip shows the rest of its universe around it: what it is based on, its adaptations, what it follows and what follows it. Two titles are linked at most once.
- **Links are verified before they appear.** Suggestions come from Wikidata and stay hidden until a reviewer approves them; a rejected suggestion is not raised again. A reviewer can also link two titles by hand, and remove a link.
- **Reviewing** happens on one page, open only to the people named in the app's settings. It looks titles up on Wikidata while the page is open, one at a time, newest first, and each title again a month later.

### Recommendations

- **For you:** a page of titles like the ones a person rated 7 or higher, in one row per liked title ("Because you rated Hades 8"), drawn from up to eight of their highest ratings. It leaves out anything already in their library or rated by them, and shows each suggestion once.
- Movie and show suggestions are TMDB's recommendations and game suggestions are IGDB's similar games. Open Library has no similar books, so a liked book suggests its author's other books that have an English edition.
- A title's suggestions are fetched the first time they are needed and kept for a month. If a source is down, the page shows the rest and says some are missing.
- **How long have you got?** The person picks an hour, two hours, an evening, or a weekend, and sees what in their library fits: a movie by its runtime, a show by as many of its next unwatched episodes as the time holds, a book by its pages at 40 pages an hour. What they are already in the middle of comes first. Games are left out, because nothing says how long one takes.
- **Something for two:** the person picks someone they follow and sees titles for both of them: ones they want that the other rated highly, ones both want, ones they rated highly that the other wants, and the other's favorites they have not tried. It draws only on what the other person lets them see.

### Imports

- **Import from Letterboxd, IMDb, Goodreads, and StoryGraph:** a person uploads the files those services export, and the films, shows, and books in them are matched to the catalog and added to their library with status, rating, and review. The person chooses who can see what is imported.
- **Import from Steam:** a person pastes their Steam profile address or ID, and the games on the account are added. Games never played go in as wanted; played games go in at a status the person picks, because Steam cannot tell finished from unfinished, and with the hours Steam recorded for them. The profile's game details must be public.
- **Import from Trakt:** a person enters their Trakt username, and the movies and shows they watched, rated, and put on their watchlist are added. A show counts as finished once every aired episode has been played. The Trakt profile has to be public.
- Matching runs while the import's page is open and shows its progress; leaving and coming back carries on. The page then lists what was added, what was already there, and what could not be matched, with a search link for each unmatched title.
- An import never changes anything already in the library: an existing status, rating, or review is kept.
- Letterboxd films are matched by title and year, IMDb titles by their IMDb id, and books by ISBN or, failing that, by exact title and author. A match has to be confident: anything doubtful is reported as not found instead of guessed. Single episodes and games in an IMDb export are left out, as are unrated books on shelves of a person's own making.

## Future features

### Library and catalog

- **Google Books** as a second source for books, if Open Library's data proves thin.
- **Cast and crew** on movie and TV pages.
- **Reordering the titles on a list** by hand.
- **Games and audiobooks in "How long have you got?"**, where reliable data exists for how long a game takes or an audiobook runs.
- **Watched episodes from Trakt:** an import brings in which shows were watched, but not which episodes.

### Ratings and reviews

- **Optional rating questionnaire:** a few short questions per medium on its key axes (e.g. movies: plot, acting, action, visuals). Kept light, never required.

### Where to watch, play, or read

- **More kinds of alert:** a title leaving a service, a new season, a game reaching its lowest price ever.
- **Console game and book prices.** Both have thinner data than PC games; show clearly what isn't covered.

### Accounts and sign-in

- **Apple sign-in**, added later; it needs a paid Apple Developer membership. Apple requires it (or an equivalent) in any iOS app that offers Google sign-in, so it must be in place before an iOS app ships.
- Passkeys are not planned.

### Social

- **Club invites by email**, and editing a discussion post after it is sent.

### Recommendations

- **Similar books** beyond the same author, if a source for them turns up.

### Imports and connected accounts

- **Import private Trakt profiles** by signing in to Trakt (today only public profiles can be imported).
- **Keep connected accounts in sync automatically** (today a Steam import is run by hand and can be run again). Xbox and PlayStation only have unofficial APIs, so treat them as experimental. Epic and Kindle currently have no usable API.

### Platforms

- **Mobile app** (iOS and Android) after the web app is established.
