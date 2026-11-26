import { db } from "@yousiverse/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { env } from "./env";
import { SIGN_IN_LINK_MINUTES, sendSignInEmail } from "./sign-in-email";

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : undefined;

const isProduction = env.NODE_ENV === "production";

export const signInMethods = {
  google: Boolean(google),
  // Outside production a sign-in link is printed to the server terminal instead of emailed, so
  // development and tests need no inbox and send nothing.
  linkIsPrinted: !isProduction,
  linkMinutes: SIGN_IN_LINK_MINUTES,
};
export type SignInMethods = typeof signInMethods;

const emailSignIn = magicLink({
  expiresIn: SIGN_IN_LINK_MINUTES * 60,
  // Only a hash of each link's token is kept, so reading the database does not yield a link.
  storeToken: "hashed",
  sendMagicLink: async ({ email, url }) => {
    if (isProduction) return sendSignInEmail(email, url);
    console.info(`\nSign-in link for ${email}:\n${url}\n`);
  },
});

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  socialProviders: { ...(google && { google }) },
  plugins: [emailSignIn],
});

export type Session = typeof auth.$Infer.Session;
