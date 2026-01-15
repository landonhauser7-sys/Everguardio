import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateDealSchema = z.object({
  clientName: z.string().min(1).optional(),
  clientAge: z.number().optional().nullable(),
  clientState: z.string().optional().nullable(),
  clientPhone: z.string().optional().nullable(),
  policyNumber: z.string().optional().nullable(),
  draftDate: z.string().optional().nullable(),
  leadSource: z.string().optional().nullable(),
  policyType: z.enum(["TERM", "WHOLE_LIFE", "UNIVERSAL_LIFE", "IUL", "VUL", "FINAL_EXPENSE", "ANNUITY", "DISABILITY", "LTC", "CRITICAL_ILLNESS", "OTHER"]).optional(),
  carrierName: z.string().optional(),
  insuranceType: z.enum(["LIFE", "HEALTH"]).optional(),
  faceAmount: z.number().optional().nullable(),
  annualPremium: z.number().min(0).optional(),
  applicationDate: z.string().optional(),
  status: z.enum(["SUBMITTED", "PENDING", "APPROVED", "ISSUED", "IN_FORCE", "LAPSED", "CANCELLED"]).optional(),
  notes: z.string().optional().nullable(),
});

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

// GET - Fetch single deal
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const deal = await prisma.deals.findUnique({
      where: { id },
      include: {
        users_deals_agent_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
            commission_level: true,
          },
        },
        commission_splits: true,
      },
    });

    if (!deal) {
      return NextResponse.json({ message: "Deal not found" }, { status: 404 });
    }

    // Check if user has access (is agent, manager, owner, or in upline chain)
    const downlineIds = await getAllDownlineIds(session.user.id);
    const hasAccess =
      deal.agent_id === session.user.id ||
      deal.manager_id === session.user.id ||
      deal.owner_id === session.user.id ||
      downlineIds.includes(deal.agent_id);

    if (!hasAccess) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ deal });
  } catch (error) {
    console.error("Error fetching deal:", error);
    return NextResponse.json({ message: "Failed to fetch deal" }, { status: 500 });
  }
}

// PATCH - Update deal
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateDealSchema.parse(body);

    // Find the deal
    const deal = await prisma.deals.findUnique({
      where: { id },
      select: { agent_id: true, manager_id: true, owner_id: true },
    });

    if (!deal) {
      return NextResponse.json({ message: "Deal not found" }, { status: 404 });
    }

    // Check if user has permission to edit (agent, manager, owner, or admin)
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { role: true, commission_level: true },
    });

    const downlineIds = await getAllDownlineIds(session.user.id);
    const canEdit =
      deal.agent_id === session.user.id ||
      deal.manager_id === session.user.id ||
      deal.owner_id === session.user.id ||
      downlineIds.includes(deal.agent_id) ||
      currentUser?.role === "AO" ||
      currentUser?.role === "ADMIN";

    if (!canEdit) {
      return NextResponse.json({ message: "Permission denied" }, { status: 403 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (validatedData.clientName !== undefined) updateData.client_name = validatedData.clientName;
    if (validatedData.clientAge !== undefined) updateData.client_age = validatedData.clientAge;
    if (validatedData.clientState !== undefined) updateData.client_state = validatedData.clientState;
    if (validatedData.clientPhone !== undefined) updateData.client_phone = validatedData.clientPhone;
    if (validatedData.policyNumber !== undefined) updateData.policy_number = validatedData.policyNumber;
    if (validatedData.draftDate !== undefined) updateData.draft_date = validatedData.draftDate ? new Date(validatedData.draftDate) : null;
    if (validatedData.leadSource !== undefined) updateData.lead_source = validatedData.leadSource;
    if (validatedData.policyType !== undefined) updateData.policy_type = validatedData.policyType;
    if (validatedData.carrierName !== undefined) updateData.carrier_name = validatedData.carrierName;
    if (validatedData.insuranceType !== undefined) updateData.insurance_type = validatedData.insuranceType;
    if (validatedData.faceAmount !== undefined) updateData.face_amount = validatedData.faceAmount;
    if (validatedData.annualPremium !== undefined) updateData.annual_premium = validatedData.annualPremium;
    if (validatedData.applicationDate !== undefined) updateData.application_date = new Date(validatedData.applicationDate);
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;

    // If premium changed, recalculate commissions
    if (validatedData.annualPremium !== undefined) {
      const agent = await prisma.users.findUnique({
        where: { id: deal.agent_id },
        select: { commission_level: true },
      });

      const carrier = await prisma.carriers.findFirst({
        where: { name: validatedData.carrierName },
        select: { life_fyc: true, health_fyc: true },
      });

      const insuranceType = validatedData.insuranceType || "LIFE";
      const fycRate = insuranceType === "LIFE"
        ? (carrier?.life_fyc ?? 1.0)
        : (carrier?.health_fyc ?? 0.5);

      const baseCommission = validatedData.annualPremium * fycRate;
      const agentCommission = baseCommission * ((agent?.commission_level || 70) / 100);

      updateData.fyc_rate = fycRate;
      updateData.base_commission = baseCommission;
      updateData.agent_commission = agentCommission;
      updateData.commission_amount = agentCommission;
      updateData.total_commission_pool = baseCommission * 1.3;

      // Note: commission_splits would need to be recalculated for a full implementation
      // For now, we update the deal-level amounts
    }

    const updatedDeal = await prisma.deals.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: "Deal updated successfully",
      deal: updatedDeal,
    });
  } catch (error) {
    console.error("Error updating deal:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }

    return NextResponse.json({ message: "Failed to update deal" }, { status: 500 });
  }
}

// DELETE - Delete deal (cascades to commission_splits)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the deal
    const deal = await prisma.deals.findUnique({
      where: { id },
      select: { agent_id: true, manager_id: true, owner_id: true },
    });

    if (!deal) {
      return NextResponse.json({ message: "Deal not found" }, { status: 404 });
    }

    // Check if user has permission to delete (agent, manager, owner, or AO)
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { role: true, commission_level: true },
    });

    const downlineIds = await getAllDownlineIds(session.user.id);
    const canDelete =
      deal.agent_id === session.user.id ||
      deal.manager_id === session.user.id ||
      deal.owner_id === session.user.id ||
      downlineIds.includes(deal.agent_id) ||
      currentUser?.role === "AO" ||
      currentUser?.role === "ADMIN";

    if (!canDelete) {
      return NextResponse.json({ message: "Permission denied" }, { status: 403 });
    }

    // Delete the deal (commission_splits will cascade delete due to schema)
    await prisma.deals.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Deal deleted successfully" });
  } catch (error) {
    console.error("Error deleting deal:", error);
    return NextResponse.json({ message: "Failed to delete deal" }, { status: 500 });
  }
}
