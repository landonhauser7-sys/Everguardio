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

interface Carrier {
  id: string;
  name: string;
  insurance_types: string[];
}

export function DealForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);

  const [formData, setFormData] = useState({
    clientName: "",
    clientAge: "",
    clientState: "",
    policyType: "",
    carrierName: "",
    insuranceType: "LIFE",
    faceAmount: "",
    annualPremium: "",
    applicationDate: new Date().toISOString().split("T")[0],
    notes: "",
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
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          clientAge: formData.clientAge ? parseInt(formData.clientAge) : undefined,
          faceAmount: formData.faceAmount ? parseFloat(formData.faceAmount) : undefined,
          annualPremium: parseFloat(formData.annualPremium),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit deal");
      }

      toast.success("Deal submitted successfully!");
      router.push("/deals");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit deal");
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
                onValueChange={(value) => setFormData({ ...formData, insuranceType: value, carrierName: "" })}
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
              <Label htmlFor="applicationDate">Application Date *</Label>
              <Input
                id="applicationDate"
                type="date"
                value={formData.applicationDate}
                onChange={(e) => setFormData({ ...formData, applicationDate: e.target.value })}
                required
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
              Submitting...
            </>
          ) : (
            "Submit Deal"
          )}
        </Button>
      </div>
    </form>
  );
}
