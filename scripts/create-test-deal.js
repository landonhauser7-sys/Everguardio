const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

async function getUplineChain(prisma, userId) {
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
      chain.push({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        commissionLevel: user.commission_level || 70,
        role: user.role,
        uplineId: user.upline_id,
      });
    }
    currentId = user.upline_id;
    if (user.role === 'AO') break;
  }
  return chain;
}

function calculateCommissionSplits(baseCommission, agent, uplineChain) {
  const splits = [];
  const agentCommission = baseCommission * (agent.commissionLevel / 100);
  splits.push({
    userId: agent.id,
    userName: agent.firstName + ' ' + agent.lastName,
    roleInHierarchy: 'AGENT',
    commissionAmount: agentCommission,
    commissionLevel: agent.commissionLevel,
    isOverride: false,
  });

  let totalOverrides = 0;
  let previousLevel = agent.commissionLevel;

  for (const upline of uplineChain) {
    const overridePercent = upline.commissionLevel - previousLevel;
    if (overridePercent > 0) {
      const overrideAmount = baseCommission * (overridePercent / 100);
      totalOverrides += overrideAmount;
      splits.push({
        userId: upline.id,
        userName: upline.firstName + ' ' + upline.lastName,
        roleInHierarchy: upline.role === 'AO' ? 'OWNER' : 'MANAGER',
        commissionAmount: overrideAmount,
        commissionLevel: overridePercent,
        isOverride: true,
      });
      previousLevel = upline.commissionLevel;
    }
    if (upline.commissionLevel >= 130) break;
  }

  return { agentCommission, totalOverrides, totalCommissionPool: baseCommission * 1.3, splits };
}

async function createTestDeal() {
  const prisma = new PrismaClient();

  try {
    // Get Collin Cantu (Prodigy)
    const agent = await prisma.users.findFirst({
      where: { email: 'collincantu@gmail.com' },
      select: { id: true, first_name: true, last_name: true, commission_level: true, role: true, upline_id: true }
    });

    if (!agent) { console.log('Agent not found'); return; }

    // Get upline chain
    const uplineChain = await getUplineChain(prisma, agent.id);
    console.log('Upline chain:', uplineChain.map(u => u.firstName + ' ' + u.lastName + ' (' + u.role + ')').join(' -> '));

    const annualPremium = 1500;
    const fycRate = 1.0;
    const baseCommission = annualPremium * fycRate;

    const commissionResult = calculateCommissionSplits(baseCommission, {
      id: agent.id,
      firstName: agent.first_name,
      lastName: agent.last_name,
      commissionLevel: agent.commission_level,
      role: agent.role,
    }, uplineChain);

    console.log('\nCommission Splits:');
    commissionResult.splits.forEach(s => {
      console.log('  ' + s.userName + ' (' + s.roleInHierarchy + '): $' + s.commissionAmount.toFixed(2) + (s.isOverride ? ' (override)' : ''));
    });

    // Get manager and owner
    const directUpline = uplineChain[0];
    const aoUpline = uplineChain.find(u => u.role === 'AO');

    const managerOverride = commissionResult.splits.filter(s => s.isOverride && s.roleInHierarchy === 'MANAGER').reduce((sum, s) => sum + s.commissionAmount, 0);
    const ownerOverride = commissionResult.splits.filter(s => s.isOverride && s.roleInHierarchy === 'OWNER').reduce((sum, s) => sum + s.commissionAmount, 0);

    const dealId = crypto.randomUUID();
    const deal = await prisma.deals.create({
      data: {
        id: dealId,
        agent_id: agent.id,
        manager_id: directUpline ? directUpline.id : null,
        owner_id: aoUpline ? aoUpline.id : null,
        client_name: 'Jane Test Client',
        client_age: 42,
        client_state: 'CA',
        policy_type: 'WHOLE_LIFE',
        carrier_name: 'Mutual of Omaha',
        insurance_type: 'LIFE',
        face_amount: 250000,
        annual_premium: annualPremium,
        fyc_rate: fycRate,
        base_commission: baseCommission,
        commission_rate: agent.commission_level,
        commission_amount: commissionResult.agentCommission,
        agent_commission: commissionResult.agentCommission,
        manager_override: managerOverride,
        owner_override: ownerOverride,
        total_commission_pool: commissionResult.totalCommissionPool,
        application_date: new Date(),
        lead_source: 'ASCENT_DIALER',
        status: 'SUBMITTED',
        created_at: new Date(),
        updated_at: new Date(),
      }
    });

    // Create commission splits
    await prisma.commission_splits.createMany({
      data: commissionResult.splits.map(split => ({
        id: crypto.randomUUID(),
        deal_id: dealId,
        user_id: split.userId,
        user_name: split.userName,
        role_in_hierarchy: split.roleInHierarchy,
        commission_amount: split.commissionAmount,
        commission_level: split.commissionLevel,
        is_override: split.isOverride,
        created_at: new Date(),
      })),
    });

    console.log('\nDeal created with ID:', dealId);
    console.log('Agent Commission: $' + commissionResult.agentCommission.toFixed(2));
    console.log('Manager Override: $' + managerOverride.toFixed(2));
    console.log('Owner Override: $' + ownerOverride.toFixed(2));
    console.log('Total Pool: $' + commissionResult.totalCommissionPool.toFixed(2));

    // Test Discord
    const webhookUrl = process.env.DISCORD_SALES_WEBHOOK_URL;
    if (webhookUrl) {
      console.log('\nSending Discord notification...');
      const embed = {
        title: "💸 NEW SALE",
        color: 0x10b981,
        description: `**${agent.first_name} ${agent.last_name}** X 1\n$1,500 AP Mutual of Omaha Whole Life\nAscent Dialer`,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (response.ok) {
        console.log('Discord notification sent!');
      } else {
        console.log('Discord failed:', response.status, await response.text());
      }
    } else {
      console.log('\nNo Discord webhook configured');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestDeal();
