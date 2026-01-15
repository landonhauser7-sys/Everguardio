import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// This endpoint migrates users from old roles to new roles
// Old: AGENT -> PRODIGY, TEAM_LEADER -> GA, ADMIN -> AO
export async function POST() {
  try {
    // Update AGENT -> PRODIGY
    const agentUpdate = await prisma.$executeRaw`
      UPDATE users SET role = 'PRODIGY' WHERE role = 'AGENT'
    `;

    // Update TEAM_LEADER -> GA
    const teamLeaderUpdate = await prisma.$executeRaw`
      UPDATE users SET role = 'GA' WHERE role = 'TEAM_LEADER'
    `;

    // Update ADMIN -> AO
    const adminUpdate = await prisma.$executeRaw`
      UPDATE users SET role = 'AO' WHERE role = 'ADMIN'
    `;

    return NextResponse.json({
      success: true,
      updates: {
        agentToProdigy: agentUpdate,
        teamLeaderToGA: teamLeaderUpdate,
        adminToAO: adminUpdate,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
