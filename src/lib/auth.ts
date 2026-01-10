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
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
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
          throw new Error("Invalid email or password");
        }

        if (user.status !== "ACTIVE") {
          throw new Error("Your account is not active");
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );

        if (!isValidPassword) {
          throw new Error("Invalid email or password");
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
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
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
  },
  secret: process.env.NEXTAUTH_SECRET,
};
