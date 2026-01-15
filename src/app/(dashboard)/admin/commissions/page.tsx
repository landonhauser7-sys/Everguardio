"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  DollarSign,
  Users,
  Download,
  TrendingUp,
  Percent,
  Building2,
  UserCheck,
  ChevronRight,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DateRangeFilter,
  DateRangePreset,
  getPresetRange,
} from "@/components/dashboard/date-range-filter";
import { useSession } from "@/components/session-provider";

interface CompanyTotals {
  totalCommissionPool: number;
  agentCommissions: number;
  managerOverrides: number;
  ownerOverrides: number;
  totalPremium: number;
  totalDeals: number;
}

interface AgentEntry {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  commissionLevel: number;
  personalSales: number;
  personalDeals: number;
  overrideEarned: number;
  totalCommission: number;
}

interface ManagerEntry {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  teamAgents: number;
  teamDeals: number;
  overrideEarned: number;
  personalSales: number;
}

interface OwnerBreakdown {
  fromManagers: number;
  fromDirectAgents: number;
  totalOverrides: number;
}

interface CommissionData {
  companyTotals: CompanyTotals;
  agentBreakdown: AgentEntry[];
  managerBreakdown: ManagerEntry[];
  ownerBreakdown: OwnerBreakdown;
  dateRange: {
    start: string;
    end: string;
  };
}

