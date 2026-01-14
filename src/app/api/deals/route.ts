import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { sendDiscordSaleNotification } from "@/lib/discord";

const dealSchema = z.object({
  clientName: z.string().min(1),
  clientAge: z.number().optional(),
  clientState: z.string().optional(),
  policyType: z.enum(["TERM", "WHOLE_LIFE", "UNIVERSAL_LIFE", "IUL", "VUL", "FINAL_EXPENSE", "ANNUITY", "DISABILITY", "LTC", "CRITICAL_ILLNESS", "OTHER"]),
  carrierName: z.string().min(1),
  insuranceType: z.enum(["LIFE", "HEALTH"]),
  faceAmount: z.number().optional(),
  annualPremium: z.number().min(0),
  applicationDate: z.string(),
  notes: z.string().optional(),
});

// Commission level constants
const AGENT_LEVEL = 70;
const MANAGER_LEVEL = 90;
const OWNER_LEVEL = 130;

interface CommissionSplit {
  userId: string;
  userName: string;
  roleInHierarchy: "AGENT" | "MANAGER" | "OWNER";
  commissionAmount: number;
  commissionLevel: number;
  isOverride: boolean;
}

/**
 * Calculate commission splits based on the 70/110/130 system
 *
 * Agent (70%): Gets 70% of base commission
 * Manager (110%): Gets 40% override (110% - 70%)
 * Owner (130%): Gets 20% override (130% - 110%)
 *
 * Special cases:
 * - Manager selling personally: Gets 110%, owner gets 20%
 * - Owner selling personally: Gets full 130%
 */
