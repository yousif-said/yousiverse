# Yousiverse product

Yousiverse catalogs movies, TV shows, video games, and books in one place. It takes the best features of similar apps, improves them, and adds new ones. It should feel fast, clean, and modern everywhere. US market first.

## In the app

### Foundation

- **App shell:** header, navigation, and a home page with a search box and a shelf of the titles most recently added to the catalog. The shelf can be filtered by type and each title links to its page. Light and dark mode, keyboard navigable.
- **Sign-in:** Google. A protected account page shows name, email, and join date, with sign out.
- **Development sign-in:** email sign-in link printed to the server terminal. Not available in production.

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
- Library entries are public by default. Nothing shows another person's library yet; that arrives with profiles.

## Future features

### Library and catalog

- **Authors in book search results**, to tell apart books that share a title.
- **Google Books** as a second source for books, if Open Library's data proves thin.
- **Cast and crew** on movie and TV pages.
- **Custom lists and shelves**, public or private.
- **Release calendar** of upcoming releases, filterable by media type and by items in the user's library.
- **Time budget filter:** find things that fit the time you have. Uses movie/episode runtime, book page count or audiobook length, and game time-to-beat where reliable data exists.

### Ratings and reviews

- **Ratings out of 10 in 0.25 increments.**
- **Optional rating questionnaire:** a few short questions per medium on its key axes (e.g. movies: plot, acting, action, visuals). Kept light, never required.
- **Text reviews** on any media, public or private.
- **TV episode reviews and ratings** (optional), alongside a rating for the whole show.

### Where to watch, play, or read

- **Availability and pricing** for every item: where it's available, what's cheapest, and which of the user's subscriptions already include it.
- **Price drop and availability alerts.**
- Data notes: movies/TV via Watchmode (streaming + rent/buy prices). PC games via IsThereAnyDeal. Console game and book pricing have thinner data; launch with partial coverage there and show clearly what isn't covered.

### Franchises

- **Cross-media franchise linking** (e.g. Harry Potter books to the movies to the games). Any media type can link to any other, but only when the connection is accurate. Links are verified before they appear; suggestions (e.g. from Wikidata) stay hidden until reviewed.

### Accounts and sign-in

- **Emailed sign-in links** for sign-up and sign-in, alongside the Google sign-in already in the app.
- Apple sign-in and passkeys are not planned. Apple requires an equivalent to Apple sign-in in any iOS app that offers Google sign-in, so an iOS app would offer emailed sign-in links only.

### Social

- **Friends and following.**
- **View a friend's profile read-only**, laid out like your own.
- **Clubs/groups:** cross-medium clubs that are invite-only or public. The creator picks which media types the club covers, and the club only shows those (a book club sees only books).

### Recommendations

- **Taste-based recommendations** for each user.
- **Recommendations for two friends together** (things both would enjoy).

### Imports and connected accounts

- **Import from competitors** where viable: Letterboxd, Goodreads, StoryGraph, IMDb (CSV exports), Trakt (API).
- **Connect other accounts** to sync libraries and activity: Steam (Web API) first. Xbox and PlayStation only have unofficial APIs, so treat them as experimental. Epic and Kindle currently have no usable API.

### Platforms

- **Mobile app** (iOS and Android) after the web app is established.