const presetLabels: Record<DateRangePreset, string> = {
  today: "Today",
  "7days": "Last 7 Days",
  "30days": "Last 30 Days",
  "90days": "Last 90 Days",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  ytd: "Year to Date",
  custom: "Custom Range",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getLevelLabel(level: number): string {
  switch (level) {
    case 130:
      return "AO";
    case 120:
      return "Partner";
    case 110:
      return "MGA";
    case 100:
      return "GA";
    case 90:
      return "SA";
    case 80:
      return "BA";
    default:
      return "Prodigy";
  }
}

function getLevelBadgeColor(level: number): string {
  switch (level) {
    case 130:
      return "bg-amber-100 text-amber-800 border-amber-200";
    case 120:
      return "bg-purple-100 text-purple-800 border-purple-200";
    case 110:
      return "bg-violet-100 text-violet-800 border-violet-200";
    case 100:
      return "bg-blue-100 text-blue-800 border-blue-200";
    case 90:
      return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case 80:
      return "bg-teal-100 text-teal-800 border-teal-200";
    default:
      return "bg-green-100 text-green-800 border-green-200";
  }
}

export default function CommissionsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<CommissionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("thisMonth");
  const [dateRange, setDateRange] = useState(() => getPresetRange("thisMonth"));
  const [agentSearch, setAgentSearch] = useState("");

  // Only AO can see owner overrides
  const canViewOwnerOverrides = session?.user?.role === "AO";

  const fetchCommissions = useCallback(async (range: { from: Date; to: Date }) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: range.from.toISOString(),
        endDate: range.to.toISOString(),
      });
      const response = await fetch(`/api/commissions?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching commissions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommissions(dateRange);
  }, [fetchCommissions, dateRange]);

  const handleDateRangeChange = (preset: DateRangePreset, range: { from: Date; to: Date }) => {
    setDatePreset(preset);
    setDateRange(range);
  };

  function exportToCsv() {
    if (!data) return;

    // Agent breakdown CSV
    const headers = ["Name", "Level", "Personal Sales", "Personal Deals", "Override Earned", "Total Commission"];
    const rows = data.agentBreakdown.map((a) => [
      a.name,
      `${a.commissionLevel}%`,
      a.personalSales.toFixed(2),
      a.personalDeals,
      a.overrideEarned.toFixed(2),
      a.totalCommission.toFixed(2),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commission-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Percent className="h-8 w-8" />
            Commission Reports
          </h1>
          <p className="text-muted-foreground">
            7-level hierarchy commission tracking — {presetLabels[datePreset]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter
            value={datePreset}
            customRange={datePreset === "custom" ? dateRange : undefined}
            onChange={handleDateRangeChange}
          />
          <Button variant="outline" onClick={exportToCsv} disabled={!data || isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Company Totals */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commission Pool</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {formatCurrency(data?.companyTotals.totalCommissionPool || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {data?.companyTotals.totalDeals || 0} deals
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Commissions</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-green-600">
                  {formatCurrency(data?.companyTotals.agentCommissions || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data?.companyTotals.totalCommissionPool
                    ? ((data.companyTotals.agentCommissions / data.companyTotals.totalCommissionPool) * 100).toFixed(1)
                    : 0}% of pool
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manager Overrides</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-blue-600">
                  {formatCurrency(data?.companyTotals.managerOverrides || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data?.companyTotals.totalCommissionPool
                    ? ((data.companyTotals.managerOverrides / data.companyTotals.totalCommissionPool) * 100).toFixed(1)
                    : 0}% of pool
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {canViewOwnerOverrides && (
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Owner Overrides</CardTitle>
              <Building2 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono text-purple-600">
                    {formatCurrency(data?.companyTotals.ownerOverrides || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data?.companyTotals.totalCommissionPool
                      ? ((data.companyTotals.ownerOverrides / data.companyTotals.totalCommissionPool) * 100).toFixed(1)
                      : 0}% of pool
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Agent Breakdown Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Agent Breakdown
              </CardTitle>
              <CardDescription>
                Individual commission earnings and override income
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data || data.agentBreakdown.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No commission data for selected period
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="h-12 px-4 text-left align-middle font-medium">Agent</th>
                    <th className="h-12 px-4 text-center align-middle font-medium">Level</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Personal Sales</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Override Earned</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Total Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agentBreakdown
                    .filter((agent) =>
                      agent.name.toLowerCase().includes(agentSearch.toLowerCase())
                    )
                    .map((agent) => {
                    const initials = agent.name.split(" ").map(n => n[0]).join("");
                    return (
                      <tr key={agent.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={agent.profilePhotoUrl || undefined} alt={agent.name} />
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{agent.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {agent.personalDeals} deals
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-middle text-center">
                          <Badge
                            variant="outline"
                            className={getLevelBadgeColor(agent.commissionLevel)}
                          >
                            {agent.commissionLevel}%
                          </Badge>
                        </td>
                        <td className="p-4 align-middle text-right">
                          <span className="font-mono font-semibold">
                            {formatCurrency(agent.personalSales)}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-right">
                          {agent.overrideEarned > 0 ? (
                            <span className="font-mono text-blue-600 font-semibold">
                              {formatCurrency(agent.overrideEarned)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4 align-middle text-right">
                          <span className="font-mono font-bold text-lg">
                            {formatCurrency(agent.totalCommission)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.agentBreakdown.filter((agent) =>
                agent.name.toLowerCase().includes(agentSearch.toLowerCase())
              ).length === 0 && agentSearch && (
                <div className="text-center py-8 text-muted-foreground">
                  No agents found matching &quot;{agentSearch}&quot;
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owner Override Breakdown - Only visible to AO/Partner */}
      {canViewOwnerOverrides && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              Owner Override Breakdown
            </CardTitle>
            <CardDescription>
              Override earnings by source
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="text-sm text-muted-foreground mb-1">
                      From Managers
                    </div>
                    <div className="text-2xl font-bold font-mono text-purple-600">
                      {formatCurrency(data?.ownerBreakdown.fromManagers || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      BA through Partner sales
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="text-sm text-muted-foreground mb-1">
                      From Agents
                    </div>
                    <div className="text-2xl font-bold font-mono text-purple-600">
                      {formatCurrency(data?.ownerBreakdown.fromDirectAgents || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Prodigy production
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border-2 border-purple-200 bg-purple-50 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        Total Owner Overrides
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400">
                        All override income
                      </div>
                    </div>
                    <div className="text-3xl font-bold font-mono text-purple-700 dark:text-purple-300">
                      {formatCurrency(data?.ownerBreakdown.totalOverrides || 0)}
                    </div>
                  </div>
                </div>

                {/* Commission Flow Explanation */}
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="text-sm font-medium">7-Level Commission Hierarchy</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      <span>Each level earns 10% override from the level below</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      <span>Prodigy 70% → BA 80% → SA 90% → GA 100%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      <span>GA 100% → MGA 110% → Partner 120% → AO 130%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
