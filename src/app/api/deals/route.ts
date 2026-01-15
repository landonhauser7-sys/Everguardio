import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { sendDiscordSaleNotification } from "@/lib/discord";

const dealSchema = z.object({
  clientName: z.string().min(1),
  clientAge: z.number().optional(),
  clientState: z.string().optional(),
  clientPhone: z.string().optional(),
  policyNumber: z.string().optional(),
  draftDate: z.string().optional(),
  leadSource: z.string().optional(),
  policyType: z.enum(["TERM", "WHOLE_LIFE", "UNIVERSAL_LIFE", "IUL", "VUL", "FINAL_EXPENSE", "ANNUITY", "DISABILITY", "LTC", "CRITICAL_ILLNESS", "OTHER"]),
  carrierName: z.string().min(1),
  insuranceType: z.enum(["LIFE", "HEALTH"]),
  faceAmount: z.number().optional(),
  annualPremium: z.number().min(0),
  applicationDate: z.string(),
  notes: z.string().optional(),
});

// Commission level constants - each level is 10% apart
const COMMISSION_LEVELS: Record<string, number> = {
  PRODIGY: 70,
  BA: 80,
  SA: 90,
  GA: 100,
  MGA: 110,
  PARTNER: 120,
  AO: 130,
};

const AO_LEVEL = 130;
const OVERRIDE_PER_LEVEL = 10; // Each level earns 10% override

interface CommissionSplit {
  userId: string;
  userName: string;
  roleInHierarchy: "AGENT" | "MANAGER" | "OWNER";
  commissionAmount: number;
  commissionLevel: number;
  isOverride: boolean;
}

interface UplineUser {
  id: string;
  firstName: string;
  lastName: string;
  commissionLevel: number;
  role: string;
  uplineId: string | null;
}

/**
 * Calculate commission splits based on the 7-level hierarchy
 *
 * Each level earns 10% override from the level below:
 * - Prodigy (70%) - base agent
 * - BA (80%) - 10% override from Prodigy
 * - SA (90%) - 10% override from BA
 * - GA (100%) - 10% override from SA
 * - MGA (110%) - 10% override from GA
 * - Partner (120%) - 10% override from MGA
 * - AO (130%) - 10% override from Partner
 *
 * Total pool is always 130% (all overrides combined)
 */
function calculateCommissionSplits(
  baseCommission: number,
  agent: UplineUser,
  uplineChain: UplineUser[]
): {
  agentCommission: number;
  totalOverrides: number;
  totalCommissionPool: number;
  splits: CommissionSplit[];
} {
  const splits: CommissionSplit[] = [];

  // Agent gets their commission level percentage
  const agentCommission = baseCommission * (agent.commissionLevel / 100);
  splits.push({
    userId: agent.id,
    userName: `${agent.firstName} ${agent.lastName}`,
    roleInHierarchy: "AGENT",
    commissionAmount: agentCommission,
    commissionLevel: agent.commissionLevel,
    isOverride: false,
  });

  // Calculate overrides for each upline member
  let totalOverrides = 0;
  let previousLevel = agent.commissionLevel;

  for (const upline of uplineChain) {
    // Each upline gets the difference between their level and the previous level
    const overridePercent = upline.commissionLevel - previousLevel;

    if (overridePercent > 0) {
      const overrideAmount = baseCommission * (overridePercent / 100);
      totalOverrides += overrideAmount;

      splits.push({
        userId: upline.id,
        userName: `${upline.firstName} ${upline.lastName}`,
        roleInHierarchy: upline.role === "AO" ? "OWNER" : "MANAGER",
        commissionAmount: overrideAmount,
        commissionLevel: overridePercent,
        isOverride: true,
      });

      previousLevel = upline.commissionLevel;
    }

    // Stop if we've reached the top (AO level)
    if (upline.commissionLevel >= AO_LEVEL) break;
  }

  // Total pool is always 130% of base commission
  const totalCommissionPool = baseCommission * (AO_LEVEL / 100);

  return {
    agentCommission,
    totalOverrides,
    totalCommissionPool,
    splits,
  };
}

/**
 * Get the full upline chain for a user
 */
async function getUplineChain(userId: string): Promise<UplineUser[]> {
  const chain: UplineUser[] = [];
  let currentId: string | null = userId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const user: {
      id: string;
      first_name: string;
      last_name: string;
      commission_level: number;
      role: string;
      upline_id: string | null;
    } | null = await prisma.users.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        commission_level: true,
        role: true,
        upline_id: true,
      },
    });

    if (!user) break;

    // Don't include the original user in the upline chain
    if (user.id !== userId) {
      chain.push({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        commissionLevel: user.commission_level || 70,
        role: user.role,
        uplineId: user.upline_id,
      });
    }

    currentId = user.upline_id;

    // Stop if we've reached an AO
    if (user.role === "AO") break;
  }

  return chain;
}

