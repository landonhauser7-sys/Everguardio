import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();

    if (session) {
      // Fetch fresh user data from database (for profile photo updates, etc.)
      const freshUser = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          commission_level: true,
          profile_photo_url: true,
          team_id: true,
          teams_users_team_idToteams: {
            select: { name: true },
          },
        },
      });

      if (freshUser) {
        return NextResponse.json({
          user: {
            id: freshUser.id,
            email: freshUser.email,
            name: `${freshUser.first_name} ${freshUser.last_name}`,
            firstName: freshUser.first_name,
            lastName: freshUser.last_name,
            role: freshUser.role,
            teamId: freshUser.team_id,
            teamName: freshUser.teams_users_team_idToteams?.name || null,
            profilePhotoUrl: freshUser.profile_photo_url,
            commissionLevel: freshUser.commission_level,
          },
          expires: session.expires,
        });
      }

      return NextResponse.json(session);
    }

    return NextResponse.json({ user: null });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ user: null });
  }
}
