// @ts-nocheck
/**
 * Migration script to update old roles to new role system
 *
 * Old roles → New roles:
 * - AGENT → PRODIGY (70%)
 * - TEAM_LEADER → GA (100%)
 * - ADMIN → AO (130%)
 *
 * Run with: npx ts-node scripts/migrate-roles.ts
 * Or in production: node -r ts-node/register scripts/migrate-roles.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roleMapping: Record<string, { newRole: string; commission: number }> = {
  AGENT: { newRole: "PRODIGY", commission: 70 },
  TEAM_LEADER: { newRole: "GA", commission: 100 },
  ADMIN: { newRole: "AO", commission: 130 },
};

async function migrateRoles() {
  console.log("Starting role migration...\n");

  // Get all users
  const users = await prisma.users.findMany({
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      role: true,
      commission_level: true,
    },
  });

  console.log(`Found ${users.length} users to check\n`);

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const mapping = roleMapping[user.role];

    if (mapping) {
      // Old role found, needs migration
      console.log(`Migrating: ${user.first_name} ${user.last_name} (${user.email})`);
      console.log(`  ${user.role} (${user.commission_level}%) → ${mapping.newRole} (${mapping.commission}%)`);

      await prisma.users.update({
        where: { id: user.id },
        data: {
          role: mapping.newRole,
          commission_level: mapping.commission,
        },
      });

      updated++;
    } else {
      // Already has new role or unknown role
      console.log(`Skipping: ${user.first_name} ${user.last_name} - already has role: ${user.role}`);
      skipped++;
    }
  }

  console.log("\n--- Migration Complete ---");
  console.log(`Updated: ${updated} users`);
  console.log(`Skipped: ${skipped} users (already migrated)`);
}

migrateRoles()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
