# Yousiverse product

Yousiverse catalogs movies, TV shows, video games, and books in one place. It takes the best features of similar apps, improves them, and adds new ones. It should feel fast, clean, and modern everywhere. US market first.

## In the app

### Foundation

- **App shell:** header, navigation, and a home page with a sample shelf of movies, TV, games, and books that can be filtered by type. Light and dark mode, keyboard navigable.
- **Sign-in:** Google and Apple (each available once its credentials are configured). A protected account page shows name, email, and join date, with sign out.
- **Development sign-in:** email sign-in link printed to the server terminal. Not available in production.

### Catalog

- **Search** for movies and TV shows by title, with results as you type.
- **Movie pages:** poster, description, release date, runtime, and genres.
- **TV show pages:** poster, description, first air date, status, and genres, with every season listed. Each season has its own page listing its episodes with air date, runtime, and description.
- Titles are added to the catalog the first time someone opens them and refreshed weekly. Data comes from TMDB.

## Future features

### Library and catalog

- **Games and books in the catalog**, searchable alongside movies and TV.
- **Cast and crew** on movie and TV pages.

- **Personal library** across all four media types, with a status for each item (e.g. want, in progress, finished, dropped, on hold). Viewable all together or filtered by media type.
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

- **Passkeys and emailed magic links** for sign-up and sign-in, alongside the Google and Apple sign-in already in the app. Apple sign-in is required on iOS whenever Google sign-in is offered.

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
