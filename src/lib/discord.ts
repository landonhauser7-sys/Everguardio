/**
 * Discord Webhook Integration for Sale Notifications
 */

const MILESTONES = [10, 25, 50, 100, 250, 500];
const BIG_SALE_THRESHOLD = 2500;

// Discord embed colors
const COLORS = {
  FIRST_SALE: 16766720,    // Gold #FFD700
  MILESTONE: 16766720,     // Gold #FFD700
  BIG_SALE: 16738101,      // Orange/Red #FF6B35
  REGULAR: 1096833,        // Green #10B981
};

interface DealInfo {
  id: string;
  clientName: string;
  annualPremium: number;
  insuranceType: string;
  carrierName: string;
}

interface AgentInfo {
  id: string;
  firstName: string;
  lastName: string;
}

interface NotificationData {
  deal: DealInfo;
  agent: AgentInfo;
  totalAgentDeals: number;
  totalDealsToday: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function sendDiscordSaleNotification(data: NotificationData): Promise<void> {
  const webhookUrl = process.env.DISCORD_SALES_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('Discord webhook URL not configured, skipping notification');
    return;
  }

  try {
    const { deal, agent, totalAgentDeals, totalDealsToday } = data;
    const agentName = `${agent.firstName} ${agent.lastName}`;
    const premium = formatCurrency(deal.annualPremium);

    // Determine notification type
    const isFirstSale = totalAgentDeals === 1;
    const isMilestone = MILESTONES.includes(totalAgentDeals);
    const isBigSale = deal.annualPremium >= BIG_SALE_THRESHOLD;

    // Build the embed
    let title: string;
    let description: string;
    let color: number;

    if (isFirstSale && isBigSale) {
      title = "FIRST BIG SALE EVER!";
      description = `**${agentName}** just closed their first deal - and it's a big one!`;
      color = COLORS.FIRST_SALE;
    } else if (isFirstSale) {
      title = "FIRST SALE EVER!";
      description = `**${agentName}** just closed their very first deal!`;
      color = COLORS.FIRST_SALE;
    } else if (isMilestone && isBigSale) {
      title = "MILESTONE BIG SALE!";
      description = `**${agentName}** hit their ${getOrdinalSuffix(totalAgentDeals)} deal with a big sale!`;
      color = COLORS.MILESTONE;
    } else if (isMilestone) {
      title = `Milestone - ${getOrdinalSuffix(totalAgentDeals)} Deal!`;
      description = `**${agentName}** just hit a milestone!`;
      color = COLORS.MILESTONE;
    } else if (isBigSale) {
      title = "BIG SALE!";
      description = `**${agentName}** just closed a big deal!`;
      color = COLORS.BIG_SALE;
    } else {
      title = "New Sale!";
      description = `**${agentName}** just closed a deal!`;
      color = COLORS.REGULAR;
    }

    // Build emoji prefix based on type
    let emoji = "";
    if (isFirstSale && isBigSale) {
      emoji = "";
    } else if (isFirstSale || isMilestone) {
      emoji = "";
    } else if (isBigSale) {
      emoji = "";
    } else {
      emoji = "";
    }

    const embed = {
      title: `${emoji} ${title}`,
      description,
      color,
      fields: [
        { name: "Annual Premium", value: premium, inline: true },
        { name: "Insurance Type", value: deal.insuranceType === "LIFE" ? "Life" : "Health", inline: true },
        { name: "Carrier", value: deal.carrierName || "N/A", inline: true },
        { name: "Total Deals Today", value: String(totalDealsToday), inline: false },
      ],
      footer: { text: "Everguard.io" },
      timestamp: new Date().toISOString(),
    };

    // Add milestone info if applicable
    if (isMilestone && !isFirstSale) {
      embed.fields.splice(3, 0, {
        name: "Career Deals",
        value: `${totalAgentDeals} deals`,
        inline: true,
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      console.error('Discord webhook failed:', response.status, await response.text());
    }
  } catch (error) {
    // Don't throw - let deal submission succeed even if Discord fails
    console.error('Discord notification failed:', error);
  }
}
