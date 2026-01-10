import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  // Find Sarah
  const sarah = await prisma.users.findFirst({
    where: {
      first_name: { contains: 'Sarah', mode: 'insensitive' }
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      role: true,
      commission_level: true,
      manager_id: true,
      agency_owner_id: true
    }
  });
  console.log('Found Sarah:', sarah);

  if (!sarah) {
    console.log('Sarah not found!');
    return;
  }

  // Get admin/owner
  const owner = await prisma.users.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, first_name: true, last_name: true }
  });

  // Get a carrier
  const carrier = await prisma.carriers.findFirst({
    select: { name: true, life_fyc: true }
  });

  console.log('Owner:', owner);
  console.log('Carrier:', carrier);

  // Commission calculation
  const annualPremium = 1000;
  const fycRate = carrier?.life_fyc ?? 1.0;
  const baseCommission = annualPremium * Number(fycRate);

  // Commission levels
  const AGENT_LEVEL = 70;
  const MANAGER_LEVEL = 90;
  const OWNER_LEVEL = 130;

  let agentCommission = 0;
  let managerOverride = 0;
  let ownerOverride = 0;
  const totalCommissionPool = baseCommission * (OWNER_LEVEL / 100);

  const commissionLevel = sarah.commission_level || AGENT_LEVEL;

  if (commissionLevel >= OWNER_LEVEL) {
    agentCommission = baseCommission * (OWNER_LEVEL / 100);
  } else if (commissionLevel >= MANAGER_LEVEL) {
    agentCommission = baseCommission * (MANAGER_LEVEL / 100);
    ownerOverride = baseCommission * ((OWNER_LEVEL - MANAGER_LEVEL) / 100);
  } else {
    agentCommission = baseCommission * (AGENT_LEVEL / 100);
    ownerOverride = baseCommission * ((OWNER_LEVEL - AGENT_LEVEL) / 100);
  }

  console.log('\nCommission breakdown:');
  console.log('  Base commission: $' + baseCommission.toFixed(2));
  console.log('  Agent commission: $' + agentCommission.toFixed(2));
  console.log('  Manager override: $' + managerOverride.toFixed(2));
  console.log('  Owner override: $' + ownerOverride.toFixed(2));
  console.log('  Total pool: $' + totalCommissionPool.toFixed(2));

  // Create the deal
  const deal = await prisma.deals.create({
    data: {
      id: crypto.randomUUID(),
      agent_id: sarah.id,
      owner_id: owner?.id || null,
      client_name: 'Test Client',
      policy_type: 'TERM',
      carrier_name: carrier?.name || 'Test Carrier',
      insurance_type: 'LIFE',
      annual_premium: annualPremium,
      fyc_rate: fycRate,
      base_commission: baseCommission,
      commission_rate: commissionLevel,
      commission_amount: agentCommission,
      agent_commission: agentCommission,
      manager_override: managerOverride,
      owner_override: ownerOverride,
      total_commission_pool: totalCommissionPool,
      application_date: new Date(),
      status: 'SUBMITTED',
      updated_at: new Date(),
    },
  });

  console.log('\n--- DEAL CREATED ---');
  console.log('Deal ID:', deal.id);
  console.log('Agent:', sarah.first_name, sarah.last_name);
  console.log('Client: Test Client');
  console.log('Premium: $1,000');
  console.log('Sarah earns: $' + agentCommission.toFixed(2));
  console.log('Owner earns: $' + ownerOverride.toFixed(2));

  await prisma.$disconnect();
}

main().catch(console.error);
