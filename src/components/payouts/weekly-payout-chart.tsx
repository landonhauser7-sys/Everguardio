"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Briefcase,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DailyBreakdown {
  [key: string]: {
    date: string;
    amount: number;
  };
}

interface PayoutDeal {
  dealId: string;
  clientName: string;
  effectiveDate: string | null;
  depositDate: string;
  premium: number;
  yourEarnings: number;
  type: "personal" | "override";
  agent: string;
  agentRole: string;
}

interface WeeklyPayoutData {
  userId: string;
  userName: string;
  userLevel: string;
  weekStart: string;
  weekEnd: string;
  weekDisplay: string;
  payouts: {
    personalCommission: number;
    overrideEarnings: number;
    total: number;
    personalDeals: number;
    overrideDeals: number;
    totalDeals: number;
  };
  deals: PayoutDeal[];
  dailyBreakdown: DailyBreakdown;
}

interface TeamPayoutData {
  userId: string;
  userName: string;
  userLevel: string;
  weekStart: string;
  weekEnd: string;
  weekDisplay: string;
  teamTotals: {
    totalProduction: number;
    totalDeals: number;
    totalCommissions: number;
    yourOverride: number;
  };
  agentBreakdown: Array<{
    agentId: string;
    agentName: string;
    level: string;
    deals: number;
    production: number;
    theirCommission: number;
    yourOverride: number;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "EEE MMM d");
}

// Helper to get week start date in local format
function getWeekStartLocal(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday is first day
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

export function WeeklyPayoutChart() {
  const [weekStart, setWeekStart] = useState<string>(() => getWeekStartLocal(new Date()));
  const [personalData, setPersonalData] = useState<WeeklyPayoutData | null>(null);
  const [teamData, setTeamData] = useState<TeamPayoutData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("personal");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch personal payouts
      const personalResponse = await fetch(`/api/payouts/weekly?week_start=${weekStart}`);
      if (personalResponse.ok) {
        const data = await personalResponse.json();
        setPersonalData(data);
      }

      // Try to fetch team payouts (will fail gracefully if not a manager)
      const teamResponse = await fetch(`/api/payouts/weekly/team?week_start=${weekStart}`);
      if (teamResponse.ok) {
        const data = await teamResponse.json();
        setTeamData(data);
        setIsManager(true);
      } else {
        setIsManager(false);
      }
    } catch (error) {
      console.error("Error fetching payout data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateWeek = (direction: "prev" | "next" | "current") => {
    if (direction === "current") {
      setWeekStart(getWeekStartLocal(new Date()));
      return;
    }

    const current = new Date(weekStart);
    current.setDate(current.getDate() + (direction === "next" ? 7 : -7));
    setWeekStart(current.toISOString().split("T")[0]);
  };

  const isCurrentWeek = weekStart === getWeekStartLocal(new Date());

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const data = activeTab === "personal" ? personalData : null;
  const team = activeTab === "team" ? teamData : null;

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Estimated Payouts
              </CardTitle>
              <CardDescription>
                Week of {personalData?.weekDisplay || "..."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant={isCurrentWeek ? "default" : "outline"}
                size="sm"
                onClick={() => navigateWeek("current")}
              >
                This Week
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs for Personal/Team view */}
      {isManager && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="personal" className="gap-2">
              <DollarSign className="h-4 w-4" />
              My Payouts
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Team Payouts
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Personal Payouts View */}
      {(activeTab === "personal" || !isManager) && personalData && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Personal Deals</CardDescription>
                <CardTitle className="text-2xl text-primary">
                  {formatCurrency(personalData.payouts.personalCommission)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {personalData.payouts.personalDeals} deals
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Override Income</CardDescription>
                <CardTitle className="text-2xl text-emerald-600">
                  {formatCurrency(personalData.payouts.overrideEarnings)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {personalData.payouts.overrideDeals} deals
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-2">
                <CardDescription>Total Estimated</CardDescription>
                <CardTitle className="text-2xl">
                  {formatCurrency(personalData.payouts.total)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {personalData.payouts.totalDeals} total deals
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-48">
                {Object.entries(personalData.dailyBreakdown).map(([day, data]) => {
                  const maxAmount = Math.max(
                    ...Object.values(personalData.dailyBreakdown).map(d => d.amount),
                    1
                  );
                  const heightPercent = (data.amount / maxAmount) * 100;
                  const isWeekend = day === "Saturday" || day === "Sunday";

                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col items-center justify-end h-32">
                        {data.amount > 0 && (
                          <span className="text-xs font-medium mb-1">
                            {formatCurrency(data.amount)}
                          </span>
                        )}
                        <div
                          className={`w-full rounded-t transition-all ${
                            isWeekend
                              ? "bg-muted"
                              : data.amount > 0
                              ? "bg-primary"
                              : "bg-muted"
                          }`}
                          style={{
                            height: `${Math.max(heightPercent, data.amount > 0 ? 10 : 2)}%`,
                            minHeight: data.amount > 0 ? "20px" : "4px",
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {day.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Deal List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deal Details</CardTitle>
              <CardDescription>
                All deals depositing this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {personalData.deals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No payouts scheduled for this week
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deposit Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Your Earnings</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personalData.deals.map((deal) => (
                      <TableRow key={deal.dealId}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(deal.depositDate)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {deal.clientName}
                        </TableCell>
                        <TableCell>
                          {deal.agent}
                          {deal.agent !== "You" && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({deal.agentRole})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(deal.premium)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={deal.type === "personal" ? "text-primary" : "text-emerald-600"}>
                            {formatCurrency(deal.yourEarnings)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={deal.type === "personal" ? "default" : "secondary"}>
                            {deal.type === "personal" ? "Personal" : "Override"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Team Payouts View */}
      {activeTab === "team" && isManager && teamData && (
        <>
          {/* Team Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Team Production</CardDescription>
                <CardTitle className="text-2xl">
                  {formatCurrency(teamData.teamTotals.totalProduction)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {teamData.teamTotals.totalDeals} deals
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Agent Commissions</CardDescription>
                <CardTitle className="text-2xl text-primary">
                  {formatCurrency(teamData.teamTotals.totalCommissions)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-emerald-500/50 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardDescription>Your Override</CardDescription>
                <CardTitle className="text-2xl text-emerald-600">
                  {formatCurrency(teamData.teamTotals.yourOverride)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Team Size</CardDescription>
                <CardTitle className="text-2xl">
                  {teamData.agentBreakdown.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  active agents
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Agent Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team Breakdown</CardTitle>
              <CardDescription>
                Performance by agent for this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamData.agentBreakdown.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No team activity for this week
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-center">Deals</TableHead>
                      <TableHead className="text-right">Production</TableHead>
                      <TableHead className="text-right">Their Commission</TableHead>
                      <TableHead className="text-right">Your Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamData.agentBreakdown.map((agent) => (
                      <TableRow key={agent.agentId}>
                        <TableCell className="font-medium">
                          {agent.agentName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{agent.level}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {agent.deals}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(agent.production)}
                        </TableCell>
                        <TableCell className="text-right text-primary">
                          {formatCurrency(agent.theirCommission)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {formatCurrency(agent.yourOverride)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="border-t-2 font-bold">
                      <TableCell>TOTALS</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center">
                        {teamData.teamTotals.totalDeals}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(teamData.teamTotals.totalProduction)}
                      </TableCell>
                      <TableCell className="text-right text-primary">
                        {formatCurrency(teamData.teamTotals.totalCommissions)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatCurrency(teamData.teamTotals.yourOverride)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
