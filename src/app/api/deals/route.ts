import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

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

// GET - Fetch deals
export async function GET(request: Request) {
  try {
    const session = await auth();

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
        commissionAmount: Number(d.commission_amount),
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
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = dealSchema.parse(body);

    // Get user commission level
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { commission_level: true },
    });

    const commissionLevel = user?.commission_level || 70;

    // Calculate FYC rate based on insurance type
    const fycRate = validatedData.insuranceType === "LIFE" ? 1.0 : 0.5;

    // Calculate commission
    const baseCommission = validatedData.annualPremium * fycRate;
    const commissionAmount = baseCommission * (commissionLevel / 100);

    const deal = await prisma.deals.create({
      data: {
        id: crypto.randomUUID(),
        agent_id: session.user.id,
        client_name: validatedData.clientName,
        client_age: validatedData.clientAge,
        client_state: validatedData.clientState,
        policy_type: validatedData.policyType,
        carrier_name: validatedData.carrierName,
        insurance_type: validatedData.insuranceType,
        face_amount: validatedData.faceAmount,
        annual_premium: validatedData.annualPremium,
        commission_rate: commissionLevel,
        commission_amount: commissionAmount,
        fyc_rate: fycRate,
        base_commission: baseCommission,
        application_date: new Date(validatedData.applicationDate),
        notes: validatedData.notes,
        status: "SUBMITTED",
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      id: deal.id,
      message: "Deal submitted successfully",
      commissionAmount,
    });
  } catch (error) {
    console.error("Error creating deal:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }

    return NextResponse.json({ message: "Failed to submit deal" }, { status: 500 });
  }
}
