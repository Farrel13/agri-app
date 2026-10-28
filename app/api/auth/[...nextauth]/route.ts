import NextAuth, { DefaultSession, DefaultUser, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-logger";

// 1. Deklarasikan tipe tambahan untuk NextAuth agar TypeScript mengenali role & username
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      username: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role: string;
    username: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    username: string;
  }
}

// 2. Konfigurasi authOptions dengan Rate Limiter & Security Logging
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Ambil identifier IP / Username untuk Rate Limiting (Mencegah brute-force password)
        const ip = req?.headers?.["x-forwarded-for"] || "127.0.0.1";
        const rateKey = `auth_${credentials.username}_${Array.isArray(ip) ? ip[0] : ip}`;
        
        // Batasi maksimal 5 percobaan login gagal per 60 detik (OWASP A07)
        const rateCheck = checkRateLimit(rateKey, 5, 60 * 1000);
        if (!rateCheck.success) {
          logSecurityEvent({
            level: "SECURITY_ALERT",
            action: "AUTH_BRUTE_FORCE_BLOCKED",
            details: { username: credentials.username, ip: String(ip) },
          });
          throw new Error("Terlalu banyak percobaan login gagal. Silakan coba lagi setelah 1 menit.");
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username }
        });

        if (!user || !user.password) {
          logSecurityEvent({
            level: "WARN",
            action: "AUTH_FAILED_USER_NOT_FOUND",
            details: { username: credentials.username },
          });
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          logSecurityEvent({
            level: "WARN",
            action: "AUTH_FAILED_WRONG_PASSWORD",
            userId: user.id,
            details: { username: credentials.username },
          });
          return null;
        }

        logSecurityEvent({
          level: "INFO",
          action: "AUTH_LOGIN_SUCCESS",
          userId: user.id,
          details: { role: user.role, username: user.username },
        });

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role;
        session.user.id = token.id;
        session.user.username = token.username;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // Sesi berlaku maks 8 jam (OWASP A07)
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
