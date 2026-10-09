import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getMongoClient } from "./db/mongodb.mjs";
import { googleSignInDecision } from "./lib/access";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: MongoDBAdapter(async () => getMongoClient(), {
    databaseName: process.env.MONGODB_DB || "vaagai_jaguar",
    collections: { Users: "auth_users", Accounts: "auth_accounts", Sessions: "auth_sessions", VerificationTokens: "auth_verification_tokens" },
  }),
  providers: [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET,
    authorization: { params: { scope: "openid email profile", prompt: "select_account" } } })],
  session: { strategy: "database", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ account, profile }) {
      return account?.provider === "google" ? await googleSignInDecision(profile) : false;
    },
  },
});
