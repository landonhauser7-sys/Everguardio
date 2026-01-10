import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const carrier = await prisma.carriers.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            commission_rates: true,
            onboarding_progress: true,
          },
        },
      },
    });

    if (!carrier) {
      return NextResponse.json({ message: "Carrier not found" }, { status: 404 });
    }

    return NextResponse.json(carrier);
  } catch (error) {
    console.error("Error fetching carrier:", error);
    return NextResponse.json({ message: "Failed to fetch carrier" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, logo_url, is_active, insurance_types, default_agent_rate, default_manager_rate } = body;

    const existing = await prisma.carriers.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: "Carrier not found" }, { status: 404 });
    }

    if (name && name !== existing.name) {
      const nameConflict = await prisma.carriers.findUnique({ where: { name } });
      if (nameConflict) {
        return NextResponse.json({ message: "Carrier with this name already exists" }, { status: 400 });
      }
    }

    const carrier = await prisma.carriers.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(logo_url !== undefined && { logo_url }),
        ...(is_active !== undefined && { is_active }),
        ...(insurance_types !== undefined && { insurance_types }),
        ...(default_agent_rate !== undefined && { default_agent_rate }),
        ...(default_manager_rate !== undefined && { default_manager_rate }),
        updated_at: new Date(),
      },
    });

    return NextResponse.json(carrier);
  } catch (error) {
    console.error("Error updating carrier:", error);
    return NextResponse.json({ message: "Failed to update carrier" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.carriers.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            commission_rates: true,
            onboarding_progress: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "Carrier not found" }, { status: 404 });
    }

    // If carrier has related records, just deactivate instead of deleting
    if (existing._count.commission_rates > 0 || existing._count.onboarding_progress > 0) {
      await prisma.carriers.update({
        where: { id },
        data: { is_active: false, updated_at: new Date() },
      });
      return NextResponse.json({ message: "Carrier deactivated (has related records)" });
    }

    await prisma.carriers.delete({ where: { id } });
    return NextResponse.json({ message: "Carrier deleted" });
  } catch (error) {
    console.error("Error deleting carrier:", error);
    return NextResponse.json({ message: "Failed to delete carrier" }, { status: 500 });
  }
}
