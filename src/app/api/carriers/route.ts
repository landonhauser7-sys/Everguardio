import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const carriers = await prisma.carriers.findMany({
      where: includeInactive ? {} : { is_active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        logo_url: true,
        is_active: true,
        insurance_types: true,
        default_agent_rate: true,
        default_manager_rate: true,
        life_fyc: true,
        health_fyc: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            commission_rates: true,
            onboarding_progress: true,
          },
        },
      },
    });

    return NextResponse.json(carriers);
  } catch (error) {
    console.error("Error fetching carriers:", error);
    return NextResponse.json({ message: "Failed to fetch carriers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, logo_url, insurance_types, default_agent_rate, default_manager_rate, life_fyc, health_fyc } = body;

    if (!name) {
      return NextResponse.json({ message: "Carrier name is required" }, { status: 400 });
    }

    const existing = await prisma.carriers.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ message: "Carrier with this name already exists" }, { status: 400 });
    }

    const carrier = await prisma.carriers.create({
      data: {
        id: randomUUID(),
        name,
        logo_url: logo_url || null,
        insurance_types: insurance_types || ["LIFE"],
        default_agent_rate: default_agent_rate ?? 0.70,
        default_manager_rate: default_manager_rate ?? 0.30,
        life_fyc: life_fyc ?? 1.0,
        health_fyc: health_fyc ?? 0.5,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(carrier, { status: 201 });
  } catch (error) {
    console.error("Error creating carrier:", error);
    return NextResponse.json({ message: "Failed to create carrier" }, { status: 500 });
  }
}
