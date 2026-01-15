const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Business day calculation
function addBusinessDays(startDate, daysToAdd) {
  const result = new Date(startDate);
  let addedDays = 0;

  while (addedDays < daysToAdd) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }
  return result;
}

function getWeekStart(date) {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  if (dayOfWeek === 0) {
    result.setDate(result.getDate() - 6);
  } else {
    result.setDate(result.getDate() - (dayOfWeek - 1));
  }
  result.setHours(0, 0, 0, 0);
  return result;
}

function getWeekEnd(date) {
  const weekStart = getWeekStart(date);
  const result = new Date(weekStart);
  result.setDate(result.getDate() + 6);
  return result;
}

async function getUplineChain(userId) {
  const chain = [];
  let currentId = userId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const user = await prisma.users.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        commission_level: true,
        role: true,
        upline_id: true,
      },
    });

    if (!user) break;

    if (user.id !== userId) {
      chain.push(user);
    }

    currentId = user.upline_id;
    if (user.role === 'AO') break;
  }

  return chain;
}

async function main() {
  console.log('Creating mock deals with effective dates...\n');

  // Get users
  const users = await prisma.users.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, first_name: true, last_name: true, role: true, commission_level: true, upline_id: true },
  });

  const landon = users.find(u => u.first_name === 'Landon');
  const zach = users.find(u => u.first_name === 'Zach');
  const collin = users.find(u => u.first_name === 'Collin');
  const matlock = users.find(u => u.first_name === 'Matlock');
  const mike = users.find(u => u.first_name === 'Mike');
  const brandon = users.find(u => u.first_name === 'Brandon');

  if (!landon) {
    console.log('Landon not found!');
    return;
  }

  // Mock deals data - effective dates that result in deposits week of Jan 12-18, 2026
  // Week: Mon Jan 12 - Sun Jan 18
  // Jan 7 (Wed) + 3 biz = Thu(1) Fri(2) Mon(3) = Jan 12 Mon
  // Jan 8 (Thu) + 3 biz = Fri(1) Mon(2) Tue(3) = Jan 13 Tue
  // Jan 9 (Fri) + 3 biz = Mon(1) Tue(2) Wed(3) = Jan 14 Wed
  // Jan 12 (Mon) + 3 biz = Tue(1) Wed(2) Thu(3) = Jan 15 Thu
  // Jan 13 (Tue) + 3 biz = Wed(1) Thu(2) Fri(3) = Jan 16 Fri
  const mockDeals = [
    // Deposits week of Jan 12-18, 2026
    { agent: collin || zach, client: 'Robert Johnson', premium: 1500, effective: '2026-01-07', policyType: 'TERM' },        // Deposit Jan 12 Mon
    { agent: matlock || zach, client: 'Sarah Williams', premium: 2200, effective: '2026-01-07', policyType: 'WHOLE_LIFE' }, // Deposit Jan 12 Mon
    { agent: landon, client: 'Michael Davis', premium: 3500, effective: '2026-01-08', policyType: 'IUL' },                  // Deposit Jan 13 Tue
    { agent: mike || zach, client: 'Jennifer Martinez', premium: 1800, effective: '2026-01-08', policyType: 'TERM' },      // Deposit Jan 13 Tue
    { agent: zach || landon, client: 'David Anderson', premium: 2800, effective: '2026-01-09', policyType: 'UNIVERSAL_LIFE' }, // Deposit Jan 14 Wed
    { agent: brandon || zach, client: 'Lisa Thompson', premium: 1200, effective: '2026-01-09', policyType: 'FINAL_EXPENSE' },  // Deposit Jan 14 Wed
    { agent: collin || zach, client: 'James Wilson', premium: 4200, effective: '2026-01-12', policyType: 'IUL' },          // Deposit Jan 15 Thu
    { agent: landon, client: 'Emily Brown', premium: 1950, effective: '2026-01-12', policyType: 'TERM' },                  // Deposit Jan 15 Thu
    { agent: matlock || zach, client: 'Christopher Lee', premium: 2600, effective: '2026-01-13', policyType: 'WHOLE_LIFE' }, // Deposit Jan 16 Fri
    { agent: mike || zach, client: 'Amanda Garcia', premium: 3100, effective: '2026-01-13', policyType: 'UNIVERSAL_LIFE' }, // Deposit Jan 16 Fri
  ];

  for (const mockDeal of mockDeals) {
    const agent = mockDeal.agent;
    if (!agent) continue;

    const effectiveDate = new Date(mockDeal.effective);
    const depositDate = addBusinessDays(effectiveDate, 3);
    const { weekStart, weekEnd } = { weekStart: getWeekStart(depositDate), weekEnd: getWeekEnd(depositDate) };

    // Get upline chain for commission splits
    const uplineChain = await getUplineChain(agent.id);

    // Calculate commissions
    const fycRate = 1.0; // Life insurance
    const baseCommission = mockDeal.premium * fycRate;
    const agentCommission = baseCommission * (agent.commission_level / 100);

    // Calculate splits
    const splits = [{
      userId: agent.id,
      userName: `${agent.first_name} ${agent.last_name}`,
      roleInHierarchy: 'AGENT',
      commissionAmount: agentCommission,
      commissionLevel: agent.commission_level,
      isOverride: false,
    }];

    let previousLevel = agent.commission_level;
    for (const upline of uplineChain) {
      const overridePercent = upline.commission_level - previousLevel;
      if (overridePercent > 0) {
        const overrideAmount = baseCommission * (overridePercent / 100);
        splits.push({
          userId: upline.id,
          userName: `${upline.first_name} ${upline.last_name}`,
          roleInHierarchy: upline.role === 'AO' ? 'OWNER' : 'MANAGER',
          commissionAmount: overrideAmount,
          commissionLevel: overridePercent,
          isOverride: true,
        });
        previousLevel = upline.commission_level;
      }
      if (upline.commission_level >= 130) break;
    }

    const dealId = crypto.randomUUID();
    const now = new Date();

    // Create deal
    await prisma.deals.create({
      data: {
        id: dealId,
        agent_id: agent.id,
        manager_id: uplineChain[0]?.id || null,
        owner_id: uplineChain.find(u => u.role === 'AO')?.id || null,
        client_name: mockDeal.client,
        policy_type: mockDeal.policyType,
        carrier_name: 'Nationwide',
        insurance_type: 'LIFE',
        annual_premium: mockDeal.premium,
        fyc_rate: fycRate,
        base_commission: baseCommission,
        commission_rate: agent.commission_level,
        commission_amount: agentCommission,
        agent_commission: agentCommission,
        total_commission_pool: baseCommission * 1.3,
        application_date: effectiveDate,
        effective_date: effectiveDate,
        deposit_date: depositDate,
        status: 'SUBMITTED',
        updated_at: now,
      },
    });

    // Create commission splits
    await prisma.commission_splits.createMany({
      data: splits.map(s => ({
        id: crypto.randomUUID(),
        deal_id: dealId,
        user_id: s.userId,
        user_name: s.userName,
        role_in_hierarchy: s.roleInHierarchy,
        commission_amount: s.commissionAmount,
        commission_level: s.commissionLevel,
        is_override: s.isOverride,
        created_at: now,
      })),
    });

    // Create payout records
    await prisma.payouts.createMany({
      data: splits.map(s => ({
        id: crypto.randomUUID(),
        deal_id: dealId,
        user_id: s.userId,
        amount: s.commissionAmount,
        type: s.isOverride ? 'OVERRIDE' : 'BASE_COMMISSION',
        deposit_date: depositDate,
        week_start: weekStart,
        week_end: weekEnd,
        status: 'PENDING',
        created_at: now,
        updated_at: now,
      })),
    });

    console.log(`Created: ${mockDeal.client} - $${mockDeal.premium} (Agent: ${agent.first_name}, Deposit: ${depositDate.toDateString()})`);
  }

  console.log('\nDone! Mock deals created with payouts.');
  await prisma.$disconnect();
}

main().catch(console.error);
