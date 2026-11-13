import { z } from "zod";

export const sourceTypes = ["sub", "free", "tve", "rent", "buy"] as const;

export const titleSourcesResponse = z.array(
  z.object({
    source_id: z.number(),
    name: z.string(),
    // Anything outside the known types is left out by the client rather than failing the call.
    type: z.string(),
    region: z.string(),
    web_url: z.string().nullable(),
    /** In US dollars. Null for subscriptions and free services. */
    price: z.number().nullable(),
  }),
);
