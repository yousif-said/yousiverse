import { z } from "zod";

export const searchResponse = z.object({
  docs: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      author_name: z.array(z.string()).default([]),
      first_publish_year: z.number().optional(),
      cover_i: z.number().optional(),
      number_of_pages_median: z.number().optional(),
    }),
  ),
});

export const workResponse = z.object({
  key: z.string(),
  // Present when this work was merged into another one.
  location: z.string().optional(),
  title: z.string().optional(),
  // Either plain text or a typed-text object, depending on when the record was last edited.
  description: z
    .union([z.string(), z.object({ value: z.string() }).transform(({ value }) => value)])
    .optional(),
  covers: z.array(z.number().nullable()).default([]),
  subjects: z.array(z.string()).default([]),
});
