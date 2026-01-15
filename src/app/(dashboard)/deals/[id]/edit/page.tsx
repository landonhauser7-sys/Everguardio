"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

import { DealForm } from "@/components/deals/deal-form";
import { Button } from "@/components/ui/button";
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
  applicationDate: string;
  effectiveDate: string | null;
  status: string;
  notes: string | null;
}

export default function EditDealPage() {
  const params = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDeal() {
      try {
        const response = await fetch(`/api/deals/${params.id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch deal");
        }
        const data = await response.json();
        // Transform API response to match form expectations
        setDeal({
          id: data.deal.id,
          clientName: data.deal.client_name,
          clientAge: data.deal.client_age,
          clientState: data.deal.client_state,
          clientPhone: data.deal.client_phone,
          policyNumber: data.deal.policy_number,
          draftDate: data.deal.draft_date,
          leadSource: data.deal.lead_source,
          policyType: data.deal.policy_type,
          carrierName: data.deal.carrier_name,
          insuranceType: data.deal.insurance_type,
          faceAmount: data.deal.face_amount,
          annualPremium: data.deal.annual_premium,
          applicationDate: data.deal.application_date,
          effectiveDate: data.deal.effective_date,
          status: data.deal.status,
          notes: data.deal.notes,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load deal");
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id) {
      fetchDeal();
    }
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <Skeleton className="h-[600px] w-full max-w-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/deals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Error</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
        <Button onClick={() => router.push("/deals")}>Back to Deals</Button>
      </div>
    );
  }

  if (!deal) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/deals">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Deal</h1>
          <p className="text-muted-foreground">
            Update details for {deal.clientName}
          </p>
        </div>
      </div>
      <DealForm deal={deal} mode="edit" />
    </div>
  );
}
