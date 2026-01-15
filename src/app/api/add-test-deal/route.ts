// @ts-nocheck
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendDiscordSaleNotification } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Random test data
    const carriers = ["Ethos", "American Amicable", "Mutual of Omaha", "Americo", "Prosperity Life"];
    const policyTypes = ["TERM", "WHOLE_LIFE", "FINAL_EXPENSE", "IUL"];
    const leadSources = ["ASCENT_DIALER", "EVERGUARD_DIALER", "FACEBOOK_LEADS", "INBOUND", "REFERRAL"];
    const premiums = [800, 1000, 1200, 1500, 1850, 2000, 2500];

    const carrier = carriers[Math.floor(Math.random() * carriers.length)];
    const policyType = policyTypes[Math.floor(Math.random() * policyTypes.length)];
    const leadSource = leadSources[Math.floor(Math.random() * leadSources.length)];
    const premium = premiums[Math.floor(Math.random() * premiums.length)];

    // Get the admin user (Landon)
    const user = await prisma.users.findFirst({
      where: { email: "landonhauser7@gmail.com" },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const dealId = crypto.randomUUID();
    const deal = await prisma.deals.create({
      data: {
        id: dealId,
        agent_id: user.id,
        client_name: `Test Client ${Math.floor(Math.random() * 1000)}`,
        policy_type: policyType,
        carrier_name: carrier,
        insurance_type: "LIFE",
        annual_premium: premium,
        commission_rate: 70,
        commission_amount: premium * 0.7,
        application_date: new Date(),
        lead_source: leadSource,
        status: "SUBMITTED",
        updated_at: new Date(),
      },
    });

    // Get today's deal count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDealsToday = await prisma.deals.count({
      where: { created_at: { gte: today } },
    });

    // Send Discord notification
    await sendDiscordSaleNotification({
      deal: {
        id: dealId,
        clientName: deal.client_name,
        annualPremium: premium,
        insuranceType: "LIFE",
        carrierName: carrier,
        policyType: policyType,
        leadSource: leadSource,
      },
      agent: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      totalAgentDeals: 1,
      totalDealsToday,
    });

    return NextResponse.json({
      success: true,
      deal: {
        id: deal.id,
        clientName: deal.client_name,
        carrier,
        policyType,
        premium,
        leadSource,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
