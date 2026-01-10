import "dotenv/config";
import prisma from "../src/lib/prisma";

// Commission level constants
const AGENT_LEVEL = 70;
const MANAGER_LEVEL = 110;
const OWNER_LEVEL = 130;

async function main() {
  console.log("Starting commission fix...\n");

  // 1. First, set up the hierarchy - set agency_owner_id for all users to the admin
  const admin = await prisma.users.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, first_name: true, last_name: true },
  });

  if (!admin) {
    console.log("No admin found!");
    return;
  }

  console.log(`Found admin: ${admin.first_name} ${admin.last_name}`);

  // Update all non-admin users to have the admin as their agency owner
  const ownerUpdate = await prisma.users.updateMany({
    where: {
      role: { not: "ADMIN" },
    },
    data: {
      agency_owner_id: admin.id,
    },
  });
  console.log(`Updated ${ownerUpdate.count} users with agency_owner_id\n`);

  // 2. Update commission levels based on role
  await prisma.users.updateMany({
    where: { role: "AGENT" },
    data: { commission_level: 70 },
  });
  await prisma.users.updateMany({
    where: { role: "TEAM_LEADER" },
    data: { commission_level: 110 },
  });
  await prisma.users.updateMany({
    where: { role: "ADMIN" },
    data: { commission_level: 130 },
  });
  console.log("Updated commission levels based on roles\n");

  // 3. Get all carriers for FYC rates
  const carriers = await prisma.carriers.findMany({
    select: { name: true, life_fyc: true, health_fyc: true },
  });
  const carrierMap = new Map(carriers.map(c => [c.name, c]));
  console.log(`Found ${carriers.length} carriers\n`);

  // 4. Recalculate all deals
  const deals = await prisma.deals.findMany({
    include: {
      users_deals_agent_idTousers: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          commission_level: true,
          manager_id: true,
          agency_owner_id: true,
        },
      },
    },
  });

  console.log(`Processing ${deals.length} deals...\n`);

  let updatedCount = 0;
  for (const deal of deals) {
    const agent = deal.users_deals_agent_idTousers;
    const carrier = carrierMap.get(deal.carrier_name);

    // Calculate FYC rate
    const fycRate = deal.insurance_type === "LIFE"
      ? (carrier?.life_fyc ?? 1.0)
      : (carrier?.health_fyc ?? 0.5);

    // Calculate base commission
    const annualPremium = Number(deal.annual_premium);
    const baseCommission = annualPremium * Number(fycRate);

    // Calculate commission splits
    const agentLevel = agent.commission_level || AGENT_LEVEL;
    let agentCommission = 0;
    let managerOverride = 0;
    let ownerOverride = 0;
    const totalCommissionPool = baseCommission * (OWNER_LEVEL / 100);

    if (agentLevel === OWNER_LEVEL) {
      // Owner selling personally
      agentCommission = baseCommission * (OWNER_LEVEL / 100);
    } else if (agentLevel === MANAGER_LEVEL) {
      // Manager selling personally
      agentCommission = baseCommission * (MANAGER_LEVEL / 100);
      ownerOverride = baseCommission * ((OWNER_LEVEL - MANAGER_LEVEL) / 100);
    } else {
      // Regular agent
      agentCommission = baseCommission * (AGENT_LEVEL / 100);
      // Manager gets 40% if exists
      if (agent.manager_id) {
        managerOverride = baseCommission * ((MANAGER_LEVEL - AGENT_LEVEL) / 100);
        ownerOverride = baseCommission * ((OWNER_LEVEL - MANAGER_LEVEL) / 100);
      } else {
        // No manager, owner gets full override
        ownerOverride = baseCommission * ((OWNER_LEVEL - AGENT_LEVEL) / 100);
      }
    }

    // Update the deal
    await prisma.deals.update({
      where: { id: deal.id },
      data: {
        fyc_rate: fycRate,
        base_commission: baseCommission,
        commission_rate: agentLevel,
        commission_amount: agentCommission,
        agent_commission: agentCommission,
        manager_override: managerOverride,
        owner_override: ownerOverride,
        total_commission_pool: totalCommissionPool,
        owner_id: admin.id,
      },
    });

    updatedCount++;
  }

  console.log(`Updated ${updatedCount} deals with commission data\n`);

  // 5. Verify by showing sample
  const sampleDeals = await prisma.deals.findMany({
    take: 3,
    select: {
      client_name: true,
      annual_premium: true,
      base_commission: true,
      agent_commission: true,
      manager_override: true,
      owner_override: true,
      total_commission_pool: true,
    },
  });
  console.log("Sample deals after fix:", JSON.stringify(sampleDeals, null, 2));

  await prisma.$disconnect();
  console.log("\nDone!");
}

main().catch(console.error);
