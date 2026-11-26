# Yousiverse product

Yousiverse catalogs movies, TV shows, video games, and books in one place. It takes the best features of similar apps, improves them, and adds new ones. It should feel fast, clean, and modern everywhere. US market first.

## In the app

### Foundation

- **App shell:** header, navigation, and a home page with a search box and a shelf of the titles most recently added to the catalog. The shelf can be filtered by type and each title links to its page. Light and dark mode, keyboard navigable.
- **Sign-in:** with Google, or with a link sent by email. Entering an email address sends a link that signs the person in, creating their account the first time; there is no password. The link works once and for 10 minutes, and the database keeps only a hash of it. After sending, the form is replaced by "Check your email" with the address, a "Send again" button that unlocks after 30 seconds, and a way to use a different email. A protected account page shows email and join date, with sign out.
- **Limits on sign-in emails:** one address is sent at most three links in 15 minutes, and the app sends at most 95 emails a day in all, which is what its email service allows. The sign-in page says so when a limit is reached.
- **Usernames:** on the account page a person chooses a username and a display name. Public reviews and lists are credited to the username; until one is chosen they show no name. Email addresses and Google account names are never shown to others.
- **Development sign-in:** outside production the sign-in link is printed to the server terminal instead of emailed, and no email is sent.

### Profiles

- **Public profile pages** at `/u/<username>` for everyone who has chosen a username, showing their display name, library (filterable by type and status), lists, and reviews. Visitors see what is public, friends also see what is friends only, and the owner sees their own profile as the public does.
- Usernames on reviews and lists link to the author's profile.

### Following

- **Follow anyone with a profile**, with no approval needed, and unfollow again. Two people who follow each other are friends.
- Profiles show how many followers a person has and how many people they follow, each opening a page that lists them. Followers who have not chosen a username are counted but not named.
- **Friends-only privacy:** a library entry, review, or list can be shown to everyone, to friends only, or to its owner alone. Friends-only content appears to friends on the owner's profile, on title pages, and at a list's link; everyone else sees nothing.
- **Feed:** a page listing what the people a person follows have lately added to their libraries (with their rating), reviewed, and made lists of, newest first, 40 at a time with a link to older activity. It only includes what the viewer is allowed to see.
- **Finding people:** searching also matches usernames and display names, and lists the people found above the titles.

### Catalog

- **Search** for movies, TV shows, games, and books by title, with results as you type. Results are grouped by type and each group appears as soon as its source answers. A filter narrows the search to one type. If one source is down, the rest still show and the page says what is missing.
- **Movie pages:** poster, description, release date, runtime, and genres.
- **TV show pages:** poster, description, first air date, status, and genres, with every season listed. Each season has its own page listing its episodes with air date, runtime, and description.
- **Book pages:** cover, author, description, year first published, length, and subjects.
- **Game pages:** cover, description, release date, developer, publisher, platforms, and genres.
- Titles are added to the catalog the first time someone opens them and refreshed weekly. Movie and TV data comes from TMDB, game data from IGDB, and book data from Open Library.

### Library

- **Personal library** across all four media types. Each title page has a status control: want, in progress, finished, or dropped, worded for the type (want to read, playing). A title can be shown to everyone, friends only, or its owner alone, and removed again.
- **Library page** showing everything in the library, most recently changed first, filterable by media type and by status.
- Library entries are public by default and appear on their owner's profile.

### Ratings

- **Ratings out of 10 in 0.25 steps** on every title, set with a slider on the title's page and saved automatically. A rating can be changed or cleared.
- **TV episode ratings:** each episode can be rated from its season page, separately from the rating for the whole show.
- Title and season pages show the average rating and how many people rated, to everyone.

### Reviews

- **Text reviews** on every title: one per person, which can be edited or deleted. Reviews are public by default and can be limited to friends or to the author alone.
- **TV episode pages**, opened from a season, where an episode can be rated and reviewed separately from its show.
- A title's or episode's page lists other people's public reviews, newest first, each with its author's username and rating.

### Lists

- **Custom lists** holding any mix of movies, shows, games, and books, each with a name and an optional description. Titles are added and removed from their own pages, or removed from the list's page, and appear in the order they were added.
- **Lists page** showing a person's lists and how many titles each holds, with a form to create a new one.
- Lists are public by default: anyone with the link can open one. A list can be limited to friends or made private, renamed, or deleted by its owner.

