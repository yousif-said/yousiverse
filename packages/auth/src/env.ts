import { z } from "zod";

const bothOrNeither = (a: string | undefined, b: string | undefined) => Boolean(a) === Boolean(b);

const parsed = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().optional(),
    VERCEL_URL: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .refine((env) => bothOrNeither(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET), {
    message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.",
  })
  .refine((env) => env.BETTER_AUTH_URL || env.VERCEL_URL, {
    message: "Set BETTER_AUTH_URL to the app's public origin.",
  })
  .parse(process.env);

export const env = {
  ...parsed,
  // Vercel previews get a unique URL per deploy, so fall back to it there.
  BETTER_AUTH_URL: parsed.BETTER_AUTH_URL ?? `https://${parsed.VERCEL_URL}`,
};
