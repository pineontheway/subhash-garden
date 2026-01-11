import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        try {
          // Check if user exists
          const existingUser = await db.select().from(users).where(eq(users.email, user.email)).get();

          if (!existingUser) {
            // Create new user (no role assigned yet)
            await db.insert(users).values({
              id: user.id || account.providerAccountId,
              email: user.email,
              name: user.name || 'Unknown',
              image: user.image || null,
              role: null, // No role until admin assigns one
            });
          }
        } catch (error) {
          console.error('Error in signIn callback:', error);
          // Allow sign in even if DB operation fails
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;

        // Fetch user role from database by email (more reliable than ID)
        try {
          if (session.user.email) {
            const dbUser = await db.select().from(users).where(eq(users.email, session.user.email)).get();
            if (dbUser) {
              session.user.role = dbUser.role;
            }
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.sub = user.id || account.providerAccountId;
      }
      return token;
    },
  },
};

export default NextAuth(authOptions);
