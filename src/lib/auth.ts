import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const user = await prisma.users.findUnique({
            where: { email: credentials.email },
            include: {
              teams_users_team_idToteams: {
                select: { id: true, name: true },
              },
            },
          });

          if (!user) {
            return null;
          }

          if (user.status !== "ACTIVE") {
            return null;
          }

          const isValidPassword = await bcrypt.compare(
            credentials.password,
            user.password_hash
          );

          if (!isValidPassword) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            teamId: user.team_id,
            teamName: user.teams_users_team_idToteams?.name || null,
            profilePhotoUrl: user.profile_photo_url,
            commissionLevel: user.commission_level,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.teamId = user.teamId;
        token.teamName = user.teamName;
        token.profilePhotoUrl = user.profilePhotoUrl;
        token.commissionLevel = user.commissionLevel;
      }

      // Refresh user data when session is updated
      if (trigger === "update" && token.id) {
        const freshUser = await prisma.users.findUnique({
          where: { id: token.id as string },
          select: {
            first_name: true,
            last_name: true,
            role: true,
            profile_photo_url: true,
            commission_level: true,
            team_id: true,
            teams_users_team_idToteams: {
              select: { name: true },
            },
          },
        });
        if (freshUser) {
          token.firstName = freshUser.first_name;
          token.lastName = freshUser.last_name;
          token.role = freshUser.role;
          token.profilePhotoUrl = freshUser.profile_photo_url;
          token.commissionLevel = freshUser.commission_level;
          token.teamId = freshUser.team_id;
          token.teamName = freshUser.teams_users_team_idToteams?.name || null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.teamId = token.teamId;
        session.user.teamName = token.teamName;
        session.user.profilePhotoUrl = token.profilePhotoUrl;
        session.user.commissionLevel = token.commissionLevel;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  // Required for Netlify deployments
  trustHost: true,
};
