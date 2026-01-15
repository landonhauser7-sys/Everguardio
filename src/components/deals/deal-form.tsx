"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { toast } from "sonner";
import { Loader2, DollarSign, Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const policyTypes = [
  { value: "TERM", label: "Term Life" },
  { value: "WHOLE_LIFE", label: "Whole Life" },
  { value: "UNIVERSAL_LIFE", label: "Universal Life" },
  { value: "IUL", label: "Indexed Universal Life (IUL)" },
  { value: "VUL", label: "Variable Universal Life (VUL)" },
  { value: "FINAL_EXPENSE", label: "Final Expense" },
  { value: "ANNUITY", label: "Annuity" },
  { value: "DISABILITY", label: "Disability Insurance" },
  { value: "LTC", label: "Long-Term Care" },
  { value: "CRITICAL_ILLNESS", label: "Critical Illness" },
  { value: "OTHER", label: "Other" },
];

const usStates = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const leadSources = [
  { value: "ASCENT_DIALER", label: "Ascent Dialer" },
  { value: "EVERGUARD_DIALER", label: "Everguard Dialer" },
  { value: "FACEBOOK_LEADS", label: "Facebook Leads" },
  { value: "INBOUND", label: "Inbound" },
  { value: "REFERRAL", label: "Referral" },
  { value: "UPSELL", label: "Upsell" },
  { value: "REWRITE", label: "Rewrite" },
];

interface Carrier {
  id: string;
  name: string;
  insurance_types: string[];
}

interface DealData {
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
  status: string;
  notes: string | null;
}

interface DealFormProps {
  deal?: DealData;
  mode?: "create" | "edit";
}

export function DealForm({ deal, mode = "create" }: DealFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);

  const [formData, setFormData] = useState({
    clientName: deal?.clientName || "",
    clientAge: deal?.clientAge?.toString() || "",
    clientState: deal?.clientState || "",
    clientPhone: deal?.clientPhone || "",
    policyNumber: deal?.policyNumber || "",
    draftDate: deal?.draftDate ? deal.draftDate.split("T")[0] : "",
    leadSource: deal?.leadSource || "",
    policyType: deal?.policyType || "",
    carrierName: deal?.carrierName || "",
    insuranceType: deal?.insuranceType || "LIFE",
    faceAmount: deal?.faceAmount?.toString() || "",
    annualPremium: deal?.annualPremium?.toString() || "",
    applicationDate: deal?.applicationDate ? deal.applicationDate.split("T")[0] : new Date().toISOString().split("T")[0],
    status: deal?.status || "SUBMITTED",
    notes: deal?.notes || "",
  });

  const commissionLevel = session?.user?.commissionLevel || 70;
  const fycRate = formData.insuranceType === "LIFE" ? 1.0 : 0.5;
  const premium = parseFloat(formData.annualPremium) || 0;
  const baseCommission = premium * fycRate;
  const estimatedCommission = baseCommission * (commissionLevel / 100);

  useEffect(() => {
    async function fetchCarriers() {
      try {
        const response = await fetch("/api/carriers");
        if (response.ok) {
          const data = await response.json();
          setCarriers(data);
        }
      } catch (error) {
        console.error("Error fetching carriers:", error);
      }
    }
    fetchCarriers();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = mode === "edit" ? `/api/deals/${deal?.id}` : "/api/deals";
      const method = mode === "edit" ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          clientAge: formData.clientAge ? parseInt(formData.clientAge) : null,
          faceAmount: formData.faceAmount ? parseFloat(formData.faceAmount) : null,
          annualPremium: parseFloat(formData.annualPremium),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${mode === "edit" ? "update" : "submit"} deal`);
      }

      toast.success(mode === "edit" ? "Deal updated successfully!" : "Deal submitted successfully!");
      router.push("/deals");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${mode === "edit" ? "update" : "submit"} deal`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredCarriers = carriers.filter(
    (c) => c.insurance_types.includes(formData.insuranceType)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Client Information */}
      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
          <CardDescription>Enter the client details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientAge">Age</Label>
              <Input
                id="clientAge"
                type="number"
                value={formData.clientAge}
                onChange={(e) => setFormData({ ...formData, clientAge: e.target.value })}
                placeholder="35"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientState">State</Label>
              <Select
                value={formData.clientState}
                onValueChange={(value) => setFormData({ ...formData, clientState: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {usStates.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientPhone">Phone Number</Label>
              <Input
                id="clientPhone"
                type="tel"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leadSource">Lead Source</Label>
            <Select
              value={formData.leadSource}
              onValueChange={(value) => setFormData({ ...formData, leadSource: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="How was this lead generated?" />
              </SelectTrigger>
              <SelectContent>
                {leadSources.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Policy Details */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Details</CardTitle>
          <CardDescription>Enter the policy information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="insuranceType">Insurance Type *</Label>
              <Select
                value={formData.insuranceType}
                onValueChange={(value) => setFormData({ ...formData, insuranceType: value as "LIFE" | "HEALTH", carrierName: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIFE">Life Insurance</SelectItem>
                  <SelectItem value="HEALTH">Health Insurance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="policyType">Policy Type *</Label>
              <Select
                value={formData.policyType}
                onValueChange={(value) => setFormData({ ...formData, policyType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select policy type" />
                </SelectTrigger>
                <SelectContent>
                  {policyTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="carrierName">Carrier *</Label>
              <Select
                value={formData.carrierName}
                onValueChange={(value) => setFormData({ ...formData, carrierName: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCarriers.map((carrier) => (
                    <SelectItem key={carrier.id} value={carrier.name}>
                      {carrier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="policyNumber">Policy Number</Label>
              <Input
                id="policyNumber"
                value={formData.policyNumber}
                onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                placeholder="POL-123456"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="applicationDate">Application Date *</Label>
              <Input
                id="applicationDate"
                type="date"
                value={formData.applicationDate}
                onChange={(e) => setFormData({ ...formData, applicationDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draftDate">Draft Date</Label>
              <Input
                id="draftDate"
                type="date"
                value={formData.draftDate}
                onChange={(e) => setFormData({ ...formData, draftDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="faceAmount">Face Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="faceAmount"
                  type="number"
                  value={formData.faceAmount}
                  onChange={(e) => setFormData({ ...formData, faceAmount: e.target.value })}
                  className="pl-9"
                  placeholder="500000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="annualPremium">Annual Premium *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="annualPremium"
                  type="number"
                  value={formData.annualPremium}
                  onChange={(e) => setFormData({ ...formData, annualPremium: e.target.value })}
                  className="pl-9"
                  placeholder="1200"
                  required
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission Preview */}
      {premium > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5" />
              Commission Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Annual Premium:</span>
                <span className="font-mono">${premium.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  FYC Rate ({formData.insuranceType === "LIFE" ? "100%" : "50%"}):
                </span>
                <span className="font-mono">${baseCommission.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Your Level ({commissionLevel}%):
                </span>
                <span className="font-mono font-bold text-primary">
                  ${estimatedCommission.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status (edit mode only) */}
      {mode === "edit" && (
        <Card>
          <CardHeader>
            <CardTitle>Deal Status</CardTitle>
            <CardDescription>Update the status of this deal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="ISSUED">Issued</SelectItem>
                  <SelectItem value="IN_FORCE">In Force</SelectItem>
                  <SelectItem value="LAPSED">Lapsed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/deals")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "edit" ? "Saving..." : "Submitting..."}
            </>
          ) : (
            mode === "edit" ? "Save Changes" : "Submit Deal"
          )}
        </Button>
      </div>
    </form>
  );
}
