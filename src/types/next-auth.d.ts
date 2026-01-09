import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    role: string;
    teamId: string | null;
    teamName: string | null;
    profilePhotoUrl: string | null;
    commissionLevel: number;
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    firstName: string;
    lastName: string;
    teamId: string | null;
    teamName: string | null;
    profilePhotoUrl: string | null;
    commissionLevel: number;
  }
}
