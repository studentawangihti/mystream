import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email dan password wajib diisi.');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user) {
          throw new Error('User tidak ditemukan. Silakan daftar lebih dulu.');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Password salah. Silakan coba lagi.');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || 'user',
          plan: user.plan || 'free',
          ingestKey: user.ingestKey,
          lastResetAt: user.lastResetAt ? user.lastResetAt.toISOString() : null,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'user';
        token.plan = (user as any).plan || 'free';
        token.ingestKey = (user as any).ingestKey;
        token.lastResetAt = (user as any).lastResetAt;
      }
      if (trigger === 'update' && session) {
        if (session.role) token.role = session.role;
        if (session.plan) token.plan = session.plan;
        if (session.ingestKey) token.ingestKey = session.ingestKey;
        if (session.lastResetAt) token.lastResetAt = session.lastResetAt;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = (token.role as string) || 'user';
        (session.user as any).plan = (token.plan as string) || 'free';
        (session.user as any).ingestKey = token.ingestKey as string;
        (session.user as any).lastResetAt = token.lastResetAt as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'mystream-studio-super-secret-key-2026',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
