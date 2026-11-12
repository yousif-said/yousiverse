import { db } from "@yousiverse/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { env } from "./env";

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : undefined;

export const signInMethods = {
  google: Boolean(google),
  // Email sign-in has no mail provider yet, so it only exists outside production,
  // where the link is printed to the server terminal.
  devEmail: env.NODE_ENV !== "production",
};
export type SignInMethods = typeof signInMethods;

const devMagicLink = magicLink({
  sendMagicLink: async ({ email, url }) => {
    console.info(`\nSign-in link for ${email}:\n${url}\n`);
  },
});

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  socialProviders: { ...(google && { google }) },
  plugins: signInMethods.devEmail ? [devMagicLink] : [],
});

export type Session = typeof auth.$Infer.Session;
