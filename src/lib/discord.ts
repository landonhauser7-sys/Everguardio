/**
 * Discord Webhook Integration for Sale Notifications
 */

const GREEN_COLOR = 0x10b981;

interface DealInfo {
  id: string;
  clientName: string;
  clientPhone?: string;
  policyNumber?: string;
  policyType?: string;
  draftDate?: string;
  leadSource?: string;
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

    // Lead source label
    const sourceLabels: Record<string, string> = {
      ASCENT_DIALER: "Ascent Dialer",
      EVERGUARD_DIALER: "Everguard Dialer",
      FACEBOOK_LEADS: "Facebook Leads",
      INBOUND: "Inbound",
      REFERRAL: "Referral",
      UPSELL: "Upsell",
      REWRITE: "Rewrite",
    };
    const leadSourceText = deal.leadSource ? sourceLabels[deal.leadSource] || deal.leadSource : "";

    // Policy type labels
    const policyLabels: Record<string, string> = {
      TERM: "Term",
      WHOLE_LIFE: "Whole Life",
      UNIVERSAL_LIFE: "Universal Life",
      IUL: "IUL",
      VUL: "VUL",
      FINAL_EXPENSE: "Final Expense",
      ANNUITY: "Annuity",
      DISABILITY: "Disability",
      LTC: "LTC",
      CRITICAL_ILLNESS: "Critical Illness",
      OTHER: "Other",
    };

    // Build simple message
    const lines = [
      `**${agentName}**${leadSourceText ? ` ${leadSourceText}` : ""}`,
      `${deal.carrierName}${deal.policyType ? ` ${policyLabels[deal.policyType] || deal.policyType}` : ""}`,
      `${formatCurrency(deal.annualPremium)} AP`,
      `${totalDealsToday} x OTD`,
    ];

    const embed = {
      title: "Deal Closed 💸🎉",
      color: GREEN_COLOR,
      description: lines.join("\n"),
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
