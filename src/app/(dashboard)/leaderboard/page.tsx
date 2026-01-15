"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Medal, Award, Download, Shield, Heart, Users, FileText, DollarSign, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TimePeriod = "today" | "thisWeek" | "thisMonth" | "lastMonth" | "ytd" | "allTime";
type InsuranceFilter = "both" | "life" | "health";
type SortMetric = "premium" | "deals" | "avgDeal";

interface Team {
  id: string;
  name: string;
  emoji: string | null;
}

interface RankingEntry {
  rank: number;
  agentId: string;
  agentName: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  teamEmoji: string | null;
  teamColor: string | null;
  totalPremium: number;
  totalCommission: number;
  dealCount: number;
  lifeDeals: number;
  healthDeals: number;
  lifePremium: number;
  healthPremium: number;
  avgDealSize: number;
}

interface Summary {
  totalAgents: number;
  totalDeals: number;
  totalPremium: number;
  avgDealsPerAgent: number;
}

const timePeriodLabels: Record<TimePeriod, string> = {
  today: "Today",
  thisWeek: "This Week",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  ytd: "Year to Date",
  allTime: "All Time",
};

function getDateRange(period: TimePeriod): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case "today":
      return { from: today, to: now };
    case "thisWeek": {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return { from: startOfWeek, to: now };
    }
    case "thisMonth":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case "lastMonth": {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: lastMonth, to: endOfLastMonth };
    }
    case "ytd":
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    case "allTime":
      return { from: new Date(2020, 0, 1), to: now };
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getRankDisplay(rank: number) {
  switch (rank) {
    case 1:
      return <span className="text-xl">👑</span>;
    case 2:
      return <span className="text-xl">🥈</span>;
    case 3:
      return <span className="text-xl">🥉</span>;
    default:
      return <span className="font-mono font-bold text-muted-foreground">{rank}</span>;
  }
}