function calculateCommissionSplits(
  baseCommission: number,
  agent: { id: string; firstName: string; lastName: string; commissionLevel: number },
  manager: { id: string; firstName: string; lastName: string } | null,
  owner: { id: string; firstName: string; lastName: string } | null
): {
  agentCommission: number;
  managerOverride: number;
  ownerOverride: number;
  totalCommissionPool: number;
  splits: CommissionSplit[];
} {
  const splits: CommissionSplit[] = [];
  let agentCommission = 0;
  let managerOverride = 0;
  let ownerOverride = 0;

  // Total commission pool is always 130% of base
  const totalCommissionPool = baseCommission * (OWNER_LEVEL / 100);

  if (agent.commissionLevel === OWNER_LEVEL) {
    // Owner selling personally - gets full 130%
    agentCommission = baseCommission * (OWNER_LEVEL / 100);
    splits.push({
      userId: agent.id,
      userName: `${agent.firstName} ${agent.lastName}`,
      roleInHierarchy: "OWNER",
      commissionAmount: agentCommission,
      commissionLevel: OWNER_LEVEL,
      isOverride: false,
    });
  } else if (agent.commissionLevel === MANAGER_LEVEL) {
    // Manager selling personally - gets 110%, owner gets 20%
    agentCommission = baseCommission * (MANAGER_LEVEL / 100);
    splits.push({
      userId: agent.id,
      userName: `${agent.firstName} ${agent.lastName}`,
      roleInHierarchy: "MANAGER",
      commissionAmount: agentCommission,
      commissionLevel: MANAGER_LEVEL,
      isOverride: false,
    });

    if (owner && owner.id !== agent.id) {
      ownerOverride = baseCommission * ((OWNER_LEVEL - MANAGER_LEVEL) / 100); // 20%
      splits.push({
        userId: owner.id,
        userName: `${owner.firstName} ${owner.lastName}`,
        roleInHierarchy: "OWNER",
        commissionAmount: ownerOverride,
        commissionLevel: OWNER_LEVEL - MANAGER_LEVEL,
        isOverride: true,
      });
    }
  } else {
    // Regular agent (70%) - agent gets 70%, manager gets 40%, owner gets 20%
    agentCommission = baseCommission * (AGENT_LEVEL / 100);
    splits.push({
      userId: agent.id,
      userName: `${agent.firstName} ${agent.lastName}`,
      roleInHierarchy: "AGENT",
      commissionAmount: agentCommission,
      commissionLevel: AGENT_LEVEL,
      isOverride: false,
    });

    if (manager) {
      managerOverride = baseCommission * ((MANAGER_LEVEL - AGENT_LEVEL) / 100); // 40%
      splits.push({
        userId: manager.id,
        userName: `${manager.firstName} ${manager.lastName}`,
        roleInHierarchy: "MANAGER",
        commissionAmount: managerOverride,
        commissionLevel: MANAGER_LEVEL - AGENT_LEVEL,
        isOverride: true,
      });
    }

    if (owner) {
      // Owner gets 20% if there's a manager, or 60% if no manager (they get manager + owner override)
      if (manager && manager.id !== owner.id) {
        ownerOverride = baseCommission * ((OWNER_LEVEL - MANAGER_LEVEL) / 100); // 20%
      } else if (!manager) {
        // No manager, owner gets the manager's spread too
        ownerOverride = baseCommission * ((OWNER_LEVEL - AGENT_LEVEL) / 100); // 60%
      }

      if (ownerOverride > 0) {
        splits.push({
          userId: owner.id,
          userName: `${owner.firstName} ${owner.lastName}`,
          roleInHierarchy: "OWNER",
          commissionAmount: ownerOverride,
          commissionLevel: manager ? OWNER_LEVEL - MANAGER_LEVEL : OWNER_LEVEL - AGENT_LEVEL,
          isOverride: true,
        });
      }
    }
  }

  return {
    agentCommission,
    managerOverride,
    ownerOverride,
    totalCommissionPool,
    splits,
  };
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

    const deals = await prisma.deals.findMany({
      where: {
        agent_id: session.user.id,
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
          },
        },
      },
    });

    return NextResponse.json({
      deals: deals.map(d => ({
        id: d.id,
        clientName: d.client_name,
        clientAge: d.client_age,
        clientState: d.client_state,
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
        },
      })),
      total: deals.length,
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
        manager_id: true,
        agency_owner_id: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Get manager if exists
    let manager = null;
    if (user.manager_id) {
      manager = await prisma.users.findUnique({
        where: { id: user.manager_id },
        select: { id: true, first_name: true, last_name: true },
      });
    }

    // Get agency owner if exists
    let owner = null;
    if (user.agency_owner_id) {
      owner = await prisma.users.findUnique({
        where: { id: user.agency_owner_id },
        select: { id: true, first_name: true, last_name: true },
      });
    }

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

    // Calculate commission splits
    const commissionResult = calculateCommissionSplits(
      baseCommission,
      {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        commissionLevel: user.commission_level || AGENT_LEVEL,
      },
      manager ? {
        id: manager.id,
        firstName: manager.first_name,
        lastName: manager.last_name,
      } : null,
      owner ? {
        id: owner.id,
        firstName: owner.first_name,
        lastName: owner.last_name,
      } : null
    );

    // Create deal with all commission data
    const dealId = crypto.randomUUID();
    const deal = await prisma.deals.create({
      data: {
        id: dealId,
        agent_id: session.user.id,
        manager_id: user.manager_id,
        owner_id: user.agency_owner_id,
        client_name: validatedData.clientName,
        client_age: validatedData.clientAge,
        client_state: validatedData.clientState,
        policy_type: validatedData.policyType,
        carrier_name: validatedData.carrierName,
        insurance_type: validatedData.insuranceType,
        face_amount: validatedData.faceAmount,
        annual_premium: validatedData.annualPremium,
        fyc_rate: fycRate,
        base_commission: baseCommission,
        commission_rate: user.commission_level || AGENT_LEVEL,
        commission_amount: commissionResult.agentCommission, // Legacy field
        agent_commission: commissionResult.agentCommission,
        manager_override: commissionResult.managerOverride,
        owner_override: commissionResult.ownerOverride,
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
