"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface RankingEntry {
  rank: number;
  agentId: string;
  agentName: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamName: string | null;
  totalPremium: number;
  totalCommission: number;
  dealCount: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-slate-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="font-mono font-bold">{rank}</span>;
  }
}

export default function LeaderboardPage() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const response = await fetch("/api/leaderboard");
        if (response.ok) {
          const data = await response.json();
          setRankings(data.rankings);
          setCurrentUserId(data.currentUserId);
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="h-8 w-8 text-yellow-500" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground">
          Top performers based on premium production
        </p>
      </div>

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
              No rankings data available
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="h-12 px-4 text-left align-middle font-medium">Rank</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Agent</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Premium</th>
                    <th className="h-12 px-4 text-right align-middle font-medium hidden sm:table-cell">Commission</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Deals</th>
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
                            {getRankIcon(entry.rank)}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar className={cn("h-10 w-10", entry.rank <= 3 && "ring-2 ring-primary/20")}>
                              <AvatarImage
                                src={entry.profilePhotoUrl || undefined}
                                alt={entry.agentName}
                              />
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {entry.agentName}
                                {isCurrentUser && (
                                  <Badge variant="secondary" className="text-xs">
                                    You
                                  </Badge>
                                )}
                              </div>
                              {entry.teamName && (
                                <div className="text-xs text-muted-foreground">
                                  {entry.teamName}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-middle text-right">
                          <span
                            className={cn(
                              "font-mono",
                              entry.rank === 1 && "text-yellow-600 dark:text-yellow-500 font-bold",
                              entry.rank === 2 && "text-slate-600 dark:text-slate-400",
                              entry.rank === 3 && "text-amber-600"
                            )}
                          >
                            {formatCurrency(entry.totalPremium)}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-right hidden sm:table-cell">
                          <span className="font-mono text-muted-foreground">
                            {formatCurrency(entry.totalCommission)}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-right">
                          <Badge variant="outline">{entry.dealCount}</Badge>
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
