/** The credit each data provider's terms require, on every page. */
export function SiteFooter() {
  return (
    <footer className="foot">
      <p>
        Movie and TV data and images come from <a href="https://www.themoviedb.org">TMDB</a>. This
        product uses the TMDB API but is not endorsed or certified by TMDB. Game data and images
        come from <a href="https://www.igdb.com">IGDB</a>. Streaming availability comes from{" "}
        <a href="https://www.watchmode.com">Watchmode</a>. PC game prices come from{" "}
        <a href="https://isthereanydeal.com">IsThereAnyDeal</a>. Book data and covers come from{" "}
        <a href="https://openlibrary.org">Open Library</a>.
      </p>
    </footer>
  );
}
