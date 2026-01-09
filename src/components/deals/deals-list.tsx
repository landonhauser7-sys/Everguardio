"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Search, FileText, Plus, Calendar } from "lucide-react";

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
  policyType: string;
  carrierName: string;
  insuranceType: "LIFE" | "HEALTH";
  faceAmount: number | null;
  annualPremium: number;
  commissionAmount: number;
  applicationDate: string;
  status: string;
  createdAt: string;
}

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

  useEffect(() => {
    async function fetchDeals() {
      try {
        const response = await fetch("/api/deals?limit=100");
        if (response.ok) {
          const data = await response.json();
          setDeals(data.deals);
        }
      } catch (error) {
        console.error("Error fetching deals:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDeals();
  }, []);

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

  if (deals.length === 0) {
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
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Policy Type</TableHead>
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
                      {format(new Date(deal.applicationDate), "MMM d, yyyy")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{deal.clientName}</div>
                      {deal.clientState && (
                        <div className="text-xs text-muted-foreground">{deal.clientState}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{policyTypeLabels[deal.policyType] || deal.policyType}</TableCell>
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
