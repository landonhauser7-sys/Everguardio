import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.users.findUnique({
          where: { email: credentials.email as string },
          include: {
            teams_users_team_idToteams: true,
          },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        if (user.status !== "ACTIVE") {
          throw new Error("Your account is not active");
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
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
        token.role = (user as { role: string }).role;
        token.firstName = (user as { firstName: string }).firstName;
        token.lastName = (user as { lastName: string }).lastName;
        token.teamId = (user as { teamId: string | null }).teamId;
        token.teamName = (user as { teamName: string | null }).teamName;
        token.profilePhotoUrl = (user as { profilePhotoUrl: string | null }).profilePhotoUrl;
        token.commissionLevel = (user as { commissionLevel: number }).commissionLevel;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.teamId = token.teamId as string | null;
        session.user.teamName = token.teamName as string | null;
        session.user.profilePhotoUrl = token.profilePhotoUrl as string | null;
        session.user.commissionLevel = token.commissionLevel as number;
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
});