### Where to watch

- **Movie and TV show pages list where to watch** in the US: streaming subscriptions, free services, services that need a TV provider login, and rent and buy prices, each linking to the title on that service. Prices for TV shows are for one episode. Data comes from Watchmode and is checked at most once a week per title.
- **Game pages list what the game costs in US PC stores**, cheapest first, with any discount and the lowest price it has ever had. Each store links to the game there. Data comes from IsThereAnyDeal, found through the game's Steam id, so games that were never on Steam have no prices. Console prices are not covered, and the page says so.
- **Your subscriptions:** on the account page a person ticks the streaming services they pay for. Movie and show pages then list those first, under "Your subscriptions". A person's subscriptions are never shown to anyone else.
- Book prices are not covered.

### Release calendar

- **A calendar of the next 90 days**, by month and day: movies and games on their release dates, and shows by episode, with a show's episodes on one day listed together. Each entry links to its title. Dates are US calendar days.
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

### Franchises

- **Related titles:** a title's page lists the titles it is linked to, across all four media types: what it is based on, its adaptations, what it follows and what follows it, and the rest of its franchise. Two titles are linked at most once.
- **Links are verified before they appear.** Suggestions come from Wikidata and stay hidden until a reviewer approves them; a rejected suggestion is not raised again. A reviewer can also link two titles by hand, and remove a link.
- **Reviewing** happens on one page, open only to the people named in the app's settings. It looks titles up on Wikidata while the page is open, one at a time, newest first, and each title again a month later.

### Recommendations

- **For you:** a page of titles like the ones a person rated 7 or higher, in one row per liked title ("Because you rated Hades 8"), drawn from up to eight of their highest ratings. It leaves out anything already in their library or rated by them, and shows each suggestion once.
- Movie and show suggestions are TMDB's recommendations and game suggestions are IGDB's similar games. Open Library has no similar books, so a liked book suggests its author's other books that have an English edition.
- A title's suggestions are fetched the first time they are needed and kept for a month. If a source is down, the page shows the rest and says some are missing.

### Imports

- **Import from Letterboxd, IMDb, Goodreads, and StoryGraph:** a person uploads the files those services export, and the films, shows, and books in them are matched to the catalog and added to their library with status, rating, and review. The person chooses who can see what is imported.
- **Import from Steam:** a person pastes their Steam profile address or ID, and the games on the account are added. Games never played go in as wanted; played games go in at a status the person picks, because Steam cannot tell finished from unfinished. The profile's game details must be public.
- **Import from Trakt:** a person enters their Trakt username, and the movies and shows they watched, rated, and put on their watchlist are added. A show counts as finished once every aired episode has been played. The Trakt profile has to be public.
- Matching runs while the import's page is open and shows its progress; leaving and coming back carries on. The page then lists what was added, what was already there, and what could not be matched, with a search link for each unmatched title.
- An import never changes anything already in the library: an existing status, rating, or review is kept.
- Letterboxd films are matched by title and year, IMDb titles by their IMDb id, and books by ISBN or, failing that, by exact title and author. A match has to be confident: anything doubtful is reported as not found instead of guessed. Single episodes and games in an IMDb export are left out, as are unrated books on shelves of a person's own making.

## Future features

### Library and catalog

- **Authors in book search results**, to tell apart books that share a title.
- **Google Books** as a second source for books, if Open Library's data proves thin.
- **Cast and crew** on movie and TV pages.
- **Reordering the titles on a list** by hand.
- **Time budget filter:** find things that fit the time you have. Uses movie/episode runtime, book page count or audiobook length, and game time-to-beat where reliable data exists.

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

- **Recommendations for two friends together** (things both would enjoy).
- **Similar books** beyond the same author, if a source for them turns up.

### Imports and connected accounts

- **Import private Trakt profiles** by signing in to Trakt (today only public profiles can be imported).
- **Keep connected accounts in sync automatically** (today a Steam import is run by hand and can be run again). Xbox and PlayStation only have unofficial APIs, so treat them as experimental. Epic and Kindle currently have no usable API.

### Platforms

- **Mobile app** (iOS and Android) after the web app is established.