// Get all downline user IDs recursively
async function getAllDownlineIds(userId: string): Promise<string[]> {
  const directRecruits = await prisma.users.findMany({
    where: { upline_id: userId, status: "ACTIVE" },
    select: { id: true },
  });

  const allIds: string[] = directRecruits.map((r) => r.id);

  for (const recruit of directRecruits) {
    const subDownline = await getAllDownlineIds(recruit.id);
    allIds.push(...subDownline);
  }

  return allIds;
}

// GET - Fetch deals
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const scope = searchParams.get("scope") || "personal"; // personal, team, or specific agentId
    const agentId = searchParams.get("agentId");

    // Determine which agent IDs to fetch deals for
    let agentIds: string[] = [session.user.id];

    if (scope === "team") {
      // Get all downline IDs
      const downlineIds = await getAllDownlineIds(session.user.id);
      agentIds = [session.user.id, ...downlineIds];
    } else if (agentId && agentId !== session.user.id) {
      // Verify the requested agent is in the user's downline
      const downlineIds = await getAllDownlineIds(session.user.id);
      if (downlineIds.includes(agentId)) {
        agentIds = [agentId];
      }
    }

    const deals = await prisma.deals.findMany({
      where: {
        agent_id: { in: agentIds },
      },
      orderBy: { created_at: "desc" },
      take: limit,
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            display_name: true,
            profile_photo_url: true,
            role: true,
            commission_level: true,
          },
        },
      },
    });

    // Also fetch downline members for the filter dropdown (if user is a manager)
    let downlineMembers: Array<{ id: string; name: string; role: string }> = [];
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { is_manager: true, commission_level: true },
    });

    if (currentUser?.is_manager || (currentUser?.commission_level && currentUser.commission_level >= 80)) {
      const downlineIds = await getAllDownlineIds(session.user.id);
      if (downlineIds.length > 0) {
        const members = await prisma.users.findMany({
          where: { id: { in: downlineIds } },
          select: { id: true, first_name: true, last_name: true, role: true },
          orderBy: { first_name: "asc" },
        });
        downlineMembers = members.map(m => ({
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          role: m.role,
        }));
      }
    }

    return NextResponse.json({
      deals: deals.map(d => ({
        id: d.id,
        clientName: d.client_name,
        clientAge: d.client_age,
        clientState: d.client_state,
        clientPhone: d.client_phone,
        policyNumber: d.policy_number,
        draftDate: d.draft_date,
        leadSource: d.lead_source,
        policyType: d.policy_type,
        carrierName: d.carrier_name,
        insuranceType: d.insurance_type,
        faceAmount: d.face_amount ? Number(d.face_amount) : null,
        annualPremium: Number(d.annual_premium),
        commissionAmount: Number(d.agent_commission || d.commission_amount),
        baseCommission: d.base_commission ? Number(d.base_commission) : null,
        fycRate: d.fyc_rate,
        applicationDate: d.application_date,
        status: d.status,
        createdAt: d.created_at,
        agent: {
          id: d.users_deals_agent_idTousers.id,
          firstName: d.users_deals_agent_idTousers.first_name,
          lastName: d.users_deals_agent_idTousers.last_name,
          displayName: d.users_deals_agent_idTousers.display_name,
          profilePhotoUrl: d.users_deals_agent_idTousers.profile_photo_url,
          role: d.users_deals_agent_idTousers.role,
        },
      })),
      total: deals.length,
      downlineMembers,
      isManager: currentUser?.is_manager || (currentUser?.commission_level && currentUser.commission_level >= 80),
    });
  } catch (error) {
    console.error("Error fetching deals:", error);
    return NextResponse.json({ message: "Failed to fetch deals" }, { status: 500 });
  }
}

