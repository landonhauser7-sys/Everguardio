/**
 * Discord Webhook Integration for Sale Notifications
 */

const GREEN_COLOR = 0x10b981;

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

export async function sendDiscordSaleNotification(data: NotificationData): Promise<void> {
  const webhookUrl = process.env.DISCORD_SALES_WEBHOOK_URL;

  console.log('[Discord] Attempting to send notification, webhook configured:', !!webhookUrl);

  if (!webhookUrl) {
    console.log('[Discord] DISCORD_SALES_WEBHOOK_URL not configured, skipping notification');
    return;
  }

  try {
    const { deal, agent, totalDealsToday } = data;
    const agentName = `${agent.firstName} ${agent.lastName}`;
    const insuranceType = deal.insuranceType === "LIFE" ? "Life" : "Health";
    const product = `${insuranceType} • ${deal.carrierName || "N/A"}`;

    const embed = {
      title: "💰 NEW SALE",
      color: GREEN_COLOR,
      fields: [
        { name: "Agent", value: agentName, inline: false },
        { name: "Annual Premium", value: formatCurrency(deal.annualPremium), inline: false },
        { name: "Product", value: product, inline: false },
        { name: "Daily Total", value: `${totalDealsToday} deals`, inline: false },
      ],
      timestamp: new Date().toISOString(),
    };

    console.log('[Discord] Sending to webhook...');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Discord] Webhook failed:', response.status, text);
    } else {
      console.log('[Discord] Notification sent successfully');
    }
  } catch (error) {
    console.error('[Discord] Notification error:', error);
  }
}
