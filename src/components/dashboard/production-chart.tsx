"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

interface ChartDataPoint {
  date: string;
  life: number;
  health: number;
}

interface ProductionChartProps {
  data: ChartDataPoint[];
  isLoading?: boolean;
  periodLabel?: string;
}

type FilterType = "both" | "life" | "health";

function formatCurrency(value: number) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
}

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
            ${entry.value.toLocaleString()}
          </span>
        </div>
      ))}
      <div className="border-t border-gray-700 mt-3 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300 font-medium">Total</span>
          <span className="text-base font-mono font-bold text-emerald-400">
            ${payload.reduce((sum, p) => sum + p.value, 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProductionChart({ data, isLoading, periodLabel = "the selected period" }: ProductionChartProps) {
  const [filter, setFilter] = useState<FilterType>("both");

  // Format dates for display
  const chartData = data.map((d) => ({
    ...d,
    displayDate: format(new Date(d.date), "MMM d"),
  }));

  const showLife = filter === "both" || filter === "life";
  const showHealth = filter === "both" || filter === "health";

  const totalLife = data.reduce((sum, d) => sum + d.life, 0);
  const totalHealth = data.reduce((sum, d) => sum + d.health, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Production Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Production Overview
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Life vs Health premium for {periodLabel}
            </p>
          </div>
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant={filter === "both" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("both")}
              className="text-xs h-7"
            >
              Both
            </Button>
            <Button
              variant={filter === "life" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("life")}
              className="text-xs h-7"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
              Life
            </Button>
            <Button
              variant={filter === "health" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("health")}
              className="text-xs h-7"
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
              Health
            </Button>
          </div>
        </div>
        {/* Summary badges */}
        <div className="flex gap-4 mt-3">
          {showLife && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-muted-foreground">Life:</span>
              <span className="text-sm font-mono font-semibold text-emerald-600">
                ${totalLife.toLocaleString()}
              </span>
            </div>
          )}
          {showHealth && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-muted-foreground">Health:</span>
              <span className="text-sm font-mono font-semibold text-blue-600">
                ${totalHealth.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[300px] w-full">
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
                tickFormatter={formatCurrency}
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
      </CardContent>
    </Card>
  );
}
