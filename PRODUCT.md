# Yousiverse product

Yousiverse catalogs movies, TV shows, video games, and books in one place. It takes the best features of similar apps, improves them, and adds new ones. It should feel fast, clean, and modern everywhere. US market first.

## In the app

### Foundation

- **App shell:** header, navigation, and a home page with a search box and a shelf of the titles most recently added to the catalog. The shelf can be filtered by type and each title links to its page. Light and dark mode, keyboard navigable.
- **Sign-in:** Google. A protected account page shows email and join date, with sign out.
- **Usernames:** on the account page a person chooses a username and a display name. Public reviews and lists are credited to the username; until one is chosen they show no name. Email addresses and Google account names are never shown to others.
- **Development sign-in:** email sign-in link printed to the server terminal. Not available in production.

### Profiles

- **Public profile pages** at `/u/<username>` for everyone who has chosen a username, showing their display name, public library (filterable by type and status), public lists, and public reviews. Anything marked private is left out, for the owner too, so a profile always shows what other people see.
- Usernames on reviews and lists link to the author's profile.

### Catalog

- **Search** for movies, TV shows, games, and books by title, with results as you type. Results are grouped by type and each group appears as soon as its source answers. A filter narrows the search to one type. If one source is down, the rest still show and the page says what is missing.
- **Movie pages:** poster, description, release date, runtime, and genres.
- **TV show pages:** poster, description, first air date, status, and genres, with every season listed. Each season has its own page listing its episodes with air date, runtime, and description.
- **Book pages:** cover, author, description, year first published, length, and subjects.
- **Game pages:** cover, description, release date, developer, publisher, platforms, and genres.
- Titles are added to the catalog the first time someone opens them and refreshed weekly. Movie and TV data comes from TMDB, game data from IGDB, and book data from Open Library.

### Library

- **Personal library** across all four media types. Each title page has a status control: want, in progress, finished, or dropped, worded for the type (want to read, playing). A title can be marked so only its owner can see it, and removed again.
- **Library page** showing everything in the library, most recently changed first, filterable by media type and by status.
- Library entries are public by default and appear on their owner's profile.

### Ratings

- **Ratings out of 10 in 0.25 steps** on every title, set with a slider on the title's page and saved automatically. A rating can be changed or cleared.
- **TV episode ratings:** each episode can be rated from its season page, separately from the rating for the whole show.
- Title and season pages show the average rating and how many people rated, to everyone.

### Reviews

- **Text reviews** on every title: one per person, which can be edited or deleted. Reviews are public by default and can be marked so only the author sees them.
- **TV episode pages**, opened from a season, where an episode can be rated and reviewed separately from its show.
- A title's or episode's page lists other people's public reviews, newest first, each with its author's username and rating.

### Lists

- **Custom lists** holding any mix of movies, shows, games, and books, each with a name and an optional description. Titles are added and removed from their own pages, or removed from the list's page, and appear in the order they were added.
- **Lists page** showing a person's lists and how many titles each holds, with a form to create a new one.
- Lists are public by default: anyone with the link can open one. A list can be made private, renamed, or deleted by its owner.

### Where to watch

- **Movie and TV show pages list where to watch** in the US: streaming subscriptions, free services, services that need a TV provider login, and rent and buy prices, each linking to the title on that service. Prices for TV shows are for one episode. Data comes from Watchmode and is checked at most once a week per title.
- **Game pages list what the game costs in US PC stores**, cheapest first, with any discount and the lowest price it has ever had. Each store links to the game there. Data comes from IsThereAnyDeal, found through the game's Steam id, so games that were never on Steam have no prices. Console prices are not covered, and the page says so.
- **Your subscriptions:** on the account page a person ticks the streaming services they pay for. Movie and show pages then list those first, under "Your subscriptions". A person's subscriptions are never shown to anyone else.
- Book prices are not covered.

## Future features

### Library and catalog

- **Authors in book search results**, to tell apart books that share a title.
- **Google Books** as a second source for books, if Open Library's data proves thin.
- **Cast and crew** on movie and TV pages.
- **Reordering the titles on a list** by hand.
- **Release calendar** of upcoming releases, filterable by media type and by items in the user's library.
- **Time budget filter:** find things that fit the time you have. Uses movie/episode runtime, book page count or audiobook length, and game time-to-beat where reliable data exists.

### Ratings and reviews

- **Optional rating questionnaire:** a few short questions per medium on its key axes (e.g. movies: plot, acting, action, visuals). Kept light, never required.

### Where to watch, play, or read

- **Price drop and availability alerts.**
- **Console game and book prices.** Both have thinner data than PC games; show clearly what isn't covered.

### Franchises

- **Cross-media franchise linking** (e.g. Harry Potter books to the movies to the games). Any media type can link to any other, but only when the connection is accurate. Links are verified before they appear; suggestions (e.g. from Wikidata) stay hidden until reviewed.

### Accounts and sign-in

- **Emailed sign-in links** for sign-up and sign-in, alongside the Google sign-in already in the app.
- **Apple sign-in**, added later; it needs a paid Apple Developer membership. Apple requires it (or an equivalent) in any iOS app that offers Google sign-in, so it must be in place before an iOS app ships.
- Passkeys are not planned.

### Social

- **Friends and following.**
- **Clubs/groups:** cross-medium clubs that are invite-only or public. The creator picks which media types the club covers, and the club only shows those (a book club sees only books).

### Recommendations

- **Taste-based recommendations** for each user.
- **Recommendations for two friends together** (things both would enjoy).

### Imports and connected accounts

- **Import from competitors** where viable: Letterboxd, Goodreads, StoryGraph, IMDb (CSV exports), Trakt (API).
- **Connect other accounts** to sync libraries and activity: Steam (Web API) first. Xbox and PlayStation only have unofficial APIs, so treat them as experimental. Epic and Kindle currently have no usable API.

### Platforms

- **Mobile app** (iOS and Android) after the web app is established.
