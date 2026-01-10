"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  BarChart3,
  DollarSign,
  FileText,
  Users,
  TrendingUp,
  Shield,
  Heart,
  Calculator,
  Download,
  Users2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter, DateRangePreset, getPresetRange } from "@/components/dashboard/date-range-filter";

interface TeamConfig {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
}

interface TeamStat {
  rank: number;
  teamId: string;
  teamName: string;
  teamEmoji: string | null;
  teamColor: string;
  totalDeals: number;
  lifeDeals: number;
  healthDeals: number;
  totalPremium: number;
  agentCount: number;
  avgPerAgent: number;
}

interface AnalyticsData {
  stats: {
    totalPremium: number;
    lifePremium: number;
    healthPremium: number;
    lifeDeals: number;
    healthDeals: number;
    totalDeals: number;
    avgDealSize: number;
    activeAgents: number;
  };
  dailyProduction: Array<{
    date: string;
    life: number;
    health: number;
  }>;
  premiumByCarrier: Array<{
    carrier: string;
    premium: number;
    deals: number;
    percentage: number;
  }>;
  lifeVsHealth: {
    life: { premium: number; deals: number; percentage: number };
    health: { premium: number; deals: number; percentage: number };
  };
  teamPerformance: {
    hasRealData: boolean;
    teams: TeamConfig[];
    dailyData: Array<Record<string, unknown>>;
    stats: TeamStat[];
  };
}

type ChartFilter = "both" | "life" | "health";

const COLORS = [
  "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444",
  "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#6366F1",
];

// Example mock team data for when no real teams exist
const MOCK_TEAMS: TeamConfig[] = [
  { id: "mock-1", name: "The Closers", emoji: "🔥", color: "#EF4444" },
  { id: "mock-2", name: "Phoenix Force", emoji: "⚡", color: "#A855F7" },
  { id: "mock-3", name: "The Wolves", emoji: "🐺", color: "#06B6D4" },
  { id: "mock-4", name: "Elite Squad", emoji: "💎", color: "#F59E0B" },
];

function generateMockTeamData(days: number): Array<Record<string, unknown>> {
  const data: Array<Record<string, unknown>> = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    // Generate realistic-looking performance with natural variations
    const dayOfWeek = date.getDay();
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.3 : 1;

    data.push({
      date: dateStr,
      "mock-1": Math.floor((3000 + Math.random() * 5000 + Math.sin(i / 5) * 1500) * weekendMultiplier),
      "mock-2": Math.floor((2500 + Math.random() * 4000 + Math.cos(i / 4) * 1200) * weekendMultiplier),
      "mock-3": Math.floor((2000 + Math.random() * 3500 + Math.sin(i / 6) * 1000) * weekendMultiplier),
      "mock-4": Math.floor((1800 + Math.random() * 3000 + Math.cos(i / 5) * 800) * weekendMultiplier),
    });
  }

  return data;
}

