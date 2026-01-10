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
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DateRangeFilter, DateRangePreset, getPresetRange } from "@/components/dashboard/date-range-filter";

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
}

type ChartFilter = "both" | "life" | "health";

const COLORS = [
  "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444",
  "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#6366F1",
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
    <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 min-w-[160px]">
      <p className="text-sm font-medium text-foreground mb-2">{date}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-muted-foreground capitalize">
              {entry.dataKey}
            </span>
          </div>
          <span className="text-sm font-mono font-semibold text-foreground">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
      <div className="border-t mt-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-sm font-mono font-bold text-foreground">
            {formatCurrency(payload.reduce((sum, p) => sum + p.value, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartFilter, setChartFilter] = useState<ChartFilter>("both");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30days");
  const [dateRange, setDateRange] = useState(() => getPresetRange("30days"));

  const fetchAnalytics = useCallback(async (range: { from: Date; to: Date }) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: range.from.toISOString(),
        endDate: range.to.toISOString(),
      });
      const response = await fetch(`/api/analytics?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
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
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradientHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="displayDate"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickMargin={10}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickFormatter={formatCompact}
                    tickMargin={10}
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {showLife && (
                    <Area
                      type="monotone"
                      dataKey="life"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fill="url(#gradientLife)"
                      dot={false}
                      activeDot={{ r: 6, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }}
                    />
                  )}
                  {showHealth && (
                    <Area
                      type="monotone"
                      dataKey="health"
                      stroke="#3B82F6"
                      strokeWidth={2.5}
                      fill="url(#gradientHealth)"
                      dot={false}
                      activeDot={{ r: 6, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
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
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis
                      type="number"
                      tickFormatter={formatCompact}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="carrier"
                      width={100}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value) || 0)}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
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
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value, entry) => (
                        <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>
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