// POST - Create new deal
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = dealSchema.parse(body);

    // Get user with hierarchy info
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        commission_level: true,
        role: true,
        upline_id: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Get full upline chain for commission splits
    const uplineChain = await getUplineChain(session.user.id);

    // Get carrier FYC rate
    const carrier = await prisma.carriers.findFirst({
      where: { name: validatedData.carrierName },
      select: { life_fyc: true, health_fyc: true },
    });

    // Calculate FYC rate based on insurance type and carrier
    const fycRate = validatedData.insuranceType === "LIFE"
      ? (carrier?.life_fyc ?? 1.0)
      : (carrier?.health_fyc ?? 0.5);

    // Calculate base commission
    const baseCommission = validatedData.annualPremium * fycRate;

    // Calculate commission splits using full upline hierarchy
    const commissionResult = calculateCommissionSplits(
      baseCommission,
      {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        commissionLevel: user.commission_level || 70,
        role: user.role,
        uplineId: user.upline_id,
      },
      uplineChain
    );

    // Calculate manager and owner overrides from splits for backward compatibility
    const managerSplits = commissionResult.splits.filter(s => s.isOverride && s.roleInHierarchy === "MANAGER");
    const ownerSplits = commissionResult.splits.filter(s => s.isOverride && s.roleInHierarchy === "OWNER");
    const managerOverride = managerSplits.reduce((sum, s) => sum + s.commissionAmount, 0);
    const ownerOverride = ownerSplits.reduce((sum, s) => sum + s.commissionAmount, 0);

    // Get first upline as manager_id and find owner_id (AO) from chain
    const directUpline = uplineChain[0];
    const aoUpline = uplineChain.find(u => u.role === "AO");

    // Create deal with all commission data
    const dealId = crypto.randomUUID();
    const deal = await prisma.deals.create({
      data: {
        id: dealId,
        agent_id: session.user.id,
        manager_id: directUpline?.id || null,
        owner_id: aoUpline?.id || null,
        client_name: validatedData.clientName,
        client_age: validatedData.clientAge,
        client_state: validatedData.clientState,
        client_phone: validatedData.clientPhone,
        policy_number: validatedData.policyNumber,
        draft_date: validatedData.draftDate ? new Date(validatedData.draftDate) : null,
        lead_source: validatedData.leadSource,
        policy_type: validatedData.policyType,
        carrier_name: validatedData.carrierName,
        insurance_type: validatedData.insuranceType,
        face_amount: validatedData.faceAmount,
        annual_premium: validatedData.annualPremium,
        fyc_rate: fycRate,
        base_commission: baseCommission,
        commission_rate: user.commission_level || 70,
        commission_amount: commissionResult.agentCommission, // Legacy field
        agent_commission: commissionResult.agentCommission,
        manager_override: managerOverride,
        owner_override: ownerOverride,
        total_commission_pool: commissionResult.totalCommissionPool,
        application_date: new Date(validatedData.applicationDate),
        notes: validatedData.notes,
        status: "SUBMITTED",
        updated_at: new Date(),
      },
    });

    // Create commission split records
    if (commissionResult.splits.length > 0) {
      await prisma.commission_splits.createMany({
        data: commissionResult.splits.map(split => ({
          id: crypto.randomUUID(),
          deal_id: dealId,
          user_id: split.userId,
          user_name: split.userName,
          role_in_hierarchy: split.roleInHierarchy,
          commission_amount: split.commissionAmount,
          commission_level: split.commissionLevel,
          is_override: split.isOverride,
          created_at: new Date(),
        })),
      });
    }

    // Send Discord notification (don't await to not block response)
    // Run async but don't fail the deal submission if it errors
    (async () => {
      try {
        // Get agent's total deal count
        const totalAgentDeals = await prisma.deals.count({
          where: { agent_id: session.user.id },
        });

        // Count today's deals (all agents)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const totalDealsToday = await prisma.deals.count({
          where: { created_at: { gte: today } },
        });

        await sendDiscordSaleNotification({
          deal: {
            id: dealId,
            clientName: validatedData.clientName,
            clientPhone: validatedData.clientPhone,
            policyNumber: validatedData.policyNumber,
            policyType: validatedData.policyType,
            draftDate: validatedData.draftDate,
            leadSource: validatedData.leadSource,
            annualPremium: validatedData.annualPremium,
            insuranceType: validatedData.insuranceType,
            carrierName: validatedData.carrierName,
          },
          agent: {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
          },
          totalAgentDeals,
          totalDealsToday,
        });
      } catch (error) {
        console.error("Discord notification error:", error);
      }
    })();

    return NextResponse.json({
      id: deal.id,
      message: "Deal submitted successfully",
      commissionAmount: commissionResult.agentCommission,
      baseCommission,
      fycRate,
      splits: commissionResult.splits.map(s => ({
        role: s.roleInHierarchy,
        amount: s.commissionAmount,
        isOverride: s.isOverride,
      })),
    });
  } catch (error) {
    console.error("Error creating deal:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }

    return NextResponse.json({ message: "Failed to submit deal" }, { status: 500 });
  }
}
