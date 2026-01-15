import { WeeklyPayoutChart } from "@/components/payouts/weekly-payout-chart";

export default function PayoutsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Track your estimated weekly payouts and team performance
        </p>
      </div>
      <WeeklyPayoutChart />
    </div>
  );
}
