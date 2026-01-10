"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Plus, Search, Users, CheckCircle, Clock, XCircle } from "lucide-react";

interface CarrierStatus {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  dateSubmitted: string | null;
  dateApproved: string | null;
  notes: string | null;
}

interface Carrier {
  id: string;
  name: string;
}

interface AgentOnboarding {
  id: string;
  trackerId: string | null;
  agentName: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  dateAdded: string;
  overallStatus: "NOT_STARTED" | "PENDING" | "READY";
  progressPercentage: number;
  notes: string | null;
  carrierStatuses: Record<string, CarrierStatus>;
}

interface OnboardingData {
  carriers: Carrier[];
  agents: AgentOnboarding[];
  summary: {
    totalAgents: number;
    readyCount: number;
    pendingCount: number;
    notStartedCount: number;
    avgProgress: number;
  };
}

interface Team {
  id: string;
  name: string;
}

const STATUS_COLORS = {
  NOT_STARTED: "bg-gray-600 hover:bg-gray-500",
  IN_PROGRESS: "bg-yellow-600 hover:bg-yellow-500",
  COMPLETED: "bg-green-600 hover:bg-green-500",
  REJECTED: "bg-red-600 hover:bg-red-500",
};

const STATUS_LABELS = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

const OVERALL_STATUS_COLORS = {
  NOT_STARTED: "bg-gray-600",
  PENDING: "bg-yellow-600",
  READY: "bg-green-600",
};

const OVERALL_STATUS_LABELS = {
  NOT_STARTED: "Not Started",
  PENDING: "Pending",
  READY: "Ready",
};

