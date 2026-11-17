import { z } from "zod";

export const env = z
  .object({
    TMDB_API_TOKEN: z.string().min(1),
    IGDB_CLIENT_ID: z.string().min(1),
    IGDB_CLIENT_SECRET: z.string().min(1),
    WATCHMODE_API_KEY: z.string().min(1),
    ITAD_API_KEY: z.string().min(1),
    STEAM_API_KEY: z.string().min(1),
    TRAKT_CLIENT_ID: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    // The sender of every email: "Yousiverse <notifications@yousiverse.com>" or a bare address.
    EMAIL_FROM: z.string().regex(/^[^<>]*<[^<>\s@]+@[^<>\s@]+>$|^[^<>\s@]+@[^<>\s@]+$/, {
      message: "EMAIL_FROM must be an address, or a name followed by an address in <>.",
    }),
  })
  .parse(process.env);
