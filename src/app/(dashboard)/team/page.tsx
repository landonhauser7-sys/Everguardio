"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Users,
  DollarSign,
  FileText,
  TrendingUp,
  Trophy,
  Clock,
  Shield,
  Heart,
  Target,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter, DateRangePreset, getPresetRange } from "@/components/dashboard/date-range-filter";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  commissionLevel: number;
  profilePhotoUrl: string | null;
  deals: number;
  premium: number;
  commission: number;
  lifeDeals: number;
  healthDeals: number;
}

interface TeamData {
  team: {
    id: string;
    name: string;
    emoji: string | null;
    color: string | null;
    monthlyDealGoal: number | null;
    monthlyPremiumGoal: number | null;
  } | null;
  members: TeamMember[];
  stats: {
    totalPremium: number;
    totalDeals: number;
    lifeDeals: number;
    healthDeals: number;
    lifePremium: number;
    healthPremium: number;
    totalCommission: number;
    avgDealSize: number;
    managerOverrides: number;
    teamDealsCount: number;
  } | null;
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
  goalProgress: {
    deals: number | null;
    premium: number | null;
  };
  memberCount: number;
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

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "ADMIN":
      return "default" as const;
    case "TEAM_LEADER":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
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

export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30days");
  const [dateRange, setDateRange] = useState(() => getPresetRange("30days"));

  const fetchTeamData = useCallback(async (range: { from: Date; to: Date }) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: range.from.toISOString(),
        endDate: range.to.toISOString(),
      });
      const response = await fetch(`/api/team?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching team data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamData(dateRange);
  }, [fetchTeamData, dateRange]);

  const handleDateRangeChange = (preset: DateRangePreset, range: { from: Date; to: Date }) => {
    setDatePreset(preset);
    setDateRange(range);
  };

  if (!isLoading && !data?.team) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            Team
          </h1>
          <p className="text-muted-foreground">
            View your team members and performance
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Team Assigned</p>
            <p className="text-muted-foreground">
              You are not currently assigned to a team.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {data?.team?.emoji && <span className="text-3xl">{data.team.emoji}</span>}
            {data?.team?.name || "Team"}
          </h1>
          <p className="text-muted-foreground">
            {data?.memberCount || 0} members — {presetLabels[datePreset]}
          </p>
        </div>
        <DateRangeFilter
          value={datePreset}
          customRange={datePreset === "custom" ? dateRange : undefined}
          onChange={handleDateRangeChange}
        />
      </div>

      {/* Team Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Premium</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {formatCurrency(data?.stats?.totalPremium || 0)}
                </div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    <Shield className="h-3 w-3 mr-1 text-emerald-500" />
                    {formatCurrency(data?.stats?.lifePremium || 0)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Heart className="h-3 w-3 mr-1 text-blue-500" />
                    {formatCurrency(data?.stats?.healthPremium || 0)}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Overrides</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-emerald-600">
                  {formatCurrency(data?.stats?.managerOverrides || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {data?.stats?.teamDealsCount || 0} team deals (20%)
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Deals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {data?.stats?.totalDeals || 0}
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-emerald-600">{data?.stats?.lifeDeals || 0} Life</span>
                  <span className="text-xs text-muted-foreground">|</span>
                  <span className="text-xs text-blue-600">{data?.stats?.healthDeals || 0} Health</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {formatCurrency(data?.stats?.avgDealSize || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Per deal average
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goal Progress (if goals are set) */}
      {(data?.goalProgress?.deals !== null || data?.goalProgress?.premium !== null) && (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.team?.monthlyDealGoal && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Monthly Deal Goal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold font-mono">
                    {data.stats?.totalDeals || 0} / {data.team.monthlyDealGoal}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {data.goalProgress?.deals || 0}%
                  </span>
                </div>
                <Progress value={Math.min(data.goalProgress?.deals || 0, 100)} className="h-2" />
              </CardContent>
            </Card>
          )}
          {data?.team?.monthlyPremiumGoal && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Monthly Premium Goal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold font-mono">
                    {formatCurrency(data.stats?.totalPremium || 0)} / {formatCurrency(data.team.monthlyPremiumGoal)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {data.goalProgress?.premium || 0}%
                  </span>
                </div>
                <Progress value={Math.min(data.goalProgress?.premium || 0, 100)} className="h-2" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Team Members & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Team Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Team Leaderboard
            </CardTitle>
            <CardDescription>Ranked by premium production</CardDescription>
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
                {data?.members.map((member, index) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.profilePhotoUrl || undefined} />
                        <AvatarFallback>
                          {member.firstName[0]}{member.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-amber-600" : "bg-muted-foreground"
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs">
                          {member.role === "TEAM_LEADER" ? "Manager" : member.role === "ADMIN" ? "Owner" : "Agent"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {member.deals} deals • {member.lifeDeals} Life, {member.healthDeals} Health
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold">
                        {formatCurrency(member.premium)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(member.commission)} comm
                      </p>
                    </div>
                  </div>
                ))}
                {(!data?.members || data.members.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No team members
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Team Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Team Activity</CardTitle>
            <CardDescription>Latest deals from your team</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
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
      </div>
    </div>
  );
}
