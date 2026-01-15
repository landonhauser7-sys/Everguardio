import { NextRequest, NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["PRODIGY", "BA", "SA", "GA", "MGA", "PARTNER", "AO"]),
  teamId: z.string().optional(),
  commissionLevel: z.number().min(0).max(200).optional(),
  managerId: z.string().optional(),
  agencyOwnerId: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.users.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        display_name: true,
        role: true,
        status: true,
        profile_photo_url: true,
        commission_level: true,
        manager_id: true,
        agency_owner_id: true,
        created_at: true,
        teams_users_team_idToteams: {
          select: {
            id: true,
            name: true,
          },
        },
        users_users_manager_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        users_users_agency_owner_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        displayName: u.display_name,
        role: u.role,
        status: u.status,
        profilePhotoUrl: u.profile_photo_url,
        commissionLevel: u.commission_level,
        managerId: u.manager_id,
        agencyOwnerId: u.agency_owner_id,
        manager: u.users_users_manager_idTousers ? {
          id: u.users_users_manager_idTousers.id,
          name: `${u.users_users_manager_idTousers.first_name} ${u.users_users_manager_idTousers.last_name}`,
        } : null,
        agencyOwner: u.users_users_agency_owner_idTousers ? {
          id: u.users_users_agency_owner_idTousers.id,
          name: `${u.users_users_agency_owner_idTousers.first_name} ${u.users_users_agency_owner_idTousers.last_name}`,
        } : null,
        createdAt: u.created_at,
        team: u.teams_users_team_idToteams,
      }))
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ message: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.users.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json({ message: "Email already in use" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    const user = await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        email: validatedData.email,
        password_hash: hashedPassword,
        first_name: validatedData.firstName,
        last_name: validatedData.lastName,
        role: validatedData.role,
        team_id: validatedData.teamId,
        commission_level: validatedData.commissionLevel || 70,
        manager_id: validatedData.managerId || null,
        agency_owner_id: validatedData.agencyOwnerId || null,
        status: "ACTIVE",
        updated_at: new Date(),
      },
    });

    return NextResponse.json({ id: user.id, message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }

    return NextResponse.json({ message: "Failed to create user" }, { status: 500 });
  }
}