export default function LeaderboardPage() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [timePeriod, setTimePeriod] = useState<TimePeriod>("thisMonth");
  const [insuranceFilter, setInsuranceFilter] = useState<InsuranceFilter>("both");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortMetric, setSortMetric] = useState<SortMetric>("premium");

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const range = getDateRange(timePeriod);
      const params = new URLSearchParams({
        startDate: range.from.toISOString(),
        endDate: range.to.toISOString(),
        sortBy: sortMetric,
      });

      if (insuranceFilter !== "both") {
        params.set("insuranceType", insuranceFilter.toUpperCase());
      }
      if (teamFilter !== "all") {
        params.set("teamId", teamFilter);
      }

      const response = await fetch(`/api/leaderboard?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRankings(data.rankings);
        setTeams(data.teams);
        setSummary(data.summary);
        setCurrentUserId(data.currentUserId);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, [timePeriod, insuranceFilter, teamFilter, sortMetric]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  function exportToCsv() {
    const headers = ["Rank", "Agent", "Team", "Deals", "Life Deals", "Health Deals", "Total Premium", "Avg Deal"];
    const rows = rankings.map((r) => [
      r.rank,
      r.agentName,
      r.teamName || "-",
      r.dealCount,
      r.lifeDeals,
      r.healthDeals,
      r.totalPremium,
      Math.round(r.avgDealSize),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard-${timePeriodLabels[timePeriod].toLowerCase().replace(/\s/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground">
            Top performers — {timePeriodLabels[timePeriod]}
          </p>
        </div>
        <Button variant="outline" onClick={exportToCsv} disabled={rankings.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Time Period</label>
              <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(timePeriodLabels) as TimePeriod[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {timePeriodLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Insurance Type</label>
              <Select value={insuranceFilter} onValueChange={(v) => setInsuranceFilter(v as InsuranceFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="life">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-500" />
                      Life Only
                    </div>
                  </SelectItem>
                  <SelectItem value="health">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-blue-500" />
                      Health Only
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Team</label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.emoji || "👥"} {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Sort By</label>
              <Select value={sortMetric} onValueChange={(v) => setSortMetric(v as SortMetric)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Total Premium</SelectItem>
                  <SelectItem value="deals">Deal Count</SelectItem>
                  <SelectItem value="avgDeal">Average Deal Size</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Agents Ranked</span>
              </div>
              <div className="text-2xl font-bold font-mono mt-1">{summary.totalAgents}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Deals</span>
              </div>
              <div className="text-2xl font-bold font-mono mt-1">{summary.totalDeals}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Premium</span>
              </div>
              <div className="text-2xl font-bold font-mono mt-1">{formatCurrency(summary.totalPremium)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Deals/Agent</span>
              </div>
              <div className="text-2xl font-bold font-mono mt-1">{summary.avgDealsPerAgent.toFixed(1)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top 3 Podium */}
      {!isLoading && rankings.length >= 1 && (
        <Card className="overflow-hidden p-0">
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Performers
            </h3>
          </div>
          <CardContent className="pt-8 pb-6">
            <div className="flex items-end justify-center gap-4 md:gap-8">
              {/* 2nd Place */}
              {rankings[1] && (
                <div className="flex flex-col items-center">
                  <div className="relative mb-3">
                    <Avatar className="h-16 w-16 md:h-20 md:w-20 ring-4 ring-gray-400 shadow-lg">
                      <AvatarImage src={rankings[1].profilePhotoUrl || undefined} alt={rankings[1].agentName} />
                      <AvatarFallback className="text-lg md:text-xl bg-gray-100">
                        {rankings[1].firstName?.[0]}{rankings[1].lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-2xl">🥈</div>
                  </div>
                  <div className="bg-gradient-to-t from-gray-400 to-gray-300 rounded-t-lg w-24 md:w-32 h-24 flex flex-col items-center justify-start pt-4 shadow-lg">
                    <span className="text-3xl font-bold text-white drop-shadow">2</span>
                  </div>
                  <div className="text-center mt-3 max-w-[120px] md:max-w-[140px]">
                    <p className="font-semibold truncate">{rankings[1].agentName}</p>
                    {rankings[1].teamName && (
                      <p className="text-xs text-muted-foreground truncate">
                        {rankings[1].teamEmoji} {rankings[1].teamName}
                      </p>
                    )}
                    <p className="font-mono font-bold text-gray-600 mt-1">
                      {formatCurrency(rankings[1].totalPremium)}
                    </p>
                    <p className="text-xs text-muted-foreground">{rankings[1].dealCount} deals</p>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {rankings[0] && (
                <div className="flex flex-col items-center -mt-8">
                  <div className="relative mb-3">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl animate-pulse">👑</div>
                    <Avatar className="h-20 w-20 md:h-24 md:w-24 ring-4 ring-yellow-500 shadow-xl">
                      <AvatarImage src={rankings[0].profilePhotoUrl || undefined} alt={rankings[0].agentName} />
                      <AvatarFallback className="text-xl md:text-2xl bg-yellow-100">
                        {rankings[0].firstName?.[0]}{rankings[0].lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-3xl">🥇</div>
                  </div>
                  <div className="bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t-lg w-28 md:w-36 h-32 flex flex-col items-center justify-start pt-4 shadow-xl">
                    <span className="text-4xl font-bold text-white drop-shadow">1</span>
                  </div>
                  <div className="text-center mt-3 max-w-[130px] md:max-w-[160px]">
                    <p className="font-bold text-lg truncate">{rankings[0].agentName}</p>
                    {rankings[0].teamName && (
                      <p className="text-sm text-muted-foreground truncate">
                        {rankings[0].teamEmoji} {rankings[0].teamName}
                      </p>
                    )}
                    <p className="font-mono font-bold text-yellow-600 text-lg mt-1">
                      {formatCurrency(rankings[0].totalPremium)}
                    </p>
                    <p className="text-sm text-muted-foreground">{rankings[0].dealCount} deals</p>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {rankings[2] && (
                <div className="flex flex-col items-center">
                  <div className="relative mb-3">
                    <Avatar className="h-14 w-14 md:h-18 md:w-18 ring-4 ring-amber-600 shadow-lg">
                      <AvatarImage src={rankings[2].profilePhotoUrl || undefined} alt={rankings[2].agentName} />
                      <AvatarFallback className="text-base md:text-lg bg-amber-100">
                        {rankings[2].firstName?.[0]}{rankings[2].lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-2xl">🥉</div>
                  </div>
                  <div className="bg-gradient-to-t from-amber-700 to-amber-600 rounded-t-lg w-20 md:w-28 h-20 flex flex-col items-center justify-start pt-3 shadow-lg">
                    <span className="text-2xl font-bold text-white drop-shadow">3</span>
                  </div>
                  <div className="text-center mt-3 max-w-[110px] md:max-w-[130px]">
                    <p className="font-semibold text-sm truncate">{rankings[2].agentName}</p>
                    {rankings[2].teamName && (
                      <p className="text-xs text-muted-foreground truncate">
                        {rankings[2].teamEmoji} {rankings[2].teamName}
                      </p>
                    )}
                    <p className="font-mono font-bold text-amber-700 mt-1">
                      {formatCurrency(rankings[2].totalPremium)}
                    </p>
                    <p className="text-xs text-muted-foreground">{rankings[2].dealCount} deals</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rankings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No rankings data available for the selected filters
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="h-12 px-4 text-left align-middle font-medium w-16">Rank</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Agent</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Team</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Deals</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <Shield className="h-3 w-3 text-emerald-500" />
                        Life
                      </div>
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <Heart className="h-3 w-3 text-blue-500" />
                        Health
                      </div>
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Total Premium</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Avg Deal</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((entry) => {
                    const isCurrentUser = entry.agentId === currentUserId;
                    const initials = `${entry.firstName?.[0] || ""}${entry.lastName?.[0] || ""}`;

                    return (
                      <tr
                        key={entry.agentId}
                        className={cn(
                          "border-b transition-colors hover:bg-muted/50",
                          isCurrentUser && "bg-primary/5 hover:bg-primary/10",
                          entry.rank <= 3 && "font-medium"
                        )}
                      >
                        <td className="p-4 align-middle">
                          <div className="flex items-center justify-center w-8">
                            {getRankDisplay(entry.rank)}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className={cn("h-10 w-10", entry.rank <= 3 && "ring-2 ring-primary/20")}>
                                <AvatarImage src={entry.profilePhotoUrl || undefined} alt={entry.agentName} />
                                <AvatarFallback>{initials}</AvatarFallback>
                              </Avatar>
                              {entry.rank <= 3 && (
                                <div
                                  className={cn(
                                    "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white",
                                    entry.rank === 1 && "bg-yellow-500",
                                    entry.rank === 2 && "bg-gray-400",
                                    entry.rank === 3 && "bg-amber-600"
                                  )}
                                >
                                  {entry.rank}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {entry.agentName}
                                {isCurrentUser && (
                                  <Badge variant="secondary" className="text-xs">
                                    You
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          {entry.teamName ? (
                            <Badge
                              variant="outline"
                              className="font-normal"
                              style={entry.teamColor ? { borderColor: entry.teamColor, color: entry.teamColor } : undefined}
                            >
                              {entry.teamEmoji || "👥"} {entry.teamName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4 align-middle text-right">
                          <span className="font-mono font-semibold">{entry.dealCount}</span>
                        </td>
                        <td className="p-4 align-middle text-right">
                          <span className="font-mono text-emerald-600">{entry.lifeDeals}</span>
                        </td>
                        <td className="p-4 align-middle text-right">
                          <span className="font-mono text-blue-600">{entry.healthDeals}</span>
                        </td>
                        <td className="p-4 align-middle text-right">
                          <span
                            className={cn(
                              "font-mono font-semibold",
                              entry.rank === 1 && "text-yellow-600 dark:text-yellow-500"
                            )}
                          >
                            {formatCurrency(entry.totalPremium)}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-right">
                          <span className="font-mono text-muted-foreground">
                            {formatCurrency(entry.avgDealSize)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
