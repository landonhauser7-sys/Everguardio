"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  DollarSign,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Search,
  LayoutGrid,
  List,
  TreeDeciduous,
  UserPlus,
  Filter,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DateRangeFilter,
  DateRangePreset,
  getPresetRange,
} from "@/components/dashboard/date-range-filter";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

function getRoleLabel(level: number): string {
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

interface HierarchyNode {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    role: string;
    commissionLevel: number;
    profilePhotoUrl: string | null;
    status: string;
    createdAt: string;
  };
  stats: {
    totalDownline: number;
    byLevel: Record<string, number>;
    personalProduction: number;
    personalDeals: number;
  };
  directRecruits: HierarchyNode[];
}

interface HierarchyStats {
  totalDownline: number;
  directRecruits: number;
  byLevel: Record<string, number>;
  totalTeamProductionMTD: number;
  totalTeamProductionYTD: number;
  totalTeamDealsMTD: number;
  totalTeamDealsYTD: number;
  totalOverrideMTD: number;
  totalOverrideYTD: number;
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  commissionLevel: number;
  profilePhotoUrl: string | null;
  personalProduction: number;
  personalDeals: number;
  depth: number;
  directUpline: string | null;
  overridePercent: number;
  overrideEarned: number;
}

// Tree Node Component
function TreeNode({
  node,
  depth = 0,
  expanded,
  onToggle,
}: {
  node: HierarchyNode;
  depth?: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isExpanded = expanded.has(node.user.id);
  const hasChildren = node.directRecruits.length > 0;
  const initials = `${node.user.firstName[0]}${node.user.lastName[0]}`;

  return (
    <div className="select-none">
      <Collapsible open={isExpanded} onOpenChange={() => onToggle(node.user.id)}>
        <div
          className={`flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors ${
            depth > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""
          }`}
        >
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-6" />
          )}

          <Avatar className="h-8 w-8">
            <AvatarImage
              src={node.user.profilePhotoUrl || undefined}
              alt={node.user.name}
            />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{node.user.name}</span>
              <Badge
                variant="outline"
                className={`text-xs ${getLevelBadgeColor(node.user.commissionLevel)}`}
              >
                {getRoleLabel(node.user.commissionLevel)} ({node.user.commissionLevel}%)
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{node.stats.totalDownline} downline</span>
              <span>{formatCurrency(node.stats.personalProduction)} production</span>
              <span>{node.stats.personalDeals} deals</span>
            </div>
          </div>
        </div>

        {hasChildren && (
          <CollapsibleContent>
            <div className="space-y-1">
              {node.directRecruits.map((child) => (
                <TreeNode
                  key={child.user.id}
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export default function HierarchyPage() {
  const [stats, setStats] = useState<HierarchyStats | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyNode | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("thisMonth");
  const [dateRange, setDateRange] = useState(() => getPresetRange("thisMonth"));
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      const response = await fetch(`/api/hierarchy/stats?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching hierarchy stats:", error);
    }
  }, [dateRange]);

  const fetchHierarchy = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        depth: "10",
      });
      const response = await fetch(`/api/hierarchy?${params}`);
      if (response.ok) {
        const data = await response.json();
        setHierarchy(data.hierarchy);
        // Auto-expand first level
        if (data.hierarchy?.directRecruits) {
          setExpanded(new Set([data.hierarchy.user.id]));
        }
      }
    } catch (error) {
      console.error("Error fetching hierarchy:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  const searchDownline = useCallback(async () => {
    if (!searchQuery && levelFilter === "all") {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      if (searchQuery) params.set("query", searchQuery);
      if (levelFilter !== "all") params.set("level", levelFilter);

      const response = await fetch(`/api/hierarchy/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error("Error searching hierarchy:", error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, levelFilter, dateRange]);

  useEffect(() => {
    fetchStats();
    fetchHierarchy();
  }, [fetchStats, fetchHierarchy]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery || levelFilter !== "all") {
        searchDownline();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, levelFilter, searchDownline]);

  const handleDateRangeChange = (
    preset: DateRangePreset,
    range: { from: Date; to: Date }
  ) => {
    setDatePreset(preset);
    setDateRange(range);
  };

  const toggleNode = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!hierarchy) return;
    const allIds = new Set<string>();
    const collectIds = (node: HierarchyNode) => {
      allIds.add(node.user.id);
      node.directRecruits.forEach(collectIds);
    };
    collectIds(hierarchy);
    setExpanded(allIds);
  };

  const collapseAll = () => {
    if (!hierarchy) return;
    setExpanded(new Set([hierarchy.user.id]));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TreeDeciduous className="h-8 w-8" />
            My Hierarchy
          </h1>
          <p className="text-muted-foreground">
            View your complete downline organization — {presetLabels[datePreset]}
          </p>
        </div>
        <DateRangeFilter
          value={datePreset}
          customRange={datePreset === "custom" ? dateRange : undefined}
          onChange={handleDateRangeChange}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downline</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats?.totalDownline || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.directRecruits || 0} direct recruits
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Production MTD</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-green-600">
                  {formatCurrency(stats?.totalTeamProductionMTD || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalTeamDealsMTD || 0} deals this month
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Override Earned MTD</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-blue-600">
                  {formatCurrency(stats?.totalOverrideMTD || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From team production
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">YTD Production</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-purple-600">
                  {formatCurrency(stats?.totalTeamProductionYTD || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.totalOverrideYTD || 0)} override YTD
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Level Breakdown */}
      {stats?.byLevel && Object.keys(stats.byLevel).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Team Composition</CardTitle>
            <CardDescription>Breakdown of your downline by level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.byLevel).map(([level, count]) => (
                <div
                  key={level}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30"
                >
                  <Badge variant="outline" className="font-medium">
                    {level}
                  </Badge>
                  <span className="text-lg font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter
              </CardTitle>
              <CardDescription>Find agents in your downline</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "tree" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("tree")}
              >
                <TreeDeciduous className="h-4 w-4 mr-1" />
                Tree
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4 mr-1" />
                Table
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="PARTNER">Partner</SelectItem>
                <SelectItem value="MGA">MGA</SelectItem>
                <SelectItem value="GA">GA</SelectItem>
                <SelectItem value="SA">SA</SelectItem>
                <SelectItem value="BA">BA</SelectItem>
                <SelectItem value="PRODIGY">Prodigy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Results */}
          {(searchQuery || levelFilter !== "all") && (
            <div className="border rounded-lg">
              {isSearching ? (
                <div className="p-8 text-center">
                  <Skeleton className="h-8 w-32 mx-auto" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No agents found matching your criteria
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="h-10 px-4 text-left font-medium">Agent</th>
                        <th className="h-10 px-4 text-center font-medium">Level</th>
                        <th className="h-10 px-4 text-left font-medium">Direct Upline</th>
                        <th className="h-10 px-4 text-center font-medium">Depth</th>
                        <th className="h-10 px-4 text-right font-medium">Production</th>
                        <th className="h-10 px-4 text-right font-medium">Override Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((result) => {
                        const initials = `${result.firstName[0]}${result.lastName[0]}`;
                        return (
                          <tr
                            key={result.id}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={result.profilePhotoUrl || undefined}
                                  />
                                  <AvatarFallback className="text-xs">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{result.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {result.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <Badge
                                variant="outline"
                                className={getLevelBadgeColor(result.commissionLevel)}
                              >
                                {result.roleLabel}
                              </Badge>
                            </td>
                            <td className="p-4 text-sm">
                              {result.directUpline || "You"}
                            </td>
                            <td className="p-4 text-center">
                              <Badge variant="secondary">{result.depth}</Badge>
                            </td>
                            <td className="p-4 text-right font-mono">
                              {formatCurrency(result.personalProduction)}
                            </td>
                            <td className="p-4 text-right">
                              <div className="font-mono text-blue-600">
                                {formatCurrency(result.overrideEarned)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {result.overridePercent}%
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hierarchy Tree/Table View */}
      {!searchQuery && levelFilter === "all" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  {viewMode === "tree" ? "Organization Tree" : "Downline List"}
                </CardTitle>
                <CardDescription>
                  {viewMode === "tree"
                    ? "Expandable view of your complete downline"
                    : "Flat list of all agents in your organization"}
                </CardDescription>
              </div>
              {viewMode === "tree" && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={expandAll}>
                    Expand All
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll}>
                    Collapse All
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !hierarchy ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No downline to display</p>
                <p className="text-sm">
                  Your direct recruits and their downlines will appear here
                </p>
              </div>
            ) : hierarchy.directRecruits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No direct recruits yet</p>
                <p className="text-sm">
                  Agents you recruit will appear in your hierarchy
                </p>
              </div>
            ) : viewMode === "tree" ? (
              <div className="space-y-1">
                {hierarchy.directRecruits.map((node) => (
                  <TreeNode
                    key={node.user.id}
                    node={node}
                    expanded={expanded}
                    onToggle={toggleNode}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="h-10 px-4 text-left font-medium">Agent</th>
                      <th className="h-10 px-4 text-center font-medium">Level</th>
                      <th className="h-10 px-4 text-center font-medium">Downline</th>
                      <th className="h-10 px-4 text-right font-medium">Production</th>
                      <th className="h-10 px-4 text-right font-medium">Deals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hierarchy.directRecruits.map((node) => {
                      const initials = `${node.user.firstName[0]}${node.user.lastName[0]}`;
                      return (
                        <tr
                          key={node.user.id}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={node.user.profilePhotoUrl || undefined}
                                />
                                <AvatarFallback className="text-xs">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{node.user.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {node.user.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <Badge
                              variant="outline"
                              className={getLevelBadgeColor(node.user.commissionLevel)}
                            >
                              {getRoleLabel(node.user.commissionLevel)}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <span className="font-bold">{node.stats.totalDownline}</span>
                          </td>
                          <td className="p-4 text-right font-mono">
                            {formatCurrency(node.stats.personalProduction)}
                          </td>
                          <td className="p-4 text-right">
                            {node.stats.personalDeals}
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
      )}
    </div>
  );
}
