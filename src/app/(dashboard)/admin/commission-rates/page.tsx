"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Percent, Loader2, Trash2, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface Carrier {
  id: string;
  name: string;
  insurance_types: string[];
  default_agent_rate: number;
  default_manager_rate: number;
}

interface CommissionRate {
  id: string;
  user_id: string;
  carrier_id: string;
  agent_rate: number;
  manager_rate: number;
  users: User;
  carriers: Carrier;
}

export default function CommissionRatesPage() {
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterCarrier, setFilterCarrier] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteRate, setDeleteRate] = useState<CommissionRate | null>(null);

  const [formData, setFormData] = useState({
    user_id: "",
    carrier_id: "",
    agent_rate: 70,
    manager_rate: 30,
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [ratesRes, usersRes, carriersRes] = await Promise.all([
        fetch("/api/commission-rates"),
        fetch("/api/users"),
        fetch("/api/carriers?includeInactive=false"),
      ]);

      if (ratesRes.ok) {
        const data = await ratesRes.json();
        setRates(data);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        // Transform user data to match expected format
        setUsers(
          data.map((u: { id: string; firstName: string; lastName: string; email: string; role: string }) => ({
            id: u.id,
            first_name: u.firstName,
            last_name: u.lastName,
            email: u.email,
            role: u.role,
          }))
        );
      }

      if (carriersRes.ok) {
        const data = await carriersRes.json();
        setCarriers(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchRates() {
    try {
      const response = await fetch("/api/commission-rates");
      if (response.ok) {
        const data = await response.json();
        setRates(data);
      }
    } catch (error) {
      console.error("Error fetching rates:", error);
    }
  }

  function openDialog() {
    setFormData({
      user_id: "",
      carrier_id: "",
      agent_rate: 70,
      manager_rate: 30,
    });
    setIsDialogOpen(true);
  }

  function handleCarrierSelect(carrierId: string) {
    const carrier = carriers.find((c) => c.id === carrierId);
    setFormData({
      ...formData,
      carrier_id: carrierId,
      agent_rate: carrier ? Math.round(carrier.default_agent_rate * 100) : 70,
      manager_rate: carrier ? Math.round(carrier.default_manager_rate * 100) : 30,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/commission-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: formData.user_id,
          carrier_id: formData.carrier_id,
          agent_rate: formData.agent_rate / 100,
          manager_rate: formData.manager_rate / 100,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save rate");
      }

      toast.success("Commission rate saved");
      setIsDialogOpen(false);
      fetchRates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save rate");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteRate) return;

    try {
      const response = await fetch(`/api/commission-rates?id=${deleteRate.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete rate");
      }

      toast.success("Commission rate deleted");
      setDeleteRate(null);
      fetchRates();
    } catch (error) {
      toast.error("Failed to delete rate");
    }
  }

  const filteredRates = rates.filter((rate) => {
    const matchesSearch =
      rate.users.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rate.users.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rate.carriers.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesUser = filterUser === "all" || rate.user_id === filterUser;
    const matchesCarrier = filterCarrier === "all" || rate.carrier_id === filterCarrier;

    return matchesSearch && matchesUser && matchesCarrier;
  });

  // Group rates by user for summary view
  const userSummary = users.map((user) => {
    const userRates = rates.filter((r) => r.user_id === user.id);
    return {
      user,
      ratesCount: userRates.length,
      carriers: userRates.map((r) => r.carriers.name),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Percent className="h-8 w-8" />
            Commission Rates
          </h1>
          <p className="text-muted-foreground">
            Manage custom commission rates for agents by carrier.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Commission Rate</DialogTitle>
              <DialogDescription>
                Set a custom commission rate for an agent with a specific carrier.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user">Agent</Label>
                <Select
                  value={formData.user_id}
                  onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="carrier">Carrier</Label>
                <Select value={formData.carrier_id} onValueChange={handleCarrierSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id}>
                        {carrier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="agent_rate">Agent Rate (%)</Label>
                  <Input
                    id="agent_rate"
                    type="number"
                    value={formData.agent_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, agent_rate: parseInt(e.target.value) || 0 })
                    }
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager_rate">Manager Rate (%)</Label>
                  <Input
                    id="manager_rate"
                    type="number"
                    value={formData.manager_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, manager_rate: parseInt(e.target.value) || 0 })
                    }
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !formData.user_id || !formData.carrier_id}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Rate"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by agent or carrier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCarrier} onValueChange={setFilterCarrier}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All carriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All carriers</SelectItem>
                {carriers.map((carrier) => (
                  <SelectItem key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <TableHead>Agent</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Agent Rate</TableHead>
                  <TableHead>Manager Rate</TableHead>
                  <TableHead>vs Default</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRates.map((rate) => {
                  const agentDiff =
                    Math.round(rate.agent_rate * 100) -
                    Math.round(rate.carriers.default_agent_rate * 100);
                  const managerDiff =
                    Math.round(rate.manager_rate * 100) -
                    Math.round(rate.carriers.default_manager_rate * 100);

                  return (
                    <TableRow key={rate.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {rate.users.first_name[0]}
                              {rate.users.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {rate.users.first_name} {rate.users.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">{rate.users.role}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {rate.carriers.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-medium">
                          {Math.round(rate.agent_rate * 100)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-medium">
                          {Math.round(rate.manager_rate * 100)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {agentDiff !== 0 && (
                            <span
                              className={`font-mono ${agentDiff > 0 ? "text-emerald-600" : "text-red-600"}`}
                            >
                              Agent: {agentDiff > 0 ? "+" : ""}
                              {agentDiff}%
                            </span>
                          )}
                          {managerDiff !== 0 && (
                            <span
                              className={`block font-mono ${managerDiff > 0 ? "text-emerald-600" : "text-red-600"}`}
                            >
                              Mgr: {managerDiff > 0 ? "+" : ""}
                              {managerDiff}%
                            </span>
                          )}
                          {agentDiff === 0 && managerDiff === 0 && (
                            <span className="text-muted-foreground">Default</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteRate(rate)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                      {rates.length === 0
                        ? "No custom commission rates set. Agents will use carrier default rates."
                        : "No rates match your filters"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteRate} onOpenChange={() => setDeleteRate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Commission Rate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the custom rate for {deleteRate?.users.first_name}{" "}
              {deleteRate?.users.last_name} with {deleteRate?.carriers.name}? They will revert to
              the carrier default rate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
