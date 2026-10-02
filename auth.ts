import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { allowedParent, demoEnabled } from "@/lib/auth-policy";
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            authorization: {
              params: {
                scope: "openid email profile",
                prompt: "select_account",
              },
            },
          }),
        ]
      : []),
    ...(demoEnabled()
      ? [
          Credentials({
            id: "local-preview",
            name: "Local preview",
            credentials: {},
            authorize() {
              return demoEnabled()
                ? { id: "local-preview", name: "Local preview" }
                : null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    signIn({ account, profile, user }) {
      if (account?.provider === "local-preview")
        return demoEnabled() && user.id === "local-preview";
      return (
        account?.provider === "google" &&
        allowedParent(
          profile?.email || undefined,
          profile?.email_verified === true,
        )
      );
    },
    jwt({ token, account }) {
      if (account) token.provider = account.provider;
      return token;
    },
    session({ session, token }) {
      // Only identity is returned; upstream OAuth tokens are deliberately omitted.
      session.user.id =
        token.provider === "local-preview" ? "local-preview" : "parent";
      return session;
    },
  },
  logger: {
    error() {
      console.error("AUTHENTICATION_ERROR");
    },
    warn(code) {
      console.warn(code);
    },
    debug() {},
  },
});
