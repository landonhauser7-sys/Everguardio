"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Users, Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DialogFooter,
} from "@/components/ui/dialog";
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
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  role: string;
  status: string;
  profilePhotoUrl: string | null;
  commissionLevel: number;
  createdAt: string;
  team: { id: string; name: string } | null;
  manager: { id: string; name: string } | null;
  managerId: string | null;
}

interface Team {
  id: string;
  name: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    role: "",
    commissionLevel: 70,
    status: "",
    teamId: "",
    managerId: "",
  });

  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "AGENT",
    commissionLevel: 70,
    managerId: "",
    teamId: "",
  });

  // Get managers (TEAM_LEADER or ADMIN roles) for selection
  const managers = users.filter(
    (u) => u.role === "TEAM_LEADER" || u.role === "ADMIN"
  );

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchTeams() {
    try {
      const response = await fetch("/api/teams");
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newUser,
          managerId: newUser.managerId || undefined,
          teamId: newUser.teamId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }

      toast.success("User created successfully");
      setIsDialogOpen(false);
      setNewUser({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "AGENT",
        commissionLevel: 70,
        managerId: "",
        teamId: "",
      });
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditDialog(user: User) {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      commissionLevel: user.commissionLevel,
      status: user.status,
      teamId: user.team?.id || "",
      managerId: user.managerId || "",
    });
  }

  async function handleUpdateUser() {
    if (!editingUser) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editForm.role,
          commissionLevel: editForm.commissionLevel,
          status: editForm.status,
          teamId: editForm.teamId || null,
          managerId: editForm.managerId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update user");
      }

      toast.success(`${editingUser.firstName} ${editingUser.lastName} updated successfully`);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Auto-set commission level based on role
  function handleRoleChange(role: string) {
    let commissionLevel = editForm.commissionLevel;
    if (role === "AGENT") {
      commissionLevel = 70;
    } else if (role === "TEAM_LEADER") {
      commissionLevel = 90;
    } else if (role === "ADMIN") {
      commissionLevel = 130;
    }
    setEditForm({ ...editForm, role, commissionLevel });
  }

  function handleNewUserRoleChange(role: string) {
    let commissionLevel = newUser.commissionLevel;
    if (role === "AGENT") {
      commissionLevel = 70;
    } else if (role === "TEAM_LEADER") {
      commissionLevel = 90;
    } else if (role === "ADMIN") {
      commissionLevel = 130;
    }
    setNewUser({ ...newUser, role, commissionLevel });
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" => {
    switch (role) {
      case "ADMIN":
        return "destructive";
      case "TEAM_LEADER":
        return "default";
      default:
        return "secondary";
    }
  };

  const getCommissionColor = (level: number) => {
    if (level >= 130) return "text-amber-500";
    if (level >= 110) return "text-blue-500";
    return "text-gray-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            User Management
          </h1>
          <p className="text-muted-foreground">
            Manage users, roles, and commission levels.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby="add-user-description">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription id="add-user-description">
                Create a new user account.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={handleNewUserRoleChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AGENT">Agent (70%)</SelectItem>
                      <SelectItem value="TEAM_LEADER">Manager (90%)</SelectItem>
                      <SelectItem value="ADMIN">Admin/Owner (130%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionLevel">Commission Level (%)</Label>
                  <Input
                    id="commissionLevel"
                    type="number"
                    value={newUser.commissionLevel}
                    onChange={(e) => setNewUser({ ...newUser, commissionLevel: parseInt(e.target.value) })}
                    min={0}
                    max={200}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manager">Manager</Label>
                  <Select
                    value={newUser.managerId || "none"}
                    onValueChange={(value) => setNewUser({ ...newUser, managerId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Manager</SelectItem>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.firstName} {manager.lastName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({manager.role === "ADMIN" ? "Owner" : "Manager"})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <Select
                    value={newUser.teamId || "none"}
                    onValueChange={(value) => setNewUser({ ...newUser, teamId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Team</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      Creating...
                    </>
                  ) : (
                    "Create User"
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
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
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
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.profilePhotoUrl || undefined} />
                          <AvatarFallback>
                            {user.firstName[0]}{user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.manager?.name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {user.team?.name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono font-bold ${getCommissionColor(user.commissionLevel)}`}>
                        {user.commissionLevel}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent aria-describedby="edit-user-description">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription id="edit-user-description">
              {editingUser ? `Update ${editingUser.firstName} ${editingUser.lastName}'s role and commission level.` : "Edit user details"}
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={editingUser.profilePhotoUrl || undefined} />
                  <AvatarFallback>
                    {editingUser.firstName[0]}{editingUser.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-lg">
                    {editingUser.firstName} {editingUser.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {editingUser.email}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={handleRoleChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AGENT">Agent (70%)</SelectItem>
                      <SelectItem value="TEAM_LEADER">Manager (90%)</SelectItem>
                      <SelectItem value="ADMIN">Admin/Owner (130%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Commission Level (%)</Label>
                  <Input
                    type="number"
                    value={editForm.commissionLevel}
                    onChange={(e) => setEditForm({ ...editForm, commissionLevel: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={200}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                      <SelectItem value="TERMINATED">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Manager</Label>
                  <Select
                    value={editForm.managerId || "none"}
                    onValueChange={(value) => setEditForm({ ...editForm, managerId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Manager</SelectItem>
                      {managers
                        .filter((m) => m.id !== editingUser?.id) // Can't be own manager
                        .map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.firstName} {manager.lastName}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({manager.role === "ADMIN" ? "Owner" : "Manager"})
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Team</Label>
                <Select
                  value={editForm.teamId || "none"}
                  onValueChange={(value) => setEditForm({ ...editForm, teamId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Team</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium mb-1">Commission Structure:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• <span className="text-gray-400">Agent (70%)</span> - Base commission level</li>
                  <li>• <span className="text-blue-500">Manager (90%)</span> - Gets 20% override on team sales</li>
                  <li>• <span className="text-amber-500">Owner (130%)</span> - Gets 20% override on all sales</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
