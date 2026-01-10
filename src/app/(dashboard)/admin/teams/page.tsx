"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  Users2,
  Loader2,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  ChevronRight,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  role: string;
  stats?: { deals: number; premium: number };
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  emoji: string | null;
  monthlyDealGoal: number | null;
  monthlyPremiumGoal: number | null;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhotoUrl: string | null;
  } | null;
  members: TeamMember[];
  memberCount: number;
  stats?: { deals: number; premium: number };
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profilePhotoUrl: string | null;
  teamId: string | null;
}

const TEAM_EMOJIS = ["🔥", "⚡", "🚀", "💎", "🏆", "🦅", "🐺", "🦁", "🐉", "🌟", "💪", "🎯"];

const TEAM_COLORS = [
  { name: "Red", value: "#EF4444" },
  { name: "Orange", value: "#F97316" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Green", value: "#10B981" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Pink", value: "#EC4899" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const defaultFormData = {
  name: "",
  description: "",
  color: "#3B82F6",
  emoji: "🔥",
  team_leader_id: "",
  monthly_deal_goal: 50,
  monthly_premium_goal: 150000,
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [teamsRes, usersRes] = await Promise.all([
        fetch("/api/teams?includeStats=true"),
        fetch("/api/users"),
      ]);

      if (teamsRes.ok) {
        const data = await teamsRes.json();
        setTeams(data);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(
          data.map((u: { id: string; firstName: string; lastName: string; email: string; role: string; profilePhotoUrl: string | null; team?: { id: string } }) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            role: u.role,
            profilePhotoUrl: u.profilePhotoUrl,
            teamId: u.team?.id || null,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchTeamDetail(teamId: string) {
    try {
      const response = await fetch(`/api/teams/${teamId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTeam(data);
      }
    } catch (error) {
      console.error("Error fetching team detail:", error);
    }
  }

  function openCreateDialog() {
    setEditingTeam(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  }

  function openEditDialog(team: Team) {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || "",
      color: team.color || "#3B82F6",
      emoji: team.emoji || "🔥",
      team_leader_id: team.leader?.id || "",
      monthly_deal_goal: team.monthlyDealGoal || 50,
      monthly_premium_goal: team.monthlyPremiumGoal || 150000,
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingTeam ? `/api/teams/${editingTeam.id}` : "/api/teams";
      const method = editingTeam ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          color: formData.color,
          emoji: formData.emoji,
          team_leader_id: formData.team_leader_id || null,
          monthly_deal_goal: formData.monthly_deal_goal,
          monthly_premium_goal: formData.monthly_premium_goal,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save team");
      }

      toast.success(editingTeam ? "Team updated" : "Team created");
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      setEditingTeam(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save team");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTeam) return;

    try {
      const response = await fetch(`/api/teams/${deleteTeam.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete team");
      }

      toast.success("Team deleted");
      setDeleteTeam(null);
      if (selectedTeam?.id === deleteTeam.id) {
        setSelectedTeam(null);
      }
      fetchData();
    } catch (error) {
      toast.error("Failed to delete team");
    }
  }

  async function handleAddMember(userId: string) {
    if (!selectedTeam) return;

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error("Failed to add member");
      }

      toast.success("Member added");
      setIsAddMemberOpen(false);
      fetchTeamDetail(selectedTeam.id);
      fetchData();
    } catch (error) {
      toast.error("Failed to add member");
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedTeam) return;

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/members?userId=${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove member");
      }

      toast.success("Member removed");
      fetchTeamDetail(selectedTeam.id);
      fetchData();
    } catch (error) {
      toast.error("Failed to remove member");
    }
  }

  // Get users not in any team for adding
  const availableUsers = users.filter(
    (u) => !u.teamId || u.teamId !== selectedTeam?.id
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users2 className="h-8 w-8" />
            Team Management
          </h1>
          <p className="text-muted-foreground">
            Create and manage teams, assign members, and track performance.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTeam ? "Edit Team" : "Create New Team"}</DialogTitle>
              <DialogDescription>
                {editingTeam ? "Update team information." : "Create a new team for your agency."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., The Closers"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Emoji & Color</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.emoji}
                      onValueChange={(v) => setFormData({ ...formData, emoji: v })}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEAM_EMOJIS.map((emoji) => (
                          <SelectItem key={emoji} value={emoji}>
                            {emoji}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={formData.color}
                      onValueChange={(v) => setFormData({ ...formData, color: v })}
                    >
                      <SelectTrigger className="flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: formData.color }}
                          />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {TEAM_COLORS.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: color.value }}
                              />
                              {color.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Team description..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leader">Team Leader</Label>
                <Select
                  value={formData.team_leader_id}
                  onValueChange={(v) => setFormData({ ...formData, team_leader_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a leader" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No leader</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dealGoal">Monthly Deal Goal</Label>
                  <Input
                    id="dealGoal"
                    type="number"
                    value={formData.monthly_deal_goal}
                    onChange={(e) =>
                      setFormData({ ...formData, monthly_deal_goal: parseInt(e.target.value) || 0 })
                    }
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="premiumGoal">Monthly Premium Goal</Label>
                  <Input
                    id="premiumGoal"
                    type="number"
                    value={formData.monthly_premium_goal}
                    onChange={(e) =>
                      setFormData({ ...formData, monthly_premium_goal: parseInt(e.target.value) || 0 })
                    }
                    min={0}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingTeam ? "Saving..." : "Creating..."}
                    </>
                  ) : editingTeam ? (
                    "Save Changes"
                  ) : (
                    "Create Team"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Teams Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">No teams yet</p>
            <p className="text-sm text-muted-foreground">Create your first team to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const dealProgress = team.monthlyDealGoal
              ? ((team.stats?.deals || 0) / team.monthlyDealGoal) * 100
              : 0;
            const premiumProgress = team.monthlyPremiumGoal
              ? ((team.stats?.premium || 0) / team.monthlyPremiumGoal) * 100
              : 0;

            return (
              <Card
                key={team.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  fetchTeamDetail(team.id);
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-2xl p-2 rounded-lg"
                        style={{ backgroundColor: `${team.color}20` }}
                      >
                        {team.emoji || "👥"}
                      </span>
                      <div>
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        <CardDescription>{team.memberCount} members</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(team);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTeam(team);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {team.leader && (
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={team.leader.profilePhotoUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {team.leader.firstName[0]}
                          {team.leader.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
                        Led by {team.leader.firstName} {team.leader.lastName}
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Deals</span>
                        <span className="font-mono">
                          {team.stats?.deals || 0} / {team.monthlyDealGoal || 0}
                        </span>
                      </div>
                      <Progress value={Math.min(dealProgress, 100)} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Premium</span>
                        <span className="font-mono">
                          {formatCurrency(team.stats?.premium || 0)}
                        </span>
                      </div>
                      <Progress value={Math.min(premiumProgress, 100)} className="h-2" />
                    </div>
                  </div>

                  <div className="flex items-center justify-end mt-3 text-sm text-muted-foreground">
                    View details <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Team Detail Sheet */}
      <Sheet open={!!selectedTeam} onOpenChange={() => setSelectedTeam(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedTeam && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <span
                    className="text-3xl p-2 rounded-lg"
                    style={{ backgroundColor: `${selectedTeam.color}20` }}
                  >
                    {selectedTeam.emoji || "👥"}
                  </span>
                  <div>
                    <SheetTitle>{selectedTeam.name}</SheetTitle>
                    <SheetDescription>
                      {selectedTeam.memberCount} members
                      {selectedTeam.leader &&
                        ` • Led by ${selectedTeam.leader.firstName} ${selectedTeam.leader.lastName}`}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Team Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold font-mono">
                        {selectedTeam.stats?.deals || 0}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Deals this month
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold font-mono">
                        {formatCurrency(selectedTeam.stats?.premium || 0)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Premium this month
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Members */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      Team Leaderboard
                    </h3>
                    <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <UserPlus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Team Member</DialogTitle>
                          <DialogDescription>
                            Select a user to add to {selectedTeam.name}.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[300px] overflow-y-auto space-y-2">
                          {availableUsers.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent cursor-pointer"
                              onClick={() => handleAddMember(user.id)}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={user.profilePhotoUrl || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {user.firstName[0]}
                                    {user.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-sm">
                                    {user.firstName} {user.lastName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {user.email}
                                  </div>
                                </div>
                              </div>
                              <Badge variant="secondary">{user.role}</Badge>
                            </div>
                          ))}
                          {availableUsers.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">
                              All users are already in a team
                            </p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2">
                    {selectedTeam.members.map((member, index) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.profilePhotoUrl || undefined} />
                              <AvatarFallback>
                                {member.firstName[0]}
                                {member.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            {index < 3 && (
                              <div
                                className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                  index === 0
                                    ? "bg-yellow-500"
                                    : index === 1
                                      ? "bg-gray-400"
                                      : "bg-amber-600"
                                }`}
                              >
                                {index + 1}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {member.stats?.deals || 0} deals •{" "}
                              {formatCurrency(member.stats?.premium || 0)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <UserMinus className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    {selectedTeam.members.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        No members yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTeam} onOpenChange={() => setDeleteTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTeam?.name}? All members will be removed from
              this team. This action cannot be undone.
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
