const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check existing commission splits
  const splits = await prisma.commission_splits.findMany({
    include: { deals: { select: { client_name: true } } }
  });

  console.log('Existing commission splits:', splits.length);
  splits.forEach(s => {
    console.log('  ' + s.user_name + ' - ' + s.role_in_hierarchy + ': $' + s.commission_amount + ' (' + (s.is_override ? 'override' : 'personal') + ')');
  });

  // Get George's deal
  const george = await prisma.users.findFirst({
    where: { first_name: 'George', last_name: 'Hill' }
  });

  const deal = await prisma.deals.findFirst({
    where: { agent_id: george.id }
  });

  if (!deal) {
    console.log('No deal found');
    return;
  }

  console.log('\nDeal:', deal.client_name, '- Premium: $' + deal.annual_premium);

  // Delete existing splits for this deal
  await prisma.commission_splits.deleteMany({
    where: { deal_id: deal.id }
  });
  console.log('\nCleared old splits');

  // Now create proper commission splits by walking up the hierarchy
  const baseCommission = Number(deal.annual_premium) * 1.0; // FYC = 100%

  // Get George's full upline chain
  let currentId = george.id;
  let previousLevel = george.commission_level;
  const splitsToCreate = [];

  // First, add George's personal commission
  splitsToCreate.push({
    id: crypto.randomUUID(),
    deal_id: deal.id,
    user_id: george.id,
    user_name: 'George Hill',
    role_in_hierarchy: 'AGENT',
    commission_amount: baseCommission * (george.commission_level / 100),
    commission_level: george.commission_level,
    is_override: false,
    created_at: new Date()
  });

  // Walk up the upline chain
  currentId = george.upline_id;
  while (currentId) {
    const upline = await prisma.users.findUnique({
      where: { id: currentId },
      select: { id: true, first_name: true, last_name: true, role: true, commission_level: true, upline_id: true }
    });

    if (!upline) break;

    const overridePercent = upline.commission_level - previousLevel;
    const overrideAmount = baseCommission * (overridePercent / 100);

    splitsToCreate.push({
      id: crypto.randomUUID(),
      deal_id: deal.id,
      user_id: upline.id,
      user_name: upline.first_name + ' ' + upline.last_name,
      role_in_hierarchy: upline.role === 'AO' ? 'OWNER' : 'MANAGER',
      commission_amount: overrideAmount,
      commission_level: overridePercent,
      is_override: true,
      created_at: new Date()
    });

    console.log(upline.first_name + ' ' + upline.last_name + ' (' + upline.role + '): $' + overrideAmount.toFixed(2) + ' override (' + overridePercent + '%)');

    previousLevel = upline.commission_level;
    currentId = upline.upline_id;

    if (upline.role === 'AO') break;
  }

  // Create all the splits
  await prisma.commission_splits.createMany({
    data: splitsToCreate
  });

  console.log('\nCreated', splitsToCreate.length, 'commission splits');

  // Verify
  const newSplits = await prisma.commission_splits.findMany({
    where: { deal_id: deal.id }
  });
  console.log('\nVerification - splits in database:');
  newSplits.forEach(s => {
    console.log('  ' + s.user_name + ': $' + s.commission_amount + ' (' + s.role_in_hierarchy + ')');
  });
}

main().then(() => prisma.$disconnect());
