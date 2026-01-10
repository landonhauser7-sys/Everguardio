"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import {
  DollarSign,
  FileText,
  TrendingUp,
  Trophy,
  Users,
  Shield,
  Heart,
  Clock,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProductionChart } from "./production-chart";
import { DateRangeFilter, DateRangePreset, getPresetRange } from "./date-range-filter";
import { AnnouncementsBanner } from "./announcements-banner";

interface DashboardData {
  personal: {
    premium: number;
    commission: number;
    deals: number;
    lifeDeals: number;
    healthDeals: number;
    lifePremium: number;
    healthPremium: number;
  };
  recentDeals: Array<{
    id: string;
    clientName: string;
    insuranceType: string;
    annualPremium: number;
    carrierName: string;
    createdAt: string;
    agent: {
      id: string;
      firstName: string;
      lastName: string;
      profilePhotoUrl: string | null;
    };
  }>;
  topPerformers: Array<{
    id: string;
    name: string;
    premium: number;
    deals: number;
    profilePhotoUrl: string | null;
  }>;
  rank: number | null;
  totalAgents: number;
  agency: {
    premium: number;
    commission: number;
    deals: number;
    activeAgents: number;
    lifeDeals: number;
    healthDeals: number;
    lifePremium: number;
    healthPremium: number;
  } | null;
  role: string;
  productionChartData: Array<{
    date: string;
    life: number;
    health: number;
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return format(date, "MMM d");
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

export function DashboardClient({ userName }: { userName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30days");
  const [dateRange, setDateRange] = useState(() => getPresetRange("30days"));

  const fetchDashboard = useCallback(async (range: { from: Date; to: Date }) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: range.from.toISOString(),
        endDate: range.to.toISOString(),
      });
      const response = await fetch(`/api/dashboard?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(dateRange);
  }, [fetchDashboard, dateRange]);

  const handleDateRangeChange = (preset: DateRangePreset, range: { from: Date; to: Date }) => {
    setDatePreset(preset);
    setDateRange(range);
  };

  const isAdmin = data?.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {userName}!
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Agency Overview" : "Your Production Overview"} — {presetLabels[datePreset]}
          </p>
        </div>
        <DateRangeFilter
          value={datePreset}
          customRange={datePreset === "custom" ? dateRange : undefined}
          onChange={handleDateRangeChange}
        />
      </div>

      {/* Announcements */}
      <AnnouncementsBanner />

      {/* Admin Agency Stats */}
      {isAdmin && data?.agency && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agency Premium</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {formatCurrency(data.agency.premium)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.agency.deals} deals from {data.agency.activeAgents} agents
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Life Premium</CardTitle>
              <Shield className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-emerald-600">
                {formatCurrency(data.agency.lifePremium)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.agency.lifeDeals} life deals
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Health Premium</CardTitle>
              <Heart className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-blue-600">
                {formatCurrency(data.agency.healthPremium)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.agency.healthDeals} health deals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {data.agency.activeAgents}
              </div>
              <p className="text-xs text-muted-foreground">
                With production this period
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Personal Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isAdmin ? "Your Premium" : "Total Premium"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {formatCurrency(data?.personal.premium || 0)}
                </div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    <Shield className="h-3 w-3 mr-1 text-emerald-500" />
                    {formatCurrency(data?.personal.lifePremium || 0)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Heart className="h-3 w-3 mr-1 text-blue-500" />
                    {formatCurrency(data?.personal.healthPremium || 0)}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {formatCurrency(data?.personal.commission || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {data?.personal.deals || 0} deals
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals Closed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {data?.personal.deals || 0}
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-emerald-600">{data?.personal.lifeDeals || 0} Life</span>
                  <span className="text-xs text-muted-foreground">|</span>
                  <span className="text-xs text-blue-600">{data?.personal.healthDeals || 0} Health</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Rank</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {data?.rank ? `#${data.rank}` : "-"}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {data?.totalAgents || 0} agents
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Production Chart */}
      <ProductionChart
        data={data?.productionChartData || []}
        isLoading={isLoading}
        periodLabel={presetLabels[datePreset]}
      />

      {/* Recent Activity & Top Performers */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest deals across the agency</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {data?.recentDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={deal.agent.profilePhotoUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {deal.agent.firstName[0]}{deal.agent.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {deal.agent.firstName} {deal.agent.lastName}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            deal.insuranceType === "LIFE"
                              ? "border-emerald-500 text-emerald-600"
                              : "border-blue-500 text-blue-600"
                          }`}
                        >
                          {deal.insuranceType}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {deal.clientName} - {deal.carrierName}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-semibold text-sm">
                          {formatCurrency(deal.annualPremium)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(deal.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {(!data?.recentDeals || data.recentDeals.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No recent deals
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Performers
            </CardTitle>
            <CardDescription>Leading producers this period</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {data?.topPerformers.map((performer, index) => (
                  <div
                    key={performer.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={performer.profilePhotoUrl || undefined} />
                        <AvatarFallback>
                          {performer.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-amber-600" : "bg-muted-foreground"
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{performer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {performer.deals} deals
                      </p>
                    </div>
                    <p className="font-mono font-semibold">
                      {formatCurrency(performer.premium)}
                    </p>
                  </div>
                ))}
                {(!data?.topPerformers || data.topPerformers.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No performers yet
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