export default function OnboardingPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    agentId: string;
    carrierId: string;
    carrierName: string;
    agentName: string;
    currentStatus: CarrierStatus;
  } | null>(null);
  const [addAgentModal, setAddAgentModal] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/onboarding");
      if (!response.ok) throw new Error("Failed to fetch");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching onboarding data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const response = await fetch("/api/teams");
      if (response.ok) {
        const result = await response.json();
        setTeams(result);
      }
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchTeams();
  }, [fetchData, fetchTeams]);

  const cycleStatus = async (agentId: string, carrierId: string, currentStatus: string) => {
    const statusOrder = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "REJECTED"];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: agentId,
          carrierId,
          status: nextStatus,
        }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDetailedUpdate = async (
    agentId: string,
    carrierId: string,
    status: string,
    dateSubmitted: string,
    dateApproved: string,
    notes: string
  ) => {
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: agentId,
          carrierId,
          status,
          dateSubmitted: dateSubmitted || null,
          dateApproved: dateApproved || null,
          notes: notes || null,
        }),
      });

      if (response.ok) {
        setEditModal(null);
        fetchData();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleAddAgent = async () => {
    if (!selectedAgentId) return;

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedAgentId,
          initializeCarriers: true,
        }),
      });

      if (response.ok) {
        setAddAgentModal(false);
        setSelectedAgentId("");
        fetchData();
      }
    } catch (error) {
      console.error("Error adding agent:", error);
    }
  };

  const openAddAgentModal = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const users = await response.json();
        const agentsWithoutTracker = users.filter(
          (u: { id: string; firstName: string; lastName: string; email: string }) =>
            !data?.agents.find((a) => a.id === u.id)
        );
        setAvailableAgents(
          agentsWithoutTracker.map((u: { id: string; firstName: string; lastName: string; email: string }) => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
          }))
        );
        setAddAgentModal(true);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const exportToCSV = () => {
    if (!data) return;

    const headers = [
      "Agent Name",
      "Email",
      "Team",
      "Date Added",
      "Overall Status",
      "Progress %",
      ...data.carriers.map((c) => c.name),
      "Notes",
    ];

    const rows = filteredAgents.map((agent) => [
      agent.agentName,
      agent.email,
      agent.teamName || "",
      new Date(agent.dateAdded).toLocaleDateString(),
      OVERALL_STATUS_LABELS[agent.overallStatus],
      `${agent.progressPercentage}%`,
      ...data.carriers.map((c) => STATUS_LABELS[agent.carrierStatuses[c.id]?.status || "NOT_STARTED"]),
      agent.notes || "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onboarding-tracker-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-red-400">Failed to load onboarding data</p>
      </div>
    );
  }

  const filteredAgents = data.agents.filter((agent) => {
    const matchesSearch =
      agent.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || agent.overallStatus === statusFilter;
    const matchesTeam = teamFilter === "all" || agent.teamId === teamFilter;
    return matchesSearch && matchesStatus && matchesTeam;
  });

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Onboarding Tracker</h1>
          <p className="text-gray-400 mt-1">Track carrier onboarding progress for all agents</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Users className="h-4 w-4" />
            Total Agents
          </div>
          <p className="text-2xl font-bold text-white mt-1">{data.summary.totalAgents}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="h-4 w-4" />
            Ready
          </div>
          <p className="text-2xl font-bold text-green-400 mt-1">{data.summary.readyCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <Clock className="h-4 w-4" />
            Pending
          </div>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{data.summary.pendingCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <XCircle className="h-4 w-4" />
            Not Started
          </div>
          <p className="text-2xl font-bold text-gray-400 mt-1">{data.summary.notStartedCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            Avg Progress
          </div>
          <p className="text-2xl font-bold text-blue-400 mt-1">{data.summary.avgProgress}%</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {isAdmin && (
          <Button onClick={openAddAgentModal} className="bg-emerald-600 hover:bg-emerald-500">
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        )}

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="READY">Ready</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="NOT_STARTED">Not Started</SelectItem>
          </SelectContent>
        </Select>

        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
            <SelectValue placeholder="Filter by team" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={exportToCSV} className="border-gray-700 text-gray-300 hover:bg-gray-800">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Spreadsheet Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-900 hover:bg-gray-900 border-gray-700">
                <TableHead className="sticky left-0 bg-gray-900 z-10 text-white font-semibold min-w-[180px]">
                  Agent Name
                </TableHead>
                <TableHead className="text-white font-semibold min-w-[100px]">Date Added</TableHead>
                <TableHead className="text-white font-semibold min-w-[100px]">Status</TableHead>
                {data.carriers.map((carrier) => (
                  <TableHead
                    key={carrier.id}
                    className="text-white font-semibold text-center min-w-[100px] whitespace-nowrap"
                    title={carrier.name}
                  >
                    {carrier.name.length > 12 ? carrier.name.substring(0, 10) + "..." : carrier.name}
                  </TableHead>
                ))}
                <TableHead className="text-white font-semibold min-w-[80px] text-center">Progress</TableHead>
                <TableHead className="text-white font-semibold min-w-[150px]">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={data.carriers.length + 5} className="text-center text-gray-400 py-8">
                    No agents found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents.map((agent) => (
                  <TableRow key={agent.id} className="border-gray-700 hover:bg-gray-750">
                    <TableCell className="sticky left-0 bg-gray-800 z-10 font-medium text-white">
                      <div>
                        <p>{agent.agentName}</p>
                        {agent.teamName && <p className="text-xs text-gray-400">{agent.teamName}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {new Date(agent.dateAdded).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium text-white ${
                          OVERALL_STATUS_COLORS[agent.overallStatus]
                        }`}
                      >
                        {OVERALL_STATUS_LABELS[agent.overallStatus]}
                      </span>
                    </TableCell>
                    {data.carriers.map((carrier) => {
                      const status = agent.carrierStatuses[carrier.id]?.status || "NOT_STARTED";
                      return (
                        <TableCell key={carrier.id} className="text-center p-1">
                          <button
                            onClick={() => cycleStatus(agent.id, carrier.id, status)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setEditModal({
                                isOpen: true,
                                agentId: agent.id,
                                carrierId: carrier.id,
                                carrierName: carrier.name,
                                agentName: agent.agentName,
                                currentStatus: agent.carrierStatuses[carrier.id] || {
                                  status: "NOT_STARTED",
                                  dateSubmitted: null,
                                  dateApproved: null,
                                  notes: null,
                                },
                              });
                            }}
                            className={`w-full py-2 px-2 rounded text-xs font-medium text-white transition-colors ${STATUS_COLORS[status]}`}
                            title={`${STATUS_LABELS[status]} - Right-click for details`}
                          >
                            {status === "COMPLETED" && "✓"}
                            {status === "IN_PROGRESS" && "●"}
                            {status === "NOT_STARTED" && "○"}
                            {status === "REJECTED" && "✕"}
                          </button>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              agent.progressPercentage >= 75
                                ? "bg-green-500"
                                : agent.progressPercentage >= 25
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${agent.progressPercentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-300 min-w-[40px]">{agent.progressPercentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm max-w-[200px] truncate" title={agent.notes || ""}>
                      {agent.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
        <span className="font-medium text-white">Legend:</span>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-gray-600 flex items-center justify-center text-white text-xs">○</span>
          <span>Not Started</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-yellow-600 flex items-center justify-center text-white text-xs">●</span>
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-green-600 flex items-center justify-center text-white text-xs">✓</span>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-red-600 flex items-center justify-center text-white text-xs">✕</span>
          <span>Rejected</span>
        </div>
        <span className="text-gray-500 ml-4">Click to cycle • Right-click for details</span>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <EditStatusModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal(null)}
          agentId={editModal.agentId}
          carrierId={editModal.carrierId}
          carrierName={editModal.carrierName}
          agentName={editModal.agentName}
          currentStatus={editModal.currentStatus}
          onSave={handleDetailedUpdate}
        />
      )}

      {/* Add Agent Modal */}
      <Dialog open={addAgentModal} onOpenChange={setAddAgentModal}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Agent to Tracker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="bg-gray-700 border-gray-600">
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {availableAgents.length === 0 ? (
                    <SelectItem value="" disabled>
                      All agents already added
                    </SelectItem>
                  ) : (
                    availableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-gray-400">All carriers will be initialized as &quot;Not Started&quot;</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAgentModal(false)} className="border-gray-600">
              Cancel
            </Button>
            <Button onClick={handleAddAgent} disabled={!selectedAgentId} className="bg-emerald-600 hover:bg-emerald-500">
              Add Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditStatusModal({
  isOpen,
  onClose,
  agentId,
  carrierId,
  carrierName,
  agentName,
  currentStatus,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  carrierId: string;
  carrierName: string;
  agentName: string;
  currentStatus: CarrierStatus;
  onSave: (
    agentId: string,
    carrierId: string,
    status: string,
    dateSubmitted: string,
    dateApproved: string,
    notes: string
  ) => void;
}) {
  const [status, setStatus] = useState(currentStatus.status);
  const [dateSubmitted, setDateSubmitted] = useState(
    currentStatus.dateSubmitted ? currentStatus.dateSubmitted.split("T")[0] : ""
  );
  const [dateApproved, setDateApproved] = useState(
    currentStatus.dateApproved ? currentStatus.dateApproved.split("T")[0] : ""
  );
  const [notes, setNotes] = useState(currentStatus.notes || "");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>
            Update Status: {agentName} - {carrierName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <RadioGroup value={status} onValueChange={(val) => setStatus(val as CarrierStatus["status"])}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="NOT_STARTED" id="not_started" />
                <Label htmlFor="not_started">Not Started</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="IN_PROGRESS" id="in_progress" />
                <Label htmlFor="in_progress">In Progress (Submitted)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="COMPLETED" id="completed" />
                <Label htmlFor="completed">Completed (Approved)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="REJECTED" id="rejected" />
                <Label htmlFor="rejected">Rejected/Issues</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateSubmitted">Date Submitted</Label>
              <Input
                id="dateSubmitted"
                type="date"
                value={dateSubmitted}
                onChange={(e) => setDateSubmitted(e.target.value)}
                className="bg-gray-700 border-gray-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateApproved">Date Approved</Label>
              <Input
                id="dateApproved"
                type="date"
                value={dateApproved}
                onChange={(e) => setDateApproved(e.target.value)}
                className="bg-gray-700 border-gray-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-gray-700 border-gray-600"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-600">
            Cancel
          </Button>
          <Button
            onClick={() => onSave(agentId, carrierId, status, dateSubmitted, dateApproved, notes)}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
