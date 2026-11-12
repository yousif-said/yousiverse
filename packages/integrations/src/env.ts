import { z } from "zod";

export const env = z
  .object({
    TMDB_API_TOKEN: z.string().min(1),
  })
  .parse(process.env);