const MOCK_TEAM_STATS: TeamStat[] = [
  { rank: 1, teamId: "mock-1", teamName: "The Closers", teamEmoji: "🔥", teamColor: "#EF4444", totalDeals: 45, lifeDeals: 38, healthDeals: 7, totalPremium: 125000, agentCount: 10, avgPerAgent: 12500 },
  { rank: 2, teamId: "mock-2", teamName: "Phoenix Force", teamEmoji: "⚡", teamColor: "#A855F7", totalDeals: 38, lifeDeals: 32, healthDeals: 6, totalPremium: 98000, agentCount: 9, avgPerAgent: 10889 },
  { rank: 3, teamId: "mock-3", teamName: "The Wolves", teamEmoji: "🐺", teamColor: "#06B6D4", totalDeals: 32, lifeDeals: 28, healthDeals: 4, totalPremium: 87000, agentCount: 8, avgPerAgent: 10875 },
  { rank: 4, teamId: "mock-4", teamName: "Elite Squad", teamEmoji: "💎", teamColor: "#F59E0B", totalDeals: 28, lifeDeals: 24, healthDeals: 4, totalPremium: 76000, agentCount: 8, avgPerAgent: 9500 },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompact(value: number) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
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

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;

  const date = label ? format(new Date(label), "MMM d, yyyy") : "";

  return (
    <div className="bg-gray-900 border-2 border-emerald-500 rounded-lg shadow-lg p-4 min-w-[180px]">
      <p className="text-base font-semibold text-white mb-3">{date}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-6 mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-200 capitalize font-medium">
              {entry.dataKey}
            </span>
          </div>
          <span className="text-base font-mono font-bold text-white">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
      <div className="border-t border-gray-700 mt-3 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300 font-medium">Total</span>
          <span className="text-base font-mono font-bold text-emerald-400">
            {formatCurrency(payload.reduce((sum, p) => sum + p.value, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

function TeamChartTooltip({ active, payload, label, teams }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
  teams: TeamConfig[];
}) {
  if (!active || !payload || !payload.length) return null;

  const date = label ? format(new Date(label), "MMM d, yyyy") : "";

  return (
    <div className="bg-gray-900 border-2 border-purple-500 rounded-lg shadow-lg p-4 min-w-[200px]">
      <p className="text-base font-semibold text-white mb-3">{date}</p>
      {payload
        .filter(entry => entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => {
          const team = teams.find(t => t.id === entry.dataKey);
          return (
            <div key={index} className="flex items-center justify-between gap-6 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-200 font-medium">
                  {team?.emoji} {team?.name || entry.dataKey}
                </span>
              </div>
              <span className="text-base font-mono font-bold text-white">
                {formatCurrency(entry.value)}
              </span>
            </div>
          );
        })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartFilter, setChartFilter] = useState<ChartFilter>("both");
  const [teamChartFilter, setTeamChartFilter] = useState<ChartFilter>("both");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30days");
  const [dateRange, setDateRange] = useState(() => getPresetRange("30days"));
  const [visibleTeams, setVisibleTeams] = useState<Set<string>>(new Set());

  const fetchAnalytics = useCallback(async (range: { from: Date; to: Date }, insuranceType?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: range.from.toISOString(),
        endDate: range.to.toISOString(),
      });
      if (insuranceType && insuranceType !== "both") {
        params.set("insuranceType", insuranceType.toUpperCase());
      }
      const response = await fetch(`/api/analytics?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        // Initialize visible teams
        const teamIds = result.teamPerformance?.teams?.map((t: TeamConfig) => t.id) || [];
        setVisibleTeams(new Set(teamIds.length > 0 ? teamIds : MOCK_TEAMS.map(t => t.id)));
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(dateRange);
  }, [fetchAnalytics, dateRange]);

  const handleDateRangeChange = (preset: DateRangePreset, range: { from: Date; to: Date }) => {
    setDatePreset(preset);
    setDateRange(range);
  };

  // Format daily data for chart
  const chartData = data?.dailyProduction.map((d) => ({
    ...d,
    displayDate: format(new Date(d.date), "MMM d"),
  })) || [];

  const showLife = chartFilter === "both" || chartFilter === "life";
  const showHealth = chartFilter === "both" || chartFilter === "health";

  // Pie chart data
  const pieData = data ? [
    { name: "Life", value: data.lifeVsHealth.life.premium, color: "#10B981" },
    { name: "Health", value: data.lifeVsHealth.health.premium, color: "#3B82F6" },
  ].filter(d => d.value > 0) : [];

  // Team chart data
  const hasRealTeamData = data?.teamPerformance?.hasRealData;
  const teamConfig = hasRealTeamData && data?.teamPerformance?.teams?.length > 0
    ? data.teamPerformance.teams
    : MOCK_TEAMS;

  const teamDailyData = hasRealTeamData && data?.teamPerformance?.dailyData?.length > 0
    ? data.teamPerformance.dailyData.map(d => ({
        ...d,
        displayDate: format(new Date(d.date as string), "MMM d"),
      }))
    : generateMockTeamData(30).map(d => ({
        ...d,
        displayDate: format(new Date(d.date as string), "MMM d"),
      }));

  const teamStats = hasRealTeamData && data?.teamPerformance?.stats?.length > 0
    ? data.teamPerformance.stats
    : MOCK_TEAM_STATS;

  const toggleTeamVisibility = (teamId: string) => {
    setVisibleTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        // Don't allow hiding all teams
        if (next.size > 1) {
          next.delete(teamId);
        }
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const exportTeamStatsToCsv = () => {
    const headers = ["Rank", "Team", "Total Deals", "Life Deals", "Health Deals", "Total Premium", "Agent Count", "Avg/Agent"];
    const rows = teamStats.map(t => [
      t.rank,
      `${t.teamEmoji || ""} ${t.teamName}`.trim(),
      t.totalDeals,
      t.lifeDeals,
      t.healthDeals,
      t.totalPremium.toFixed(2),
      t.agentCount,
      t.avgPerAgent.toFixed(2),
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-performance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Analytics
          </h1>
          <p className="text-muted-foreground">
            Agency performance metrics — {presetLabels[datePreset]}
          </p>
        </div>
        <DateRangeFilter
          value={datePreset}
          customRange={datePreset === "custom" ? dateRange : undefined}
          onChange={handleDateRangeChange}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Premium</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold font-mono">
                {formatCurrency(data?.stats.totalPremium || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Life Premium</CardTitle>
            <Shield className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-emerald-600">
                  {formatCurrency(data?.stats.lifePremium || 0)}
                </div>
                <p className="text-xs text-muted-foreground">{data?.stats.lifeDeals || 0} deals</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Premium</CardTitle>
            <Heart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-blue-600">
                  {formatCurrency(data?.stats.healthPremium || 0)}
                </div>
                <p className="text-xs text-muted-foreground">{data?.stats.healthDeals || 0} deals</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono">
                {data?.stats.totalDeals || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold font-mono">
                {formatCurrency(data?.stats.avgDealSize || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {data?.stats.activeAgents || 0}
                </div>
                <p className="text-xs text-muted-foreground">with production</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Production Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Production Trend
              </CardTitle>
              <CardDescription>
                Premium by day for {presetLabels[datePreset].toLowerCase()}
              </CardDescription>
            </div>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              <Button
                variant={chartFilter === "both" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setChartFilter("both")}
                className="text-xs h-7"
              >
                Both
              </Button>
              <Button
                variant={chartFilter === "life" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setChartFilter("life")}
                className="text-xs h-7"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                Life
              </Button>
              <Button
                variant={chartFilter === "health" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setChartFilter("health")}
                className="text-xs h-7"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
                Health
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="h-[350px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradientLife" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradientHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#4B5563"
                    opacity={0.6}
                  />
                  <XAxis
                    dataKey="displayDate"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#E5E7EB", fontSize: 14, fontWeight: 500 }}
                    tickMargin={12}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#E5E7EB", fontSize: 14, fontWeight: 500 }}
                    tickFormatter={formatCompact}
                    tickMargin={12}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {showLife && (
                    <Area
                      type="monotone"
                      dataKey="life"
                      stroke="#10B981"
                      strokeWidth={3}
                      fill="url(#gradientLife)"
                      dot={{ fill: "#10B981", stroke: "#FFFFFF", strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 8, fill: "#10B981", stroke: "#FFFFFF", strokeWidth: 2 }}
                    />
                  )}
                  {showHealth && (
                    <Area
                      type="monotone"
                      dataKey="health"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      fill="url(#gradientHealth)"
                      dot={{ fill: "#3B82F6", stroke: "#FFFFFF", strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 8, fill: "#3B82F6", stroke: "#FFFFFF", strokeWidth: 2 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Performance Comparison */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users2 className="h-5 w-5" />
                Team Performance Comparison
              </CardTitle>
              <CardDescription>
                {hasRealTeamData
                  ? `Team performance over ${presetLabels[datePreset].toLowerCase()}`
                  : "Example team data — Create teams to see real performance"
                }
              </CardDescription>
            </div>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              <Button
                variant={teamChartFilter === "both" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTeamChartFilter("both")}
                className="text-xs h-7"
              >
                Both
              </Button>
              <Button
                variant={teamChartFilter === "life" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTeamChartFilter("life")}
                className="text-xs h-7"
              >
                Life
              </Button>
              <Button
                variant={teamChartFilter === "health" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTeamChartFilter("health")}
                className="text-xs h-7"
              >
                Health
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="h-[350px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <>
              {/* Legend - Click to toggle visibility */}
              <div className="flex flex-wrap gap-2 mb-4">
                {teamConfig.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => toggleTeamVisibility(team.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                      visibleTeams.has(team.id)
                        ? "opacity-100"
                        : "opacity-40 hover:opacity-60"
                    }`}
                    style={{
                      borderColor: team.color,
                      backgroundColor: visibleTeams.has(team.id) ? `${team.color}15` : "transparent"
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="text-sm font-medium text-gray-200">
                      {team.emoji} {team.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={teamDailyData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#4B5563"
                      opacity={0.6}
                    />
                    <XAxis
                      dataKey="displayDate"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#E5E7EB", fontSize: 14, fontWeight: 500 }}
                      tickMargin={12}
                      interval="preserveStartEnd"
                      minTickGap={40}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#E5E7EB", fontSize: 14, fontWeight: 500 }}
                      tickFormatter={formatCompact}
                      tickMargin={12}
                      width={70}
                    />
                    <Tooltip content={<TeamChartTooltip teams={teamConfig} />} />
                    {teamConfig.map((team) => (
                      visibleTeams.has(team.id) && (
                        <Line
                          key={team.id}
                          type="monotone"
                          dataKey={team.id}
                          name={team.name}
                          stroke={team.color}
                          strokeWidth={3}
                          dot={{ fill: team.color, stroke: "#FFFFFF", strokeWidth: 2, r: 5 }}
                          activeDot={{ r: 8, fill: team.color, stroke: "#FFFFFF", strokeWidth: 2 }}
                        />
                      )
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Team Performance Summary Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Team Performance Summary</CardTitle>
              <CardDescription>
                {hasRealTeamData
                  ? `Rankings for ${presetLabels[datePreset].toLowerCase()}`
                  : "Example data — Create teams to see real stats"
                }
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportTeamStatsToCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : teamStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No team data available. Create teams to see performance stats.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="h-12 px-4 text-left align-middle font-medium">Rank</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Team</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Total Deals</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">
                      <span className="text-emerald-600">Life</span>
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium">
                      <span className="text-blue-600">Health</span>
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Total Premium</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Avg/Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStats.map((team) => (
                    <tr key={team.teamId} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          team.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                          team.rank === 2 ? "bg-gray-100 text-gray-600" :
                          team.rank === 3 ? "bg-amber-100 text-amber-700" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {team.rank}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: team.teamColor }}
                          />
                          <div>
                            <div className="font-medium">
                              {team.teamEmoji} {team.teamName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {team.agentCount} agent{team.agentCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-middle text-right font-mono font-semibold">
                        {team.totalDeals}
                      </td>
                      <td className="p-4 align-middle text-right">
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600 font-mono">
                          {team.lifeDeals}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle text-right">
                        <Badge variant="outline" className="border-blue-500 text-blue-600 font-mono">
                          {team.healthDeals}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle text-right">
                        <span className="font-mono font-bold text-lg">
                          {formatCurrency(team.totalPremium)}
                        </span>
                      </td>
                      <td className="p-4 align-middle text-right">
                        <span className="font-mono text-muted-foreground">
                          {formatCurrency(team.avgPerAgent)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Premium by Carrier */}
        <Card>
          <CardHeader>
            <CardTitle>Premium by Carrier</CardTitle>
            <CardDescription>Top carriers by premium volume</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data?.premiumByCarrier && data.premiumByCarrier.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.premiumByCarrier}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#4B5563" />
                    <XAxis
                      type="number"
                      tickFormatter={formatCompact}
                      tick={{ fill: "#E5E7EB", fontSize: 14, fontWeight: 500 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="carrier"
                      width={100}
                      tick={{ fill: "#E5E7EB", fontSize: 14, fontWeight: 500 }}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value) || 0)}
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "2px solid #10B981",
                        borderRadius: "8px",
                        color: "#FFFFFF",
                        fontSize: "14px",
                      }}
                      labelStyle={{ color: "#F9FAFB", fontWeight: 600 }}
                    />
                    <Bar dataKey="premium" radius={[0, 4, 4, 0]}>
                      {data.premiumByCarrier.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No carrier data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Life vs Health Split */}
        <Card>
          <CardHeader>
            <CardTitle>Life vs Health Split</CardTitle>
            <CardDescription>Premium distribution by insurance type</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : pieData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value) || 0)}
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "2px solid #10B981",
                        borderRadius: "8px",
                        color: "#FFFFFF",
                        fontSize: "14px",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span style={{ color: "#E5E7EB", fontSize: "14px", fontWeight: 500 }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}

            {/* Summary stats below pie chart */}
            {data && (
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-muted-foreground">Life</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-600">
                    {formatCurrency(data.lifeVsHealth.life.premium)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.lifeVsHealth.life.percentage.toFixed(1)}% • {data.lifeVsHealth.life.deals} deals
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm text-muted-foreground">Health</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-blue-600">
                    {formatCurrency(data.lifeVsHealth.health.premium)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.lifeVsHealth.health.percentage.toFixed(1)}% • {data.lifeVsHealth.health.deals} deals
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
