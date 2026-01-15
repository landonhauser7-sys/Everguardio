"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { Search, FileText, Plus, Calendar, Users, User } from "lucide-react";

// Helper to parse date strings without timezone shifting
function parseLocalDate(dateString: string): Date {
  // Handle ISO datetime strings (e.g., "2024-01-15T00:00:00.000Z")
  // by extracting just the date part and treating it as local
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day);
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Deal {
  id: string;
  clientName: string;
  clientAge: number | null;
  clientState: string | null;
  clientPhone: string | null;
  policyNumber: string | null;
  draftDate: string | null;
  leadSource: string | null;
  policyType: string;
  carrierName: string;
  insuranceType: "LIFE" | "HEALTH";
  faceAmount: number | null;
  annualPremium: number;
  commissionAmount: number;
  applicationDate: string;
  status: string;
  createdAt: string;
  agent: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    profilePhotoUrl: string | null;
    role: string;
  };
}

interface DownlineMember {
  id: string;
  name: string;
  role: string;
}

const leadSourceLabels: Record<string, string> = {
  ASCENT_DIALER: "Ascent Dialer",
  EVERGUARD_DIALER: "Everguard Dialer",
  FACEBOOK_LEADS: "Facebook Leads",
  INBOUND: "Inbound",
  REFERRAL: "Referral",
  UPSELL: "Upsell",
  REWRITE: "Rewrite",
};

const policyTypeLabels: Record<string, string> = {
  TERM: "Term Life",
  WHOLE_LIFE: "Whole Life",
  UNIVERSAL_LIFE: "Universal Life",
  IUL: "IUL",
  VUL: "VUL",
  FINAL_EXPENSE: "Final Expense",
  ANNUITY: "Annuity",
  DISABILITY: "Disability",
  LTC: "Long-Term Care",
  CRITICAL_ILLNESS: "Critical Illness",
  OTHER: "Other",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
    case "ISSUED":
    case "IN_FORCE":
      return "default";
    case "PENDING":
    case "SUBMITTED":
      return "secondary";
    case "CANCELLED":
    case "LAPSED":
      return "destructive";
    default:
      return "outline";
  }
}

export function DealsList() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [insuranceFilter, setInsuranceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scope, setScope] = useState<string>("personal");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [downlineMembers, setDownlineMembers] = useState<DownlineMember[]>([]);
  const [isManager, setIsManager] = useState(false);

  const fetchDeals = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = "/api/deals?limit=100";
      if (scope === "team") {
        url += "&scope=team";
      } else if (selectedAgentId !== "all") {
        url += `&agentId=${selectedAgentId}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDeals(data.deals);
        setDownlineMembers(data.downlineMembers || []);
        setIsManager(data.isManager || false);
      }
    } catch (error) {
      console.error("Error fetching deals:", error);
    } finally {
      setIsLoading(false);
    }
  }, [scope, selectedAgentId]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Handle scope change
  const handleScopeChange = (newScope: string) => {
    setScope(newScope);
    if (newScope === "personal" || newScope === "team") {
      setSelectedAgentId("all");
    }
  };

  // Handle agent selection
  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    if (agentId !== "all") {
      setScope("agent");
    } else {
      setScope("personal");
    }
  };

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch =
      deal.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.carrierName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesInsurance =
      insuranceFilter === "all" || deal.insuranceType === insuranceFilter;

    const matchesStatus =
      statusFilter === "all" || deal.status === statusFilter;

    return matchesSearch && matchesInsurance && matchesStatus;
  });

  const totalPremium = filteredDeals.reduce((sum, deal) => sum + deal.annualPremium, 0);
  const totalCommission = filteredDeals.reduce((sum, deal) => sum + deal.commissionAmount, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deal History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Only show empty state if user has no deals AND is not a manager who can view team deals
  if (deals.length === 0 && (!isManager || downlineMembers.length === 0)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No deals yet</h3>
          <p className="text-muted-foreground text-center mb-6">
            Submit your first deal to get started!
          </p>
          <Button asChild>
            <Link href="/deals/new">
              <Plus className="mr-2 h-4 w-4" />
              Submit Your First Deal
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deals</CardDescription>
            <CardTitle className="text-2xl">{filteredDeals.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Premium</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalPremium)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Commission</CardDescription>
            <CardTitle className="text-2xl text-primary">{formatCurrency(totalCommission)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            {/* Team/Agent Filter - Only show for managers */}
            {isManager && downlineMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Select value={scope === "team" ? "team" : scope === "agent" ? selectedAgentId : "personal"} onValueChange={(value) => {
                  if (value === "personal") {
                    handleScopeChange("personal");
                  } else if (value === "team") {
                    handleScopeChange("team");
                  } else {
                    handleAgentChange(value);
                  }
                }}>
                  <SelectTrigger className="w-[200px]">
                    <Users className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="View deals..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        My Deals
                      </div>
                    </SelectItem>
                    <SelectItem value="team">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        All Team Deals
                      </div>
                    </SelectItem>
                    {downlineMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by client or carrier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={insuranceFilter} onValueChange={setInsuranceFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="LIFE">Life</SelectItem>
                    <SelectItem value="HEALTH">Health</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="ISSUED">Issued</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {(scope === "team" || scope === "agent") && <TableHead>Agent</TableHead>}
                <TableHead>Client</TableHead>
                <TableHead>Policy Info</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(parseLocalDate(deal.applicationDate), "MMM d, yyyy")}
                    </div>
                  </TableCell>
                  {(scope === "team" || scope === "agent") && (
                    <TableCell>
                      <div className="font-medium">
                        {deal.agent.firstName} {deal.agent.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{deal.agent.role}</div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div>
                      <div className="font-medium">{deal.clientName}</div>
                      <div className="text-xs text-muted-foreground">
                        {[deal.clientState, deal.clientPhone].filter(Boolean).join(" • ")}
                      </div>
                      {deal.leadSource && (
                        <div className="text-xs text-blue-500">{leadSourceLabels[deal.leadSource] || deal.leadSource}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{policyTypeLabels[deal.policyType] || deal.policyType}</div>
                      {deal.policyNumber && (
                        <div className="text-xs text-muted-foreground">#{deal.policyNumber}</div>
                      )}
                      {deal.draftDate && (
                        <div className="text-xs text-muted-foreground">Draft: {format(parseLocalDate(deal.draftDate), "MMM d")}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{deal.carrierName}</TableCell>
                  <TableCell>
                    <Badge variant={deal.insuranceType === "LIFE" ? "default" : "secondary"}>
                      {deal.insuranceType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(deal.annualPremium)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {formatCurrency(deal.commissionAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(deal.status)}>
                      {deal.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredDeals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground h-24">
                    No deals match your filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
