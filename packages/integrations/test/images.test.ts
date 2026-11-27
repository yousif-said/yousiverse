import { describe, expect, it } from "vitest";
import { imageAt } from "../src/images";

describe("imageAt", () => {
  it("resizes a TMDB poster and keeps its path", () => {
    const poster = "https://image.tmdb.org/t/p/w500/abc123.jpg";

    expect(imageAt(poster, "small")).toBe("https://image.tmdb.org/t/p/w185/abc123.jpg");
    expect(imageAt(poster, "medium")).toBe("https://image.tmdb.org/t/p/w342/abc123.jpg");
    expect(imageAt(poster, "large")).toBe(poster);
  });

  it("serves an episode still wide when asked, though it is stored at a poster's width", () => {
    const still = "https://image.tmdb.org/t/p/w500/still.jpg";

    expect(imageAt(still, "large", "wide")).toBe("https://image.tmdb.org/t/p/w1280/still.jpg");
  });

  it("knows a TMDB backdrop from a poster by the size it was stored at", () => {
    const backdrop = "https://image.tmdb.org/t/p/w1280/wide.jpg";

    expect(imageAt(backdrop, "small")).toBe("https://image.tmdb.org/t/p/w300/wide.jpg");
    expect(imageAt(backdrop, "medium")).toBe("https://image.tmdb.org/t/p/w780/wide.jpg");
    expect(imageAt(backdrop, "large")).toBe(backdrop);
  });

  it("resizes IGDB covers and artwork with their own size names", () => {
    const cover = "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1r76.jpg";
    const artwork = "https://images.igdb.com/igdb/image/upload/t_1080p/ar5l8.jpg";

    expect(imageAt(cover, "small")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r76.jpg",
    );
    expect(imageAt(cover, "large")).toBe(cover);
    expect(imageAt(artwork, "small")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_screenshot_med/ar5l8.jpg",
    );
    expect(imageAt(artwork, "medium")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_720p/ar5l8.jpg",
    );
  });

  it("resizes an Open Library cover", () => {
    const cover = "https://covers.openlibrary.org/b/id/9255566-L.jpg";

    expect(imageAt(cover, "small")).toBe("https://covers.openlibrary.org/b/id/9255566-M.jpg");
    expect(imageAt(cover, "large")).toBe(cover);
  });

  it("leaves an address it does not recognize as it is", () => {
    const logo = "https://cdn.watchmode.com/provider_logos/netflix_100px.png";

    expect(imageAt(logo, "small")).toBe(logo);
  });
});
