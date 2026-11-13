import { z } from "zod";

export const lookupResponse = z.object({
  found: z.boolean(),
  game: z.object({ id: z.string() }).optional(),
});

const money = z.object({ amountInt: z.number().int(), currency: z.string() });

export const pricesResponse = z.array(
  z.object({
    id: z.string(),
    historyLow: z.object({ all: money.nullable().optional() }).optional(),
    deals: z.array(
      z.object({
        shop: z.object({ name: z.string() }),
        price: money,
        regular: money,
        url: z.string(),
      }),
    ),
  }),
);
