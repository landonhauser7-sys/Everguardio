"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Building2, Loader2, Pencil, Trash2, Shield, Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Carrier {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  insurance_types: string[];
  default_agent_rate: number;
  default_manager_rate: number;
  created_at: string;
  updated_at: string;
  _count: {
    commission_rates: number;
    onboarding_progress: number;
  };
}

const defaultCarrier = {
  name: "",
  logo_url: "",
  insurance_types: ["LIFE"] as string[],
};

export default function CarriersPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [deleteCarrier, setDeleteCarrier] = useState<Carrier | null>(null);

  const [formData, setFormData] = useState(defaultCarrier);

  useEffect(() => {
    fetchCarriers();
  }, [showInactive]);

  async function fetchCarriers() {
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set("includeInactive", "true");
      const response = await fetch(`/api/carriers?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCarriers(data);
      }
    } catch (error) {
      console.error("Error fetching carriers:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingCarrier(null);
    setFormData(defaultCarrier);
    setIsDialogOpen(true);
  }

  function openEditDialog(carrier: Carrier) {
    setEditingCarrier(carrier);
    setFormData({
      name: carrier.name,
      logo_url: carrier.logo_url || "",
      insurance_types: carrier.insurance_types,
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        logo_url: formData.logo_url || null,
        insurance_types: formData.insurance_types,
      };

      const url = editingCarrier ? `/api/carriers/${editingCarrier.id}` : "/api/carriers";
      const method = editingCarrier ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save carrier");
      }

      toast.success(editingCarrier ? "Carrier updated" : "Carrier created");
      setIsDialogOpen(false);
      setFormData(defaultCarrier);
      setEditingCarrier(null);
      fetchCarriers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save carrier");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteCarrier) return;

    try {
      const response = await fetch(`/api/carriers/${deleteCarrier.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete carrier");
      }

      const result = await response.json();
      toast.success(result.message);
      setDeleteCarrier(null);
      fetchCarriers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete carrier");
    }
  }

  async function toggleActive(carrier: Carrier) {
    try {
      const response = await fetch(`/api/carriers/${carrier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !carrier.is_active }),
      });

      if (!response.ok) {
        throw new Error("Failed to update carrier");
      }

      toast.success(`Carrier ${carrier.is_active ? "deactivated" : "activated"}`);
      fetchCarriers();
    } catch (error) {
      toast.error("Failed to update carrier");
    }
  }

  function handleInsuranceTypeChange(type: string, checked: boolean) {
    setFormData((prev) => ({
      ...prev,
      insurance_types: checked
        ? [...prev.insurance_types, type]
        : prev.insurance_types.filter((t) => t !== type),
    }));
  }

  const filteredCarriers = carriers.filter(
    (carrier) => carrier.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Carrier Management
          </h1>
          <p className="text-muted-foreground">
            Manage insurance carriers.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Carrier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCarrier ? "Edit Carrier" : "Add New Carrier"}</DialogTitle>
              <DialogDescription>
                {editingCarrier
                  ? "Update carrier information."
                  : "Create a new insurance carrier."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Carrier Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Prudential, MetLife"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL (optional)</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>Insurance Types</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="life"
                      checked={formData.insurance_types.includes("LIFE")}
                      onCheckedChange={(checked) => handleInsuranceTypeChange("LIFE", !!checked)}
                    />
                    <Label htmlFor="life" className="flex items-center gap-1 font-normal">
                      <Shield className="h-4 w-4 text-emerald-500" />
                      Life
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="health"
                      checked={formData.insurance_types.includes("HEALTH")}
                      onCheckedChange={(checked) => handleInsuranceTypeChange("HEALTH", !!checked)}
                    />
                    <Label htmlFor="health" className="flex items-center gap-1 font-normal">
                      <Heart className="h-4 w-4 text-blue-500" />
                      Health
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || formData.insurance_types.length === 0}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingCarrier ? "Saving..." : "Creating..."}
                    </>
                  ) : editingCarrier ? (
                    "Save Changes"
                  ) : (
                    "Create Carrier"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search carriers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm text-muted-foreground">
                Show inactive
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Types</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCarriers.map((carrier) => (
                  <TableRow key={carrier.id} className={!carrier.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                          {carrier.logo_url ? (
                            <img
                              src={carrier.logo_url}
                              alt={carrier.name}
                              className="h-7 w-7 object-contain"
                            />
                          ) : (
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <span className="font-medium">{carrier.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {carrier.insurance_types.includes("LIFE") && (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                            <Shield className="h-3 w-3 mr-1" />
                            Life
                          </Badge>
                        )}
                        {carrier.insurance_types.includes("HEALTH") && (
                          <Badge variant="outline" className="border-blue-500 text-blue-600">
                            <Heart className="h-3 w-3 mr-1" />
                            Health
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {carrier._count.commission_rates} rates, {carrier._count.onboarding_progress} agents
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={carrier.is_active}
                        onCheckedChange={() => toggleActive(carrier)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(carrier)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteCarrier(carrier)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCarriers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                      No carriers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteCarrier} onOpenChange={() => setDeleteCarrier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Carrier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteCarrier?.name}?
              {deleteCarrier && (deleteCarrier._count.commission_rates > 0 || deleteCarrier._count.onboarding_progress > 0) && (
                <span className="block mt-2 text-amber-600">
                  This carrier has related records and will be deactivated instead of deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
